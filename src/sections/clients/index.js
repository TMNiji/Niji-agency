// Clients section — cards stacked along the Z axis, cycling on scroll.
//
// Eight cards are arranged one behind the other in 3D. Scroll progress
// (0 → 1) maps to a fractional "focused index" across the queue: at any
// scroll position the matching card sits at z=0 (in focus, fully lit), the
// cards still upcoming are stacked behind it (z negative, dim by depth),
// and the cards already passed lift upward and fade out as they exit toward
// the camera. As the user scrolls, the queue advances one card at a time.
//
// Mouse movement applies a soft parallax tilt to the whole stack (rotateY +
// rotateX), revealing the depth of the upcoming queue from a slight angle.
// Clicking any visible card opens the centred detail panel with logo +
// caption.

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

// Stack geometry
const Z_GAP        = 110;   // px between adjacent cards along Z
const X_GAP        = 24;    // px each card offsets sideways (so the stack reads)
const TRAVEL_START = 1100;  // distance the front card starts pushed back (px)
const Z_RANGE      = 1100;  // distance over which opacity rises from 0 → 1

// Mouse parallax
const MOUSE_LERP   = 0.08;
const ROT_Y_MAX    = 9;     // deg of stack rotateY at mouseX = ±1
const ROT_X_MAX    = 4;     // deg of stack rotateX at mouseY = ±1

export function mountClients({ container, orchestrator, title = DEFAULT_TITLE, subtitle = DEFAULT_SUBTITLE, clients = DEFAULT_CLIENTS } = {}) {
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

  // ── Stack — 3D container ──────────────────────────────────────────────────
  const stack = document.createElement('div');
  stack.className = 'clients__stack';
  stage.appendChild(stack);

  const N = clients.length;
  const cards = clients.map((client, i) => {
    const pivot = document.createElement('div');
    pivot.className = 'clients__card-pivot';

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
    stack.appendChild(pivot);

    pivot.addEventListener('click', () => openDetail(client));
    return { el: pivot, index: i };
  });

  // ── Per-frame state ───────────────────────────────────────────────────────
  let scrollProgress = 0;
  let targetMouseX = 0, targetMouseY = 0;
  let curMouseX    = 0, curMouseY    = 0;
  let rafId = 0;

  orchestrator?.onProgress('clients', ({ progress }) => {
    scrollProgress = progress;
  });

  function onPointerMove(e) {
    const rect = section.getBoundingClientRect();
    targetMouseX = ((e.clientX - rect.left) / rect.width)  * 2 - 1; // -1..1
    targetMouseY = ((e.clientY - rect.top)  / rect.height) * 2 - 1; // -1..1
  }
  function onPointerLeave() { targetMouseX = 0; targetMouseY = 0; }

  section.addEventListener('pointermove', onPointerMove);
  section.addEventListener('pointerleave', onPointerLeave);

  // Symmetric X offsets so the stack reads as a centred queue.
  const xCenterOffset = (N - 1) * X_GAP / 2;

  function update() {
    curMouseX += (targetMouseX - curMouseX) * MOUSE_LERP;
    curMouseY += (targetMouseY - curMouseY) * MOUSE_LERP;

    stack.style.transform =
      `rotateY(${(curMouseX * ROT_Y_MAX).toFixed(2)}deg) ` +
      `rotateX(${(-curMouseY * ROT_X_MAX).toFixed(2)}deg)`;

    // travelZ = -(1 - progress) * TRAVEL_START
    //   progress=0 → travelZ = -TRAVEL_START   (stack deep in darkness)
    //   progress=1 → travelZ = 0               (front card at z=0)
    const travelZ = -(1 - scrollProgress) * TRAVEL_START;

    cards.forEach(({ el, index }) => {
      const baseZ = -index * Z_GAP;
      const z     = baseZ + travelZ;
      const x     = index * X_GAP - xCenterOffset;

      // Opacity rises linearly with Z distance to the camera (z=0 plane).
      // Clamp to a tiny minimum so the card silhouette never fully disappears
      // even at the deepest end of the stack.
      const opacity = Math.max(0.03, Math.min(1, 1 + z / Z_RANGE));

      el.style.transform = `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px)`;
      el.style.opacity   = opacity.toFixed(3);
      // Keep deep cards from intercepting pointer events meant for visible ones.
      el.style.pointerEvents = opacity > 0.2 ? 'auto' : 'none';
    });

    rafId = requestAnimationFrame(update);
  }
  rafId = requestAnimationFrame(update);

  // ── Detail overlay (unchanged behaviour) ──────────────────────────────────
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

  function onKey(e) { if (e.key === 'Escape') closeDetail(); }
  window.addEventListener('keydown', onKey);

  return {
    section,
    destroy() {
      cancelAnimationFrame(rafId);
      clearTimeout(closeTimer);
      section.removeEventListener('pointermove', onPointerMove);
      section.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('keydown', onKey);
    },
  };
}
