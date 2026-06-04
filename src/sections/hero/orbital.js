// Orbital — rings and clickable planet-dots that orbit the revealed cell.
// Lives inside the hero sticky stage so it pins to the viewport alongside
// the cell. Each dot opens a shared folder card; a connector line is drawn
// from the clicked dot to the card's marker dot.
//
// ALL radii are derived from CELL_R_VH which MUST stay in sync with the
// shader constant `cellR = 0.19` in hero_grain.glsl.

import { gsap } from 'gsap';
import { prefersReducedMotion } from '@modules/motion.js';
import {
  createStrategyCard,
  createBusinessValueCard,
  createDesignSprintCard,
  createBrainstormCard,
  createBenchmarkStack,
} from '../thinking/cards.js';

// ── Constants — all factors are relative to the shader cell radius ────────────
const CELL_R_VH = 0.19; // fraction of innerHeight — mirrors shader `cellR`

// Ring diameters expressed as multiples of the cell radius (2× because diameter)
const RING_FACTORS = [1.45, 2.00, 2.45]; // ring radius = factor * cellPx

// Five clickable dots, each opening a distinct build-phase card.
const DOT_LABELS = ['/Stratégie', '/Business Value', '/Design Sprint', '/Brainstorming', '/Benchmark'];
const BENCHMARK_IDX = 4; // dot 5 opens a window stack instead of a single card
const CARD_BUILDERS = [
  createStrategyCard,
  createBusinessValueCard,
  createDesignSprintCard,
  createBrainstormCard,
];

// Dots: angle in degrees + rFactor (distance from centre as multiple of cellPx).
// Generated with a golden-angle (~137.5°) spread so dots never cluster,
// and three radius bands (inner / mid / outer) for visual depth.
// All rFactor values > 1.0 so every dot is OUTSIDE the cell membrane ring.
const R_BANDS    = [1.22, 1.60, 1.96]; // inner / mid / outer
const DOT_COUNT  = DOT_LABELS.length;
const DOTS_DEF = Array.from({ length: DOT_COUNT }, (_, i) => {
  const angle   = (i * 137.508) % 360; // golden angle — no clustering
  const rBase   = R_BANDS[i % 3];
  // Deterministic per-dot jitter so the distribution never feels gridded.
  const jitter  = ((i * 13 + 7) % 17) / 17 * 0.28 - 0.14;
  return { angle, rFactor: rBase + jitter };
});

