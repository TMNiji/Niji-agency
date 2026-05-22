// Scroll-driven ruler timeline — a fixed strip of tick marks on the left edge.
//
// 800 ticks pre-rendered at y = i × TICK_PITCH. On every Lenis scroll event
// (fed via update(scrollY)) the inner track translates by -scrollY so ticks
// shadow page scroll. A 5-tick cluster at the viewport centre is highlighted
// with widths [14, 24, 40, 24, 14]px.
//
// Section names are placed inside the track at y = sectionScrollStart + vH/2
// so each label is centred on the cluster exactly when the user first enters
// that section. Per-frame opacity based on distance from centre creates a
// smooth fade-in / fade-out as labels pass the cluster.
//
// Drag: pointerdown on the strip lets users scrub the page. Dragging DOWN
// pulls the ruler down → lower-numbered ticks into view → scrollY decreases
// (map-drag model). Register a scroll handler with setScrollHandler(fn).

const TICK_PITCH = 12;   // px between adjacent ticks
const TICK_W_BASE = 16;  // default tick width (px)
const N_TICKS = 800;     // covers ~9 600 px total — enough for all viewports

// Cluster radius (in ticks) — touch this many on either side of viewport centre.
const CLUSTER_RADIUS = 3;

// Cluster control points: at integer distances d=0,1,2,3 from the exact
// viewport-centre, tick width matches the original [14,24,40,24,14] cluster
// shape. Between integers we lerp linearly so widths shift continuously
// with sub-pixel scroll — no 12-px snap that produced the visual jump.
const CLUSTER_W_AT = [40, 24, 14, TICK_W_BASE];
// Same idea for brightness so the bright zone tracks viewport centre smoothly.
const CLUSTER_A_AT = [0.88, 0.88, 0.55, 0.16];

function clusterAt(d, table) {
  if (d >= CLUSTER_RADIUS) return table[table.length - 1];
  const i = Math.floor(d);
  const f = d - i;
  return table[i] + (table[i + 1] - table[i]) * f;
}

// Fade range: label is fully opaque when ≤ FADE_PEAK px from centre,
// fully dim when ≥ FADE_EDGE px away.
const FADE_PEAK = 20;
const FADE_EDGE = 160;
const OPACITY_MIN = 0.22;
const OPACITY_MAX = 0.90;

