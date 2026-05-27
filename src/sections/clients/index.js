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

import { gsap } from 'gsap';
import { prefersReducedMotion } from '@modules/motion.js';

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
const Z_GAP      = 140;   // px between adjacent cards along Z
const Z_RANGE    = 720;   // depth fade-out distance for upcoming cards
const X_PEEK     = 14;    // px each upcoming card offsets sideways (so the stack reads)
const X_PEEK_CAP = 4;     // cap the lateral offset after this many cards back
const EXIT_Y     = 90;    // px a passed card lifts upward per unit of `rel`
const EXIT_FADE  = 2.5;   // 1/EXIT_FADE = fraction of one card's scroll over which a passed card fades

// Mouse parallax
const MOUSE_LERP = 0.08;
const ROT_Y_MAX  = 9;     // deg of stack rotateY at mouseX = ±1
const ROT_X_MAX  = 4;     // deg of stack rotateX at mouseY = ±1

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

  function update() {
    // Reduced motion: no mouse-driven parallax tilt (the scroll-driven card
    // cycling stays — it's user-controlled content, not gratuitous motion).
    const tiltScale = prefersReducedMotion() ? 0 : 1;
    curMouseX += (targetMouseX - curMouseX) * MOUSE_LERP;
    curMouseY += (targetMouseY - curMouseY) * MOUSE_LERP;

    stack.style.transform =
      `rotateY(${(curMouseX * ROT_Y_MAX * tiltScale).toFixed(2)}deg) ` +
      `rotateX(${(-curMouseY * ROT_X_MAX * tiltScale).toFixed(2)}deg)`;

    // Fractional index of the card currently in focus.
    //   progress=0 → focusedIdx=0       (card 0 in focus)
    //   progress=1 → focusedIdx=N-1     (last card in focus)
    // Smootherstep within each step makes the focus "linger" near the integer
    // positions, so each card has a clear "in focus" beat before the next one
    // takes its place — rather than the index sliding linearly through.
    const totalSteps = N - 1;
    const stepProg   = scrollProgress * totalSteps;
    const stepIdx    = Math.floor(stepProg);
    const stepFrac   = Math.min(1, Math.max(0, stepProg - stepIdx));
    const ease       = stepFrac * stepFrac * stepFrac * (stepFrac * (stepFrac * 6 - 15) + 10);
    const focusedIdx = Math.min(totalSteps, stepIdx + ease);

    cards.forEach(({ el, index }) => {
      // rel < 0 → already passed; rel = 0 → in focus; rel > 0 → upcoming.
      const rel = index - focusedIdx;

      // Z: focused card at 0, upcoming stacked behind.
      // Passed cards stay at z=0 (no perspective growth) — they exit via Y + opacity.
      const z = -Math.max(0, rel) * Z_GAP;
      // Passed cards drift upward as they exit.
      const y = rel < 0 ? rel * EXIT_Y : 0;
      // Upcoming cards peek sideways so the queue silhouette reads.
      const x = Math.max(0, Math.min(X_PEEK_CAP, rel)) * X_PEEK;

      let opacity;
      if (rel >= 0) {
        // Behind / at focus: opacity rises with Z distance to camera.
        opacity = Math.max(0.04, Math.min(1, 1 + z / Z_RANGE));
      } else {
        // Already passed: fade out quickly over a fraction of one card's scroll.
        opacity = Math.max(0, 1 + rel * EXIT_FADE);
      }

      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px)`;
      el.style.opacity   = opacity.toFixed(3);
      // Only the card(s) the user can actually see should receive clicks.
      el.style.pointerEvents = opacity > 0.3 ? 'auto' : 'none';
    });
  }

  // Only animate while the section is on screen — main.js toggles this on
  // clients enter/leave so the 8-card stack stops costing frames elsewhere.
  let active = false;
  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) gsap.ticker.add(update);
    else    gsap.ticker.remove(update);
  }

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
    setActive,
    destroy() {
      setActive(false);
      clearTimeout(closeTimer);
      section.removeEventListener('pointermove', onPointerMove);
      section.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('keydown', onKey);
    },
  };
}
