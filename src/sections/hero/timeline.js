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

// 5-tick cluster centred on nearest grid position.
const CLUSTER = [
  { offset: -24, width: 14 },
  { offset: -12, width: 24 },
  { offset:   0, width: 40 },
  { offset: +12, width: 24 },
  { offset: +24, width: 14 },
];

// Fade range: label is fully opaque when ≤ FADE_PEAK px from centre,
// fully dim when ≥ FADE_EDGE px away.
const FADE_PEAK = 20;
const FADE_EDGE = 160;
const OPACITY_MIN = 0.22;
const OPACITY_MAX = 0.90;

export function createTimeline({ labels, startIndex = 0, onChange } = {}) {
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
  const sectionLabelEls = labels.map((text) => {
    const s = document.createElement('span');
    s.className = 'hero-timeline__section-label';
    s.textContent = text;
    s.style.opacity = String(OPACITY_MIN);
    track.appendChild(s);
    return s;
  });

  let sectionPositions = [];  // y (track space) per section label

  function cacheSectionPositions() {
    const vH = window.innerHeight;
    const sections = document.querySelectorAll('[data-section]');
    sectionPositions = Array.from(sections).map((sec) => {
      const scrollStart = sec.getBoundingClientRect().top + window.scrollY;
      return scrollStart + vH / 2;
    });
    sectionLabelEls.forEach((lEl, i) => {
      if (sectionPositions[i] !== undefined) {
        lEl.style.top = `${sectionPositions[i]}px`;
      }
    });
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

    // 2. Snap cluster centre to nearest tick-grid position.
    const centerY = Math.round((scrollY + vH / 2) / TICK_PITCH) * TICK_PITCH;

    // 3. Reset previous cluster (5 ops max).
    prevClusterTicks.forEach((t) => {
      t.style.width = `${TICK_W_BASE}px`;
      t.classList.remove('is-active');
    });
    prevClusterTicks = [];

    // 4. Highlight new cluster.
    CLUSTER.forEach(({ offset, width }) => {
      const idx = (centerY + offset) / TICK_PITCH;
      const t = ticks[idx];
      if (!t) return;
      t.style.width = `${width}px`;
      t.classList.add('is-active');
      prevClusterTicks.push(t);
    });

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
