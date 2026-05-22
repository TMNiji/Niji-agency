// Clients section — 3D fan of glass cards.
//
// Eight cards in two mirrored half-fans facing inward: each pivot is placed on
// a horizontal row and tilted around its own Y axis. Inner cards (closest to
// the centre line) carry the most rotateY, outer cards approach face-on. A
// shared perspective on the stage turns this into a true 3D arrangement —
// hover lifts a card forward (translateZ + Y), clicking opens a centred
// detail panel with logo + caption.

const DEFAULT_TITLE    = 'Grands noms.';
const DEFAULT_SUBTITLE = 'Projets à leur hauteur.';

const DEFAULT_CLIENTS = [
  { name: 'Aurora',    caption: 'Aerospace · Brand refresh 2024' },
  { name: 'Northwind', caption: 'Banking · Digital platform 2023' },
  { name: 'Helios',    caption: 'Energy · Service design 2023' },
  { name: 'Vector',    caption: 'Logistics · Product overhaul 2022' },
  { name: 'Polaris',   caption: 'Telco · Brand system 2024' },
  { name: 'Meridian',  caption: 'Insurance · Customer experience 2023' },
  { name: 'Cobalt',    caption: 'Industry · Design system 2022' },
  { name: 'Solstice',  caption: 'Retail · Omnichannel 2024' },
];

// Fan geometry — symmetric, mirrored around the centre.
const N_PER_SIDE   = 4;
const INNER_GAP    = 28;   // px between the two innermost cards
const STEP_X       = 88;   // horizontal step between adjacent cards
const STEP_ROT_Y   = 11;   // rotateY decrement per step outward (deg)
const INNER_ROT_Y  = 44;   // rotateY of the innermost cards (deg)
const TILT_X       = -4;   // shared backward tilt for cinematic depth (deg)

export function mountClients({ container, title = DEFAULT_TITLE, subtitle = DEFAULT_SUBTITLE, clients = DEFAULT_CLIENTS } = {}) {
  const section = container.querySelector('[data-section="clients"]');
  if (!section) return null;
  section.classList.add('clients');

  const stage = document.createElement('div');
  stage.className = 'clients__stage';
  section.appendChild(stage);

  // ── Title ─────────────────────────────────────────────────────────────────
  const titleEl = document.createElement('div');
  titleEl.className = 'clients__title';
  titleEl.innerHTML = `
    <div class="clients__title-line clients__title-line--small">${title}</div>
    <div class="clients__title-line clients__title-line--large">${subtitle}</div>
  `;
  stage.appendChild(titleEl);

  // ── Fan stage (sits inside a 3D-perspective wrapper) ──────────────────────
  const fan = document.createElement('div');
  fan.className = 'clients__fan';
  stage.appendChild(fan);

  // Soft "spotlight" pool beneath the cards.
  const stand = document.createElement('div');
  stand.className = 'clients__stand';
  stage.appendChild(stand);

  clients.forEach((client, i) => {
    const onLeft        = i < N_PER_SIDE;
    const side          = onLeft ? -1 : 1;
    const idxFromCenter = onLeft ? (N_PER_SIDE - 1 - i) : (i - N_PER_SIDE);
    // idxFromCenter: 0 = innermost, N_PER_SIDE - 1 = outermost

    const x    = side * (INNER_GAP / 2 + idxFromCenter * STEP_X);
    const rotY = -side * (INNER_ROT_Y - idxFromCenter * STEP_ROT_Y);

    const pivot = document.createElement('div');
    pivot.className = 'clients__card-pivot';
    pivot.style.transform = `translate3d(${x}px, 0, 0) rotateY(${rotY}deg) rotateX(${TILT_X}deg)`;
    // Stacking is handled by 3D depth (preserve-3d), but for browsers that
    // collapse the stacking context we hint with a z-index too.
    pivot.style.zIndex = String(100 - idxFromCenter);

    const card = document.createElement('div');
    card.className = 'clients__card';

    const inner = document.createElement('div');
    inner.className = 'clients__card-inner';

    const sheen = document.createElement('div');
    sheen.className = 'clients__card-sheen';
    inner.appendChild(sheen);

    const glow = document.createElement('div');
    glow.className = 'clients__card-glow';
    inner.appendChild(glow);

    const logo = document.createElement('div');
    logo.className = 'clients__card-logo';
    logo.textContent = client.name;
    inner.appendChild(logo);

    card.appendChild(inner);
    pivot.appendChild(card);
    fan.appendChild(pivot);

    pivot.addEventListener('click', () => openDetail(client));
  });

  // ── Detail overlay ────────────────────────────────────────────────────────
  const detail = document.createElement('div');
  detail.className = 'clients__detail';
  detail.hidden = true;
  detail.innerHTML = `
    <div class="clients__detail-backdrop"></div>
    <button class="clients__detail-close" type="button" aria-label="Close">×</button>
    <div class="clients__detail-content">
      <div class="clients__detail-card">
        <div class="clients__detail-card-sheen"></div>
        <div class="clients__detail-card-glow"></div>
        <div class="clients__detail-card-logo"></div>
      </div>
      <div class="clients__detail-text"></div>
    </div>
  `;
  stage.appendChild(detail);

  const detailLogo     = detail.querySelector('.clients__detail-card-logo');
  const detailText     = detail.querySelector('.clients__detail-text');
  const detailBackdrop = detail.querySelector('.clients__detail-backdrop');
  const detailClose    = detail.querySelector('.clients__detail-close');

  let closeTimer = null;

  function openDetail(client) {
    clearTimeout(closeTimer);
    detailLogo.textContent = client?.name ?? '';
    detailText.textContent = client?.caption ?? '';
    detail.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      section.classList.add('is-detail-open');
    }));
  }

  function closeDetail() {
    if (!section.classList.contains('is-detail-open')) return;
    section.classList.remove('is-detail-open');
    closeTimer = setTimeout(() => { detail.hidden = true; }, 420);
  }

  detailBackdrop.addEventListener('click', closeDetail);
  detailClose.addEventListener('click', closeDetail);

  function onKey(e) {
    if (e.key === 'Escape') closeDetail();
  }
  window.addEventListener('keydown', onKey);

  return {
    section,
    destroy() {
      clearTimeout(closeTimer);
      window.removeEventListener('keydown', onKey);
    },
  };
}
