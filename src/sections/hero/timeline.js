// Scroll-driven ruler timeline — a fixed strip of tick marks on the left edge.
//
// Ticks are pre-rendered at y = i × TICK_PITCH — enough to cover the whole
// scrollable page (count derived from document height, topped up on resize).
// On every Lenis scroll event (fed via update(scrollY)) the inner track
// translates by -scrollY so ticks shadow page scroll. Ticks near the strip's
// vertical centre swell in width + brightness following a smooth raised-cosine
// dome (see clusterFalloff) — a soft magnifier the ruler glides through.
//
// Section labels occupy three fixed slots — prev (top), current (centre, on the
// cluster), next (bottom). sectionFloat(scrollY) is the continuous current-
// section position; as the user scrolls one full section the whole list slides
// up exactly one slot and cross-fades. Because slot position and opacity are
// smooth functions of scrollY, there are no discrete index flips and no labels
// snapping into view.
//
// Each section label is a button: clicking it jumps the page to that section
// via the handler registered with setScrollHandler(fn).

const TICK_PITCH = 20;   // px between adjacent ticks (wider = fewer, calmer bars)
const TICK_W_BASE = 16;  // base tick width (px) — set on every tick from JS (sole source of truth)
const TICK_W_PEAK = 40;  // width of the centre tick at the heart of the cluster
const TICK_BUFFER = 16;  // extra ticks created beyond the last reachable scroll position

// Cluster — a soft magnifier centred on the strip. Ticks within CLUSTER_RADIUS
// of the centre swell in width + brightness by a raised-cosine falloff: 1 at the
// centre, easing to 0 at the edge. Being a rounded dome (not linear ramps) the
// width changes gently and never dips below base, so there's no triangular
// chevron strobing when the ruler flows through fast.
const CLUSTER_RADIUS = 3;  // ticks each side of centre the dome reaches
const TICK_A_BASE = 0.16;  // base brightness (matches the CSS dim value)
const TICK_A_PEAK = 0.90;  // brightness of the centre tick

function clusterFalloff(d) {
  if (d >= CLUSTER_RADIUS) return 0;
  return 0.5 * (1 + Math.cos((d / CLUSTER_RADIUS) * Math.PI));
}

// Label slots. A label at its centre slot (slotPos 0) is brightest; the prev/
// next labels rest at the edge slots (slotPos ±1) dimmer; beyond ±1 they fade
// to nothing. SLOT_EDGE_PAD is the gap from the strip edge to the edge slots.
const LABEL_CENTER_OPACITY = 0.90;
const LABEL_EDGE_OPACITY = 0.45;
const SLOT_EDGE_PAD = 24;
// Labels dimmer than this are treated as hidden → pulled out of the tab order
// and made non-interactive so keyboard users can't focus an unseen anchor.
const VISIBLE_OPACITY = 0.30;