// labelAnchors: parallel array of 'top' | 'bottom' per label.
//   'top'    (default) — label centres on cluster when user enters the section.
//   'bottom' — label centres on cluster when user reaches the section's end
//              (scrollY = section.bottom - vH). Use this for labels that
//              represent a state reached only after scrolling through the section.
export function createTimeline({ labels, labelAnchors = [], startIndex = 0, onChange } = {}) {
  const el = document.createElement('nav');
  el.className = 'hero-timeline';
  el.setAttribute('aria-label', 'Section navigation');

  // ── Track — translates with scroll ─────────────────────────────────────────
  const track = document.createElement('div');
  track.className = 'hero-timeline__track';
  el.appendChild(track);

  // Pre-render all ticks once; only 5 are touched per frame after mount.
  const ticks = Array.from({ length: N_TICKS }, (_, i) => {
    const t = document.createElement('div');
    t.className = 'hero-timeline__tick';
    t.style.top = `${i * TICK_PITCH}px`;
    track.appendChild(t);
    return t;
  });

  // ── Section name labels — inside the track at scroll-relative y ─────────────
  // Positions are computed once the DOM has settled (double rAF).
  // Each label is a button so it acts as a real anchor: clicking it jumps the
  // page to that section's top via the registered scrollHandler.
  let sectionPositions   = [];  // y (track space) per label — centre offset for visual fade
  let sectionScrollStarts = []; // raw scroll-top of each section — used for click navigation

  const sectionLabelEls = labels.map((text, i) => {
    const s = document.createElement('button');
    s.className = 'hero-timeline__section-label';
    s.textContent = text;
    s.style.opacity = String(OPACITY_MIN);
    s.addEventListener('click', () => {
      const start = sectionScrollStarts[i];
      if (start !== undefined) scrollHandler?.(start === 0 ? 0 : start + 4);
    });
    track.appendChild(s);
    return s;
  });

  function cacheSectionPositions() {
    const vH = window.innerHeight;
    const sections = document.querySelectorAll('[data-section]');
    sectionScrollStarts = Array.from(sections).map((sec, i) => {
      const rect = sec.getBoundingClientRect();
      if ((labelAnchors[i] ?? 'top') === 'bottom') {
        // Scroll position when section end reaches viewport bottom.
        return Math.round(rect.bottom + window.scrollY - vH);
      }
      return Math.round(rect.top + window.scrollY);
    });
    sectionPositions = sectionScrollStarts.map((start) => start + vH / 2);
    sectionLabelEls.forEach((lEl, i) => {
      if (sectionPositions[i] !== undefined) {
        lEl.style.top = `${sectionPositions[i]}px`;
      }
    });
    // Refresh opacities now that positions are known — without this, labels
    // would stay at OPACITY_MIN (grey) until the user scrolls and triggers
    // update() through the Lenis 'scroll' listener.
    update();
  }

  // Wait for layout to settle before measuring section positions.
  requestAnimationFrame(() => requestAnimationFrame(cacheSectionPositions));
  window.addEventListener('resize', cacheSectionPositions);

  // ── State ───────────────────────────────────────────────────────────────────
  let currentIndex = Math.max(0, Math.min(labels.length - 1, startIndex));
  let prevClusterTicks = [];
  let scrollHandler = null;

  // ── Main update — called on every Lenis scroll event ───────────────────────
  function update(scrollY = window.scrollY) {
    const vH = window.innerHeight;

    // 1. Translate track so tick[i] appears at viewport y = i*TICK_PITCH - scrollY.
    track.style.transform = `translateY(${-scrollY}px)`;

    // 2. Cluster centre tracks the exact viewport centre — no snapping to the
    //    tick grid, so the bright zone glides smoothly with scroll instead of
    //    jumping in 12 px increments. The center is expressed as a fractional
    //    tick index; nearby ticks are widened/brightened by their continuous
    //    distance from it.
    const centerIdxF = (scrollY + vH / 2) / TICK_PITCH;
    const baseIdx = Math.round(centerIdxF);

    // 3. Reset previous cluster (max 2*CLUSTER_RADIUS+1 ops).
    prevClusterTicks.forEach((t) => {
      t.style.width = '';
      t.style.background = '';
    });
    prevClusterTicks = [];

    // 4. Apply continuous width + brightness for each tick in the cluster window.
    for (let off = -CLUSTER_RADIUS; off <= CLUSTER_RADIUS; off++) {
      const idx = baseIdx + off;
      const t = ticks[idx];
      if (!t) continue;
      const d = Math.abs(idx - centerIdxF);
      t.style.width = `${clusterAt(d, CLUSTER_W_AT).toFixed(2)}px`;
      t.style.background = `rgba(255,255,255,${clusterAt(d, CLUSTER_A_AT).toFixed(3)})`;
      prevClusterTicks.push(t);
    }

    // 5. Fade each section label by its distance from the cluster centre.
    const viewportCenter = vH / 2;
    sectionLabelEls.forEach((lEl, i) => {
      const pos = sectionPositions[i];
      if (pos === undefined) return;
      // Label's current y in viewport space.
      const labelViewportY = pos - scrollY;
      const dist = Math.abs(labelViewportY - viewportCenter);
      const t = Math.min(1, Math.max(0, (dist - FADE_PEAK) / (FADE_EDGE - FADE_PEAK)));
      const opacity = OPACITY_MAX - (OPACITY_MAX - OPACITY_MIN) * t;
      lEl.style.opacity = opacity.toFixed(2);
    });
  }

  // ── Drag to scrub ───────────────────────────────────────────────────────────
  // Map-drag model: drag DOWN → ruler moves down → smaller scrollY (scroll up).
  let dragging = false;
  let dragStartY = 0;
  let dragStartScroll = 0;

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStartY = e.clientY;
    dragStartScroll = window.scrollY;
    el.style.cursor = 'grabbing';
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const delta = e.clientY - dragStartY;
    // Drag DOWN (delta > 0) → scroll UP (lower scrollY).
    const target = Math.max(0, dragStartScroll - delta);
    scrollHandler?.(target);
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    el.style.cursor = '';
    try { el.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
  };
  el.addEventListener('pointerup',          endDrag);
  el.addEventListener('pointercancel',      endDrag);
  el.addEventListener('lostpointercapture', endDrag);

  // ── Initial render ──────────────────────────────────────────────────────────
  update();

  // ── Public API ──────────────────────────────────────────────────────────────
  return {
    el,
    /** Feed the Lenis scroll position every frame. */
    update,
    /** Register the function that physically scrolls the page (e.g. lenis.scrollTo). */
    setScrollHandler(fn) { scrollHandler = fn; },
    /** Called by main.js orchestrator — tracks currentIndex for getIndex(). */
    setIndex(i) { currentIndex = Math.max(0, Math.min(labels.length - 1, i)); },
    getIndex()  { return currentIndex; },
  };
}
