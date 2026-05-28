// Scroll-driven ruler timeline — a fixed strip of tick marks on the left edge.
//
// One uniform array of tick marks is laid out at y = k × TICK_PITCH. Every
// MINOR_PER_SECTION-th tick is rendered as an ANCHOR (longer, brighter bar)
// at a section's vScroll position; the rest are MINOR ticks that texture the
// space between anchors. Same gap between every adjacent pair of bars.
//
// On every Lenis scroll event (fed via update(scrollY)) the inner track
// translates by (stripH/2 − vScroll) so the anchor for the current section
// sits dead-centre on the strip, and the section label at slotPos 0 aligns
// vertically with it. As secFloat advances by 1, both labels and ticks slide
// up by exactly one slotGap, keeping the anchor-label alignment locked.
//
// Each section label is a button: clicking it jumps the page to that section
// via the handler registered with setScrollHandler(fn).

const TICK_PITCH         = 22;  // px between adjacent ticks (anchor or minor — uniform)
const MINOR_PER_SECTION  = 3;   // count of TICK_PITCH steps between two anchors (3 → 2 minors then 1 anchor)
const TICK_BUFFER        = 16;  // extra ticks created past the last reachable scroll position
// slotGap MUST equal MINOR_PER_SECTION × TICK_PITCH so anchors land on
// multiples of TICK_PITCH and line up cleanly with the minor-tick grid.
const SLOT_GAP           = TICK_PITCH * MINOR_PER_SECTION;

const TICK_W_MINOR       = 8;
const TICK_W_ANCHOR      = 32;
const TICK_A_MINOR       = 0.16;
const TICK_A_ANCHOR      = 0.55;

// Small right-pointing arrow revealed beside a label on hover — signals the
// label is clickable. Inherits text colour via currentColor; sized in em so it
// scales with whatever element it sits in (timeline label or footer CTA).
const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/></svg>';

// Label slots. A label at its centre slot (slotPos 0) is brightest; the prev/
// next labels rest at the edge slots (slotPos ±1) dimmer; beyond ±1 they fade
// to nothing.
const LABEL_CENTER_OPACITY = 0.90;
const LABEL_EDGE_OPACITY = 0.45;
// Labels dimmer than this are treated as hidden → pulled out of the tab order
// and made non-interactive so keyboard users can't focus an unseen anchor.
const VISIBLE_OPACITY = 0.05;

// A label that hints at the page's seamless loop — appended after the real
// sections. Its scrollY anchor is the end of the document, so it slides into
// the bottom slot as the user approaches the loop; clicking it scrolls back
// to the top (where the loop lands anyway).
export function createTimeline({ labels, loopLabel = null } = {}) {
  const el = document.createElement('nav');
  el.className = 'hero-timeline';
  el.setAttribute('aria-label', 'Section navigation');

  // ── Track — translates with scroll ─────────────────────────────────────────
  const track = document.createElement('div');
  track.className = 'hero-timeline__track';
  el.appendChild(track);

  // Tick marks — one uniform array. Index k yields an anchor when
  // k % MINOR_PER_SECTION === 0, a minor tick otherwise. Same TICK_PITCH gap
  // between every adjacent pair, so anchors and minors share the same grid.
  const ticks = [];
  function ensureTicks(count) {
    for (let i = ticks.length; i < count; i++) {
      const t = document.createElement('div');
      const isAnchor = i % MINOR_PER_SECTION === 0;
      t.className = isAnchor
        ? 'hero-timeline__tick hero-timeline__tick--anchor'
        : 'hero-timeline__tick';
      t.style.top   = `${i * TICK_PITCH}px`;
      t.style.width = `${isAnchor ? TICK_W_ANCHOR : TICK_W_MINOR}px`;
      t.style.background = `rgba(255, 255, 255, ${isAnchor ? TICK_A_ANCHOR : TICK_A_MINOR})`;
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

  // Real-section labels first; then an optional loop anchor whose target is 0.
  const allLabels = loopLabel ? [...labels, loopLabel] : labels;
  const sectionLabelEls = allLabels.map((text, i) => {
    const s = document.createElement('button');
    s.className = 'hero-timeline__section-label';
    s.innerHTML =
      `<span class="hero-timeline__section-text">${text}</span>` +
      `<span class="hero-timeline__section-arrow">${ARROW_SVG}</span>`;
    s.style.opacity = '0'; // real value set by update() once positions are measured
    const isLoopAnchor = loopLabel && i === allLabels.length - 1;
    s.addEventListener('click', () => {
      if (isLoopAnchor) { scrollHandler?.(0); return; }
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
    // Scroll position at which each section's label rests dead-centre on the
    // cluster. Non-hero sections get +4 px to match the click-nav landing
    // offset so a label centres exactly when the page rests on its section.
    sectionCentres = sectionScrollStarts.map((start) => start + (start === 0 ? 0 : 4));
    // Loop anchor — placed at the end of the document so it slides into the
    // bottom slot as the user scrolls through the final section, signalling
    // the page is about to wrap back to the top.
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vH);
    if (loopLabel) sectionCentres.push(maxScroll);
    // Grow the tick array so it covers every reachable VIRTUAL scroll position
    // plus the visible window on the strip. vScroll = secFloat * SLOT_GAP, so
    // max vScroll is (N − 1) × SLOT_GAP, and the strip extends ±stripH/2 from
    // there at the extremes.
    const maxVScroll = Math.max(0, sectionCentres.length - 1) * SLOT_GAP;
    ensureTicks(Math.ceil((maxVScroll + stripH / 2) / TICK_PITCH) + TICK_BUFFER);
    // Place + fade the labels now that positions are known — without this they
    // stay hidden (opacity 0) until the user scrolls and triggers update()
    // through the Lenis 'scroll' listener.
    update();
  }

  // Wait for layout to settle before measuring section positions.
  requestAnimationFrame(() => requestAnimationFrame(cacheSectionPositions));
  window.addEventListener('resize', cacheSectionPositions);

  // ── State ───────────────────────────────────────────────────────────────────
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
    const secFloat = sectionFloat(scrollY);
    const vScroll  = secFloat * SLOT_GAP;

    // Translate track so the anchor for section i lands at strip CENTRE when
    // secFloat = i (anchor track-top = i × SLOT_GAP, with the +stripH/2 shift
    // putting it at strip mid when vScroll = i × SLOT_GAP).
    track.style.transform = `translateY(${(stripH / 2 - vScroll).toFixed(1)}px)`;

    // Section labels — slotPos is each label's signed distance from the centre
    // slot in slot units. As secFloat advances by 1 the whole list slides up
    // one slot. Track-coord top = slotPos × SLOT_GAP + vScroll so that, after
    // the track's transform, label viewport y = stripH/2 + slotPos × SLOT_GAP
    // (anchors share the same arithmetic — they sit at SLOT_GAP × i, which
    // becomes stripH/2 + SLOT_GAP × (i − secFloat) once translated).
    if (stripH <= 0) return; // positions not measured yet — labels stay hidden
    sectionLabelEls.forEach((lEl, i) => {
      const slotPos = i - secFloat;
      lEl.style.top = `${(slotPos * SLOT_GAP + vScroll).toFixed(1)}px`;

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
