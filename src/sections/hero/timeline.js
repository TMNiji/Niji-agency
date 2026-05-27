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

export function createTimeline({ labels, startIndex = 0 } = {}) {
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
    stripH = el.offsetHeight;
    const vH = window.innerHeight;
    const sections = document.querySelectorAll('[data-section]');
    sectionScrollStarts = Array.from(sections).map((sec) => {
      const rect = sec.getBoundingClientRect();
      return Math.round(rect.top + window.scrollY);
    });
    // Snap targets in main.js land non-hero sections at start+4 (small offset
    // so Lenis's ease-out reliably crosses the ScrollTrigger boundary). Mirror
    // that offset here so each label centres exactly on the cluster when the
    // user is snapped to its section — otherwise labels sit 4 px above centre.
    const anchor = stripH > 0 ? stripH / 2 : vH / 2;
    sectionPositions = sectionScrollStarts.map((start) => start + anchor + (start === 0 ? 0 : 4));
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
  let stripH = 0; // cached height of the visible timeline strip

  // ── Main update — called on every Lenis scroll event ───────────────────────
  function update(scrollY = window.scrollY) {
    const vH = window.innerHeight;

    // 1. Translate track so tick[i] appears at viewport y = i*TICK_PITCH - scrollY.
    track.style.transform = `translateY(${-scrollY}px)`;

    // 2. Cluster centre tracks the strip's visual centre (stripH/2 from its top),
    //    not the raw viewport centre, so it stays at the midpoint of the strip
    //    regardless of how tall the strip is. Falls back to vH/2 before the first
    //    layout measurement.
    const clusterOffset = stripH > 0 ? stripH / 2 : vH / 2;
    const centerIdxF = (scrollY + clusterOffset) / TICK_PITCH;
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

    // 5. Fade each section label; pin prev/next labels to strip edges when
    //    their natural position would be clipped outside the strip bounds.
    const viewportCenter = stripH > 0 ? stripH / 2 : vH / 2;
    const EDGE_PAD = 24; // px from strip edge when pinning adjacent labels
    sectionLabelEls.forEach((lEl, i) => {
      const pos = sectionPositions[i];
      if (pos === undefined) return;

      const naturalStripY = pos - scrollY; // strip-relative position
      const isAdjacent = stripH > 0 && Math.abs(i - currentIndex) === 1;

      let effectiveY = naturalStripY;
      let pinned = false;
      if (isAdjacent) {
        if (naturalStripY < EDGE_PAD) {
          effectiveY = EDGE_PAD;
          pinned = true;
        } else if (naturalStripY > stripH - EDGE_PAD) {
          effectiveY = stripH - EDGE_PAD;
          pinned = true;
        }
      }

      // Keep top in sync (track-relative = effectiveY + scrollY).
      lEl.style.top = `${effectiveY + scrollY}px`;

      const opacity = pinned
        ? 0.45
        : OPACITY_MAX - (OPACITY_MAX - OPACITY_MIN) * Math.min(1, Math.max(0,
            (Math.abs(naturalStripY - viewportCenter) - FADE_PEAK) / (FADE_EDGE - FADE_PEAK)));
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
    /** Set the active section index — drives adjacent-label edge pinning. */
    setIndex(i) { currentIndex = Math.max(0, Math.min(labels.length - 1, i)); },
  };
}