export function createOrbital({ stage, cards = {} } = {}) {
  // Per-dot CMS content for the floating cards (dots 0-3). Index order matches
  // CARD_BUILDERS; undefined entries let each builder use its own defaults.
  const CARD_CONTENT = [cards.strategy, cards.businessValue, cards.designSprint, cards.brainstorm];
  // Wrap centered at stage midpoint (width/height 0 — children offset from it)
  const wrap = document.createElement('div');
  wrap.className = 'hero-orbital';

  // Create ring elements (resized dynamically in updatePositions)
  const ringEls = RING_FACTORS.map((_, i) => {
    const ring = document.createElement('div');
    ring.className = `hero-orbital__ring hero-orbital__ring--${i + 1}`;
    wrap.appendChild(ring);
    return ring;
  });

  // Create dot elements (positioned dynamically in updatePositions)
  // transform is driven entirely by JS — CSS has no transform rule for these.
  const dotEls = DOTS_DEF.map((d, i) => {
    const el = document.createElement('div');
    el.className = 'hero-orbital__dot';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', DOT_LABELS[i].replace(/^\//, ''));
    el.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    label.className = 'hero-orbital__dot-label';
    label.textContent = DOT_LABELS[i];
    el.appendChild(label);
    wrap.appendChild(el);
    return { el, def: d, x: 0, y: 0 };
  });

  stage.appendChild(wrap);

  // Cell radius in px — capped by width so the widest ring (2.45×) and outer
  // dots still fit narrow viewports without overflowing horizontally.
  function cellRadiusPx() {
    return Math.min(CELL_R_VH * window.innerHeight, 0.184 * window.innerWidth);
  }

  // ── Compute and apply all viewport-relative positions ─────────────────────
  function updatePositions() {
    const cellPx = cellRadiusPx();

    // On phones the cell radius is width-capped (≈0.18·width), which squeezes
    // all five dots into a small circle that the central glow swallows and the
    // labels collide in. The viewport is tall though, so push the dots out
    // along their radii to use that vertical room and separate them. Labels
    // sit below each dot on mobile (hero.css), so the extra spread reads clean.
    const dotSpread = window.innerWidth <= 600 ? 1.5 : 1;

    ringEls.forEach((ring, i) => {
      const diameter = RING_FACTORS[i] * cellPx * 2;
      ring.style.width  = `${diameter}px`;
      ring.style.height = `${diameter}px`;
    });

    dotEls.forEach((dot) => {
      const r   = dot.def.rFactor * cellPx * dotSpread;
      const rad = (dot.def.angle * Math.PI) / 180;
      dot.x = Math.cos(rad) * r;
      dot.y = Math.sin(rad) * r;
      dot.el.style.left = `${dot.x}px`;
      dot.el.style.top  = `${dot.y}px`;
    });
  }

  // ── Mouse-follow — each dot individually drifts toward the cursor ───────────
  // A dot only reacts when the cursor enters its own influence radius.
  // Smoothstep falloff: full displacement at the dot's centre, zero at the edge.
  const INFLUENCE_R = 120;  // px — radius around each dot that triggers a reaction
  const FOLLOW_MAX  = 9;    // px — maximum displacement at cursor centre
  const FOLLOW_LERP = 0.10; // fraction per frame — spring smoothing

  const followOffsets = dotEls.map(() => ({ x: 0, y: 0, lastX: NaN, lastY: NaN }));
  let mouseStageX = null;
  let mouseStageY = null;
  let following = false;

  // Stage dimensions are read once per resize, not per frame, so the follow
  // loop never forces a layout reflow.
  let stageW = 0, stageH = 0;
  function measureStage() {
    stageW = stage.offsetWidth  || window.innerWidth;
    stageH = stage.offsetHeight || window.innerHeight;
  }
  measureStage();

  function applyTransforms() {
    const ox = stageW / 2;
    const oy = stageH / 2;

    const reduced = prefersReducedMotion();

    dotEls.forEach((dot, i) => {
      let targetX = 0;
      let targetY = 0;

      if (!reduced && mouseStageX !== null) {
        const dx   = mouseStageX - (ox + dot.x);
        const dy   = mouseStageY - (oy + dot.y);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < INFLUENCE_R && dist > 0) {
          // Smoothstep: 1 at dot centre → 0 at influence edge
          const t      = 1 - dist / INFLUENCE_R;
          const smooth = t * t * (3 - 2 * t);
          const pull   = smooth * FOLLOW_MAX;
          targetX = (dx / dist) * pull;
          targetY = (dy / dist) * pull;
        }
      }

      const fo = followOffsets[i];
      fo.x += (targetX - fo.x) * FOLLOW_LERP;
      fo.y += (targetY - fo.y) * FOLLOW_LERP;

      // Skip the style write once the spring has settled — avoids re-painting
      // every dot every frame when the cursor is far away and nothing moves.
      const rx = Math.round(fo.x * 100) / 100;
      const ry = Math.round(fo.y * 100) / 100;
      if (rx === fo.lastX && ry === fo.lastY) return;
      fo.lastX = rx;
      fo.lastY = ry;

      dot.el.style.transform =
        `translate(calc(-50% + ${rx}px), calc(-50% + ${ry}px))`;
    });
  }

  stage.addEventListener('mousemove', (e) => {
    const rect = stage.getBoundingClientRect();
    mouseStageX = e.clientX - rect.left;
    mouseStageY = e.clientY - rect.top;
  }, { passive: true });

  stage.addEventListener('mouseleave', () => {
    mouseStageX = null;
    mouseStageY = null;
  }, { passive: true });

  updatePositions();

  // ── Connector SVG — fills the entire sticky stage ─────────────────────────
  const connSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  connSvg.setAttribute('class', 'hero-connector');
  connSvg.setAttribute('aria-hidden', 'true');
  const connLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  connLine.setAttribute('stroke',           'rgba(255,255,255,0.30)');
  connLine.setAttribute('stroke-width',     '1');
  connLine.setAttribute('stroke-dasharray', '4 6');
  connLine.setAttribute('opacity',          '0');
  connSvg.appendChild(connLine);
  stage.appendChild(connSvg);

  function resizeConnector() {
    const w = stage.offsetWidth  || window.innerWidth;
    const h = stage.offsetHeight || window.innerHeight;
    connSvg.setAttribute('width',   w);
    connSvg.setAttribute('height',  h);
    connSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  requestAnimationFrame(resizeConnector);

  // ── Per-dot cards ──────────────────────────────────────────────────────────
  // Dots 0-3 share one floating popup whose content swaps per dot. Dot 4
  // (Benchmark) opens a cascading window stack handled separately.
  // Body-level so the popup (build cards with chat bubbles, checklists, etc.)
  // escapes the .thinking stacking context (z:1) and sits above the #noise
  // overlay (z:9990) — keeps the white card chrome clean of grain. The stage
  // is position:fixed inset:0, so the existing viewport-pixel coords used by
  // openSingleCard() apply unchanged.
  const popup = document.createElement('div');
  popup.className = 'hero-popup';
  popup.hidden = true;
  document.body.appendChild(popup);

  const benchmark = createBenchmarkStack({ stage, sites: cards.benchmark?.sites });

  // Lazily built and cached so card state (e.g. checklist) survives re-opens.
  const cardCache = new Array(CARD_BUILDERS.length).fill(null);
  function getCard(idx) {
    if (!cardCache[idx]) {
      const inst = CARD_BUILDERS[idx](CARD_CONTENT[idx]);
      inst.el.querySelector(inst.closeSelector)
        ?.addEventListener('click', (e) => { e.stopPropagation(); closeAll(); });
      cardCache[idx] = inst;
    }
    return cardCache[idx];
  }

  let activeDotIdx = null;
  let activeCard   = null;

  // Connects the dot to the card's bottom-centre (its top-centre when the card
  // had to drop below the dot), so the dashed line reads as anchoring the card.
  function drawConnector(dotEl, cardEl) {
    const sRect = stage.getBoundingClientRect();
    const dRect = dotEl.getBoundingClientRect();
    const cRect = cardEl.getBoundingClientRect();
    const dotCy  = dRect.top  - sRect.top + dRect.height / 2;
    const cardAbove = (cRect.top + cRect.height / 2 - sRect.top) < dotCy;
    connLine.setAttribute('x1', dRect.left - sRect.left + dRect.width / 2);
    connLine.setAttribute('y1', dotCy);
    connLine.setAttribute('x2', cRect.left - sRect.left + cRect.width / 2);
    connLine.setAttribute('y2', (cardAbove ? cRect.bottom : cRect.top) - sRect.top);
    connLine.setAttribute('opacity', '1');
  }

  function closeAll() {
    if (activeCard) {
      activeCard.stop?.();
      if (activeCard.el.parentNode === popup) popup.removeChild(activeCard.el);
      activeCard = null;
    }
    benchmark.close();
    popup.hidden = true;
    connLine.setAttribute('opacity', '0');
    activeDotIdx = null;
    dotEls.forEach(({ el }) => {
      el.classList.remove('is-open');
      el.setAttribute('aria-expanded', 'false');
    });
  }

  function openSingleCard(idx) {
    const inst = getCard(idx);
    activeCard = inst;
    popup.appendChild(inst.el);
    popup.hidden = false;
    popup.style.visibility = 'hidden'; // lay out for measurement, then position
    popup.style.left = '0px';
    popup.style.top  = '0px';

    requestAnimationFrame(() => {
      const cardW = inst.el.offsetWidth  || 220;
      const cardH = inst.el.offsetHeight || 200;
      const { x, y } = dotEls[idx];
      const sw = stage.offsetWidth  || window.innerWidth;
      const sh = stage.offsetHeight || window.innerHeight;
      const ox = sw / 2;
      const oy = sh / 2;
      const GAP = 64;                     // space for a visible dashed connector
      let px = ox + x - cardW / 2;
      let py = oy + y - cardH - GAP;       // prefer above the dot
      if (py < 8) py = oy + y + GAP;       // no room above → drop below
      px = Math.max(8, Math.min(sw - cardW - 8, px));
      py = Math.max(8, Math.min(sh - cardH - 8, py));
      popup.style.left = `${px}px`;
      popup.style.top  = `${py}px`;
      popup.style.visibility = '';

      resizeConnector();
      drawConnector(dotEls[idx].el, inst.el);
      inst.play?.();
    });
  }

  function openDot(idx) {
    if (activeDotIdx === idx) { closeAll(); return; }
    closeAll();
    activeDotIdx = idx;
    dotEls.forEach(({ el }, i) => {
      el.classList.toggle('is-open', i === idx);
      el.setAttribute('aria-expanded', i === idx ? 'true' : 'false');
    });
    if (idx === BENCHMARK_IDX) benchmark.open();
    else openSingleCard(idx);
  }

  // Wire up interactions
  dotEls.forEach(({ el }, idx) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); openDot(idx); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        openDot(idx);
      } else if (e.key === 'Escape' && activeDotIdx === idx) {
        closeAll();
      }
    });
  });

  // Click-anywhere-outside closes whatever's open. Listening on document (not
  // the pointer-events:none stage) so clicks on empty space are caught too.
  // Dot clicks call stopPropagation, so they never reach this handler.
  document.addEventListener('click', (e) => {
    if (activeDotIdx === null) return;
    if (e.target.closest('.hero-orbital__dot, .hero-popup, .bwin')) return;
    closeAll();
  });

  window.addEventListener('resize', () => {
    measureStage();
    updatePositions();
    resizeConnector();
    closeAll();
  }, { passive: true });

  // show / hide — driven by section enter/leave so the orbital appears exactly
  // when the cell does (cell shader is locked to progress=1 on section enter).
  function startFollow() {
    if (following) return;
    following = true;
    measureStage(); // stage may have been laid out since the last measure
    dotEls.forEach(({ el }) => { el.style.willChange = 'transform'; });
    gsap.ticker.add(applyTransforms);
  }
  function stopFollow() {
    if (!following) return;
    following = false;
    gsap.ticker.remove(applyTransforms);
    dotEls.forEach(({ el }) => { el.style.willChange = ''; });
  }

  // Below this opacity the dots are too faint to reliably aim at, so they're
  // hidden + made non-interactive (see .is-dots-hidden in hero.css).
  const DOT_CLICK_MIN = 0.9;

  function show() {
    wrap.style.removeProperty('transition'); // Re-enable CSS transitions after setOpacity suppressed them
    wrap.style.setProperty('--orbital-opacity', '1');
    wrap.style.setProperty('--orbital-scale', '1');
    wrap.classList.remove('is-dots-hidden');
    startFollow();
  }
  function hide() {
    wrap.style.removeProperty('transition'); // Re-enable CSS transitions after setOpacity suppressed them
    wrap.style.setProperty('--orbital-opacity', '0');
    // Collapse to a point so the rings + dots grow outward from the cell's
    // centre on show(), instead of just fading in at their final size.
    wrap.style.setProperty('--orbital-scale', '0');
    // Drop the dots immediately so they never linger as invisible click targets.
    wrap.classList.add('is-dots-hidden');
    stopFollow();
  }

  // Per-frame opacity override used during the prism cross-fade. Suppresses the
  // CSS transition so it tracks scroll exactly; show()/hide() re-enable it.
  function setOpacity(v) {
    wrap.style.transition = 'none';
    wrap.style.setProperty('--orbital-opacity', String(v.toFixed(3)));
    // Hide the dots as soon as the orbital leaves its fully-revealed state.
    wrap.classList.toggle('is-dots-hidden', v < DOT_CLICK_MIN);
  }

  hide(); // start hidden — follow loop starts on first show()
  return { show, hide, closePopup: closeAll, setOpacity };
}