export function createTimeline({ labels } = {}) {
  const el = document.createElement('nav');
  el.className = 'hero-timeline';
  el.setAttribute('aria-label', 'Section navigation');

  // ── Track — translates with scroll ─────────────────────────────────────────
  const track = document.createElement('div');
  track.className = 'hero-timeline__track';
  el.appendChild(track);

  // Ticks are created lazily up to the page's reachable scroll range — see
  // ensureTicks(), topped up from cacheSectionPositions() once the page height
  // is known. Only the cluster's ~7 ticks are restyled per frame after mount.
  const ticks = [];
  function ensureTicks(count) {
    for (let i = ticks.length; i < count; i++) {
      const t = document.createElement('div');
      t.className = 'hero-timeline__tick';
      t.style.top = `${i * TICK_PITCH}px`;
      t.style.width = `${TICK_W_BASE}px`;
      track.appendChild(t);
      ticks.push(t);
    }
  }
  // Seed enough ticks to fill the strip on first paint; cacheSectionPositions
  // grows this to span the whole page once the sections are measured.
  ensureTicks(Math.ceil((window.innerHeight * 2) / TICK_PITCH));

  // ── Section name labels — inside the track at scroll-relative y ─────────────
  // Positions are computed once the DOM has settled (double rAF).
  // Each label is a button so it acts as a real anchor: clicking it jumps the
  // page to that section's top via the registered scrollHandler.
  let sectionCentres     = []; // scrollY at which each label rests on the centre slot
  let sectionScrollStarts = []; // raw scroll-top of each section — used for click navigation

  const sectionLabelEls = labels.map((text, i) => {
    const s = document.createElement('button');
    s.className = 'hero-timeline__section-label';
    s.textContent = text;
    s.style.opacity = '0'; // real value set by update() once positions are measured
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
    // Grow the ruler so it covers every reachable scroll position — the cluster
    // sits stripH/2 ahead of scrollY, so cover maxScroll + stripH/2 (+ buffer).
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vH);
    ensureTicks(Math.ceil((maxScroll + stripH / 2) / TICK_PITCH) + CLUSTER_RADIUS + TICK_BUFFER);
    const sections = document.querySelectorAll('[data-section]');
    sectionScrollStarts = Array.from(sections).map((sec) => {
      const rect = sec.getBoundingClientRect();
      return Math.round(rect.top + window.scrollY);
    });
    // Scroll position at which each section's label rests dead-centre on the
    // cluster. Non-hero sections get +4 px to match the click-nav landing offset
    // (the timeline button scrolls to start+4 so Lenis's ease-out reliably
    // crosses the ScrollTrigger start boundary that drives the shader swaps), so
    // a label centres exactly when the page rests on its section.
    sectionCentres = sectionScrollStarts.map((start) => start + (start === 0 ? 0 : 4));
    // Place + fade the labels now that positions are known — without this they
    // stay hidden (opacity 0) until the user scrolls and triggers update()
    // through the Lenis 'scroll' listener.
    update();
  }

  // Wait for layout to settle before measuring section positions.
  requestAnimationFrame(() => requestAnimationFrame(cacheSectionPositions));
  window.addEventListener('resize', cacheSectionPositions);

  // ── State ───────────────────────────────────────────────────────────────────
  let prevClusterTicks = [];
  let scrollHandler = null;
  let stripH = 0; // cached height of the visible timeline strip

  // Continuous current-section position: integer i when scrollY rests on
  // section i's centre, interpolating linearly toward i+1 as the user scrolls
  // to the next. Drives the label slot animation in update().
  function sectionFloat(scrollY) {
    const c = sectionCentres;
    if (c.length === 0 || scrollY <= c[0]) return 0;
    for (let i = 0; i < c.length - 1; i++) {
      if (scrollY < c[i + 1]) {
        const span = c[i + 1] - c[i] || 1;
        return i + (scrollY - c[i]) / span;
      }
    }
    return c.length - 1;
  }

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

    // 3. Reset previous cluster back to base width + dim colour (max
    //    2*CLUSTER_RADIUS+1 ops). Background clears to the CSS dim value.
    prevClusterTicks.forEach((t) => {
      t.style.width = `${TICK_W_BASE}px`;
      t.style.background = '';
    });
    prevClusterTicks = [];

    // 4. Swell width + brightness for each tick in the cluster window, easing
    //    smoothly from the centre out so the dome glides instead of strobing.
    for (let off = -CLUSTER_RADIUS; off <= CLUSTER_RADIUS; off++) {
      const idx = baseIdx + off;
      const t = ticks[idx];
      if (!t) continue;
      const f = clusterFalloff(Math.abs(idx - centerIdxF));
      t.style.width = `${(TICK_W_BASE + (TICK_W_PEAK - TICK_W_BASE) * f).toFixed(2)}px`;
      t.style.background = `rgba(255,255,255,${(TICK_A_BASE + (TICK_A_PEAK - TICK_A_BASE) * f).toFixed(3)})`;
      prevClusterTicks.push(t);
    }

    // 5. Section labels in three fixed slots — prev (top), current (centre),
    //    next (bottom). slotPos is each label's signed distance from the centre
    //    slot in slot units; as secFloat advances by 1 the whole list slides up
    //    one slot, so position and opacity move smoothly with scroll.
    if (stripH <= 0) return; // positions not measured yet — labels stay hidden
    const secFloat = sectionFloat(scrollY);
    const slotGap = stripH / 2 - SLOT_EDGE_PAD; // centre→edge slot spacing
    sectionLabelEls.forEach((lEl, i) => {
      const slotPos = i - secFloat;             // 0 centre, −1 top, +1 bottom
      const stripY = stripH / 2 + slotPos * slotGap;
      lEl.style.top = `${stripY + scrollY}px`;  // track-relative = stripY + scrollY

      const d = Math.abs(slotPos);
      let opacity;
      if (d <= 1) opacity = LABEL_CENTER_OPACITY + (LABEL_EDGE_OPACITY - LABEL_CENTER_OPACITY) * d;
      else if (d < 2) opacity = LABEL_EDGE_OPACITY * (2 - d); // fade out past the edge slot
      else opacity = 0;
      lEl.style.opacity = opacity.toFixed(2);

      // Keep faded/clipped labels out of the tab order and non-interactive so
      // keyboard users can't focus (or click) an anchor they can't see.
      const visible = opacity >= VISIBLE_OPACITY;
      lEl.tabIndex = visible ? 0 : -1;
      lEl.style.pointerEvents = visible ? 'auto' : 'none';
      lEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
  }

  // ── Initial render ──────────────────────────────────────────────────────────
  update();

  // ── Public API ──────────────────────────────────────────────────────────────
  return {
    el,
    /** Feed the Lenis scroll position every frame. */
    update,
    /** Register the function that physically scrolls the page (e.g. lenis.scrollTo). */
    setScrollHandler(fn) { scrollHandler = fn; },
    /** Remove listeners — call if the timeline is ever torn down. */
    destroy() { window.removeEventListener('resize', cacheSectionPositions); },
  };
}
