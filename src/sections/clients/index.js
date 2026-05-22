// Clients section — fan of cards.
//
// Cards are laid out as a static fan (hand-of-cards), each rotated around a
// shared pivot point well below the fan's visible centre. Hovering a card
// lifts it radially outward from the pivot to signal interactivity. Clicking
// a card opens a centred detail panel showing the logo larger plus a short
// caption; click the backdrop or press Escape to dismiss.

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

const FAN_ARC = 52; // total angular spread of the fan (degrees)

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

  // ── Fan ───────────────────────────────────────────────────────────────────
  const fan = document.createElement('div');
  fan.className = 'clients__fan';
  stage.appendChild(fan);

  const N    = clients.length;
  const step = N > 1 ? FAN_ARC / (N - 1) : 0;
  const mid  = (N - 1) / 2;

  clients.forEach((client, i) => {
    const angle = -FAN_ARC / 2 + i * step;
    const pivot = document.createElement('div');
    pivot.className = 'clients__card-pivot';
    pivot.style.transform = `rotate(${angle}deg)`;
    // Outer cards sit lower in the stack so the middle one is on top.
    pivot.style.zIndex = String(100 - Math.round(Math.abs(i - mid)));

    const card = document.createElement('div');
    card.className = 'clients__card';

    const inner = document.createElement('div');
    inner.className = 'clients__card-inner';

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
    // Double rAF so the opacity/transform transition actually fires.
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
