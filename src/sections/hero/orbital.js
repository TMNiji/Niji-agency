// Orbital — rings and clickable planet-dots that orbit the revealed cell.
// Lives inside the hero sticky stage so it pins to the viewport alongside
// the cell. Each dot opens a shared folder card; a connector line is drawn
// from the clicked dot to the card's marker dot.
//
// ALL radii are derived from CELL_R_VH which MUST stay in sync with the
// shader constant `cellR = 0.19` in hero_grain.glsl.

import { createFolderCard } from '../thinking/folderCard.js';

// ── Constants — all factors are relative to the shader cell radius ────────────
const CELL_R_VH = 0.19; // fraction of innerHeight — mirrors shader `cellR`

// Ring diameters expressed as multiples of the cell radius (2× because diameter)
const RING_FACTORS = [1.45, 2.00, 2.45]; // ring radius = factor * cellPx

// Dots: angle in degrees + rFactor (distance from centre as multiple of cellPx).
// All rFactor values > 1.0 so every dot is OUTSIDE the cell membrane ring.
const DOTS_DEF = [
  { angle: 22,  rFactor: 1.30 },
  { angle: 100, rFactor: 1.38 },
  { angle: 195, rFactor: 1.28 },
  { angle: 272, rFactor: 1.34 },
  { angle: 52,  rFactor: 1.82 },
  { angle: 142, rFactor: 1.90 },
  { angle: 228, rFactor: 1.78 },
  { angle: 318, rFactor: 1.86 },
];

const DOT_LABELS = [
  'Vision\nclear here.',
  'Strategy\nwell placed.',
  'Build\nright.',
  'Design\nwith intent.',
  'Research\ndriven.',
  'Launch\nready.',
  'Scale\nthoughtfully.',
  'Iterate\noften.',
];

export function createOrbital({ stage }) {
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
  const dotEls = DOTS_DEF.map((d) => {
    const el = document.createElement('div');
    el.className = 'hero-orbital__dot';
    wrap.appendChild(el);
    return { el, def: d, x: 0, y: 0 };
  });

  stage.appendChild(wrap);

  // ── Compute and apply all viewport-relative positions ─────────────────────
  function updatePositions() {
    const cellPx = CELL_R_VH * window.innerHeight;

    ringEls.forEach((ring, i) => {
      const diameter = RING_FACTORS[i] * cellPx * 2;
      ring.style.width  = `${diameter}px`;
      ring.style.height = `${diameter}px`;
    });

    dotEls.forEach((dot) => {
      const r   = dot.def.rFactor * cellPx;
      const rad = (dot.def.angle * Math.PI) / 180;
      dot.x = Math.cos(rad) * r;
      dot.y = Math.sin(rad) * r;
      dot.el.style.left = `${dot.x}px`;
      dot.el.style.top  = `${dot.y}px`;
    });
  }

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

  // ── Shared popup folder card ───────────────────────────────────────────────
  const popup = document.createElement('div');
  popup.className = 'hero-popup';
  popup.hidden = true;
  const popupCard = createFolderCard({ text: '' });
  popup.appendChild(popupCard.el);
  stage.appendChild(popup);

  let activeDotIdx = null;

  function drawConnector(dotEl, cardDotEl) {
    const sRect = stage.getBoundingClientRect();
    const dRect = dotEl.getBoundingClientRect();
    const cRect = cardDotEl.getBoundingClientRect();
    connLine.setAttribute('x1', dRect.left - sRect.left + dRect.width  / 2);
    connLine.setAttribute('y1', dRect.top  - sRect.top  + dRect.height / 2);
    connLine.setAttribute('x2', cRect.left - sRect.left + cRect.width  / 2);
    connLine.setAttribute('y2', cRect.top  - sRect.top  + cRect.height / 2);
    connLine.setAttribute('opacity', '1');
  }

  function closePopup() {
    popup.hidden = true;
    connLine.setAttribute('opacity', '0');
    activeDotIdx = null;
    dotEls.forEach(({ el }) => el.classList.remove('is-open'));
  }

  function openDot(idx) {
    if (activeDotIdx === idx) { closePopup(); return; }
    activeDotIdx = idx;
    dotEls.forEach(({ el }, i) => el.classList.toggle('is-open', i === idx));

    // Update card text
    const textEl = popupCard.el.querySelector('.folder-card__text');
    if (textEl) textEl.innerHTML = DOT_LABELS[idx].split('\n').join('<br>');

    // Position popup near the dot (stage-relative coords)
    const { x, y } = dotEls[idx];
    const sw = stage.offsetWidth  || window.innerWidth;
    const sh = stage.offsetHeight || window.innerHeight;
    const ox = sw / 2;
    const oy = sh / 2;
    const popupW = 211;
    const popupH = 200;
    let px = ox + x - popupW / 2;
    let py = oy + y - popupH - 14; // prefer above dot
    px = Math.max(8, Math.min(sw - popupW - 8, px));
    py = Math.max(8, Math.min(sh - popupH - 8, py));

    popup.style.left = `${px}px`;
    popup.style.top  = `${py}px`;
    popup.hidden = false;

    requestAnimationFrame(() => {
      resizeConnector();
      const cardDotEl = popupCard.el.querySelector('.folder-card__dot');
      if (cardDotEl) drawConnector(dotEls[idx].el, cardDotEl);
    });
  }

  // Wire up interactions
  dotEls.forEach(({ el }, idx) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); openDot(idx); });
  });

  popupCard.el.querySelector('.folder-card__close')
    ?.addEventListener('click', (e) => { e.stopPropagation(); closePopup(); });

  // Click-outside closes popup
  stage.addEventListener('click', (e) => {
    if (!popup.hidden && !popup.contains(e.target)) closePopup();
  });

  window.addEventListener('resize', () => {
    updatePositions();
    resizeConnector();
    if (activeDotIdx !== null) openDot(activeDotIdx);
  }, { passive: true });

  // show / hide — driven by section enter/leave so the orbital appears exactly
  // when the cell does (cell shader is locked to progress=1 on section enter).
  function show() { wrap.style.setProperty('--orbital-opacity', '1'); }
  function hide() { wrap.style.setProperty('--orbital-opacity', '0'); }

  hide(); // start hidden
  return { show, hide, closePopup };
}
