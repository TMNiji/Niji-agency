import { createFolderCard } from './folderCard.js';

// Service categories — each has a tag and two placeholder sub-items
const SERVICES = [
  { tag: 'PRODUCT',  items: ['Product Design', 'User Research'] },
  { tag: 'BUSINESS', items: ['Brand Strategy', 'Market Analysis'] },
  { tag: 'BRANDING', items: ['Visual Identity', 'Brand Systems'] },
  { tag: 'TECH',     items: ['Frontend Engineering', 'System Design'] },
];

const PHASES = ['VISION', 'STRATEGY', 'BUILD'];

// Satellite dots — inner ring (~175 px) and outer ring (~300 px)
const DOTS = [
  { angle: 22,  radius: 172, size: 5 },
  { angle: 100, radius: 180, size: 4 },
  { angle: 195, radius: 168, size: 5 },
  { angle: 272, radius: 177, size: 4 },
  { angle: 52,  radius: 298, size: 4 },
  { angle: 142, radius: 312, size: 5 },
  { angle: 228, radius: 287, size: 4 },
  { angle: 318, radius: 305, size: 5 },
];

export function mountThinking({ container, orchestrator, webgl } = {}) {
  const section = container.querySelector('[data-section="thinking"]');
  if (!section) return null;
  section.classList.add('thinking');

  // ── Orbital ────────────────────────────────────────────────────────────────
  const orbital = document.createElement('div');
  orbital.className = 'thinking__orbital';

  const rings = document.createElement('div');
  rings.className = 'thinking__rings';
  [1, 2, 3].forEach((i) => {
    const r = document.createElement('div');
    r.className = `thinking__ring thinking__ring--${i}`;
    rings.appendChild(r);
  });
  orbital.appendChild(rings);

  // Satellite dots — store (x, y) offsets from orbital centre for popup math
  const dotEls = [];
  DOTS.forEach((d, idx) => {
    const rad = (d.angle * Math.PI) / 180;
    const x   = Math.cos(rad) * d.radius;
    const y   = Math.sin(rad) * d.radius;
    const el  = document.createElement('div');
    el.className  = 'thinking__dot';
    el.style.cssText = `width:${d.size}px;height:${d.size}px;left:${x}px;top:${y}px;`;
    orbital.appendChild(el);
    dotEls.push({ el, x, y });
  });
  section.appendChild(orbital);

  // ── Phase labels — left spine ──────────────────────────────────────────────
  const phases = document.createElement('div');
  phases.className = 'thinking__phases';
  PHASES.forEach((label, i) => {
    const el = document.createElement('span');
    el.className = 'thinking__phase' + (i === 0 ? ' is-active' : '');
    el.textContent = label;
    phases.appendChild(el);
  });
  section.appendChild(phases);

  // ── Single main folder card ────────────────────────────────────────────────
  const cardsWrap = document.createElement('div');
  cardsWrap.className = 'thinking__cards';
  const mainCard = createFolderCard({ text: 'On ne cherche\npas ce qui se fait.' });
  mainCard.el.classList.add('thinking__card');
  cardsWrap.appendChild(mainCard.el);
  section.appendChild(cardsWrap);

  // ── Connector line (SVG) ──────────────────────────────────────────────────
  // Dashed line from the orbital / cell centre to the folder-card's circle dot.
  const connSvg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  connSvg.setAttribute('class', 'thinking__connector');
  connSvg.setAttribute('aria-hidden', 'true');
  const connLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  connLine.setAttribute('stroke',           'rgba(255,255,255,0.22)');
  connLine.setAttribute('stroke-width',     '1');
  connLine.setAttribute('stroke-dasharray', '4 6');
  connSvg.appendChild(connLine);
  section.appendChild(connSvg);

  function updateConnector() {
    const sw = section.offsetWidth  || window.innerWidth;
    const sh = section.offsetHeight || window.innerHeight;
    connSvg.setAttribute('width',   sw);
    connSvg.setAttribute('height',  sh);
    connSvg.setAttribute('viewBox', `0 0 ${sw} ${sh}`);

    // Cell / orbital centre = centre of the section
    const cx = sw / 2;
    const cy = sh / 2;

    // Folder-card dot (bottom-right of card)
    const dotEl  = mainCard.el.querySelector('.folder-card__dot');
    if (!dotEl) return;
    const sRect  = section.getBoundingClientRect();
    const dRect  = dotEl.getBoundingClientRect();
    const dx = dRect.left - sRect.left + dRect.width  / 2;
    const dy = dRect.top  - sRect.top  + dRect.height / 2;

    connLine.setAttribute('x1', cx);
    connLine.setAttribute('y1', cy);
    connLine.setAttribute('x2', dx);
    connLine.setAttribute('y2', dy);
  }

  // ── Dot-click popup ────────────────────────────────────────────────────────
  // One shared popup card; repositions to the clicked dot.
  const popup     = document.createElement('div');
  popup.className = 'thinking__popup';
  popup.hidden    = true;
  const popupCard = createFolderCard({ text: 'Placeholder\ncontent.' });
  popup.appendChild(popupCard.el);
  section.appendChild(popup);

  let activeDotIdx = null;

  function closePopup() {
    popup.hidden  = true;
    activeDotIdx  = null;
    dotEls.forEach(({ el }) => el.classList.remove('is-open'));
  }

  function openDot(idx) {
    if (activeDotIdx === idx) { closePopup(); return; }
    activeDotIdx = idx;
    dotEls.forEach(({ el }, i) => el.classList.toggle('is-open', i === idx));

    // Position popup near the dot (in section-relative coords)
    const { x, y } = dotEls[idx];
    const sw = section.offsetWidth  || window.innerWidth;
    const sh = section.offsetHeight || window.innerHeight;
    const ox = sw / 2;   // orbital centre x (section-relative)
    const oy = sh / 2;   // orbital centre y

    const popupW = 211;  // tab 78 + body 187 might overlap, use body width
    const popupH = 200;
    let px = ox + x - popupW / 2;
    let py = oy + y - popupH - 14;  // prefer above the dot

    px = Math.max(8, Math.min(sw - popupW - 8, px));
    py = Math.max(8, Math.min(sh - popupH - 8, py));

    popup.style.left = `${px}px`;
    popup.style.top  = `${py}px`;
    popup.hidden     = false;
  }

  // Wire dot clicks
  dotEls.forEach(({ el }, idx) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); openDot(idx); });
  });

  // Close via the popup card's × button
  popupCard.el
    .querySelector('.folder-card__close')
    ?.addEventListener('click', (e) => { e.stopPropagation(); closePopup(); });

  // Close via click-outside
  section.addEventListener('click', (e) => {
    if (!popup.hidden && !popup.contains(e.target)) closePopup();
  });

  // ── Service panel — dropdowns ──────────────────────────────────────────────
  const services = document.createElement('div');
  services.className = 'thinking__services';

  // Build items and collect their setState fns so toggles can close others
  const serviceItems = SERVICES.map((s, i) => {
    const item   = document.createElement('div');
    item.className = 'thinking__service';

    const tagBtn = document.createElement('button');
    tagBtn.className = 'thinking__service-tag';

    const subEl  = document.createElement('div');
    subEl.className = 'thinking__service-sub';
    s.items.forEach((text) => {
      const span  = document.createElement('span');
      span.className = 'thinking__service-sub-item';
      span.textContent = text;
      subEl.appendChild(span);
    });

    item.appendChild(tagBtn);
    item.appendChild(subEl);
    services.appendChild(item);

    const setState = (open) => {
      tagBtn.textContent = (open ? '>' : '/') + s.tag;
      item.classList.toggle('is-open', open);
    };
    // First item open by default
    setState(i === 0);

    tagBtn.addEventListener('click', () => {
      const wasOpen = item.classList.contains('is-open');
      serviceItems.forEach(({ setState: st }) => st(false));
      if (!wasOpen) setState(true);
    });

    return { item, setState };
  });

  section.appendChild(services);

  // ── Orchestration ──────────────────────────────────────────────────────────
  const lockLight = () => webgl?.shaderPlane?.setProgress(1);

  const reveal = () => {
    section.classList.add('is-visible');
    requestAnimationFrame(updateConnector);
  };

  orchestrator?.onEnter('thinking',    lockLight);
  orchestrator?.onProgress('thinking', lockLight);
  orchestrator?.onEnter('thinking',    reveal);
  orchestrator?.onProgress('thinking', reveal);

  orchestrator?.onLeave('thinking', ({ direction }) => {
    if (direction === 'up') section.classList.remove('is-visible');
  });

  // Reveal if already in view on mount (e.g., direct-navigation)
  requestAnimationFrame(() => {
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) reveal();
    updateConnector();
  });

  window.addEventListener('resize', () => {
    updateConnector();
    if (!popup.hidden && activeDotIdx !== null) openDot(activeDotIdx);
  }, { passive: true });

  return { section };
}
