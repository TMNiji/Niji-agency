// Clients section — cards flowing along a diagonal "river" in 3D.
//
// The cards are arranged along a single diagonal axis: receding cards step
// up-and-right into the distance (smaller, dimmer), the focused card sits at
// the sweet spot near centre, and passed cards slide down-and-left toward the
// camera as they exit. Every card is held at an angle (rotateY) so the row
// reads like a deck seen from the side; the focused card straightens to
// "present" itself and reveals its label.
//
// Scroll progress (0 → 1) advances the river one card at a time. Mouse movement
// applies a soft parallax tilt to the whole stack, revealing the depth of the
// diagonal from a slight angle.

import { gsap } from 'gsap';
import { prefersReducedMotion } from '@modules/motion.js';

const DEFAULT_TITLE    = 'Grands noms.';
const DEFAULT_SUBTITLE = 'Projets à leur hauteur.';

const DEFAULT_CLIENTS = [
  { name: 'Grand Frais', caption: 'Retail · Brand refresh 2024', logo: '/logo/grand_frais_grey.svg' },
  { name: 'Northwind', caption: 'Banking · Digital platform 2023' },
  { name: 'Helios',    caption: 'Energy · Service design 2023' },
  { name: 'Vector',    caption: 'Logistics · Product overhaul 2022' },
  { name: 'Polaris',   caption: 'Telco · Brand system 2024' },
  { name: 'Meridian',  caption: 'Insurance · Customer experience 2023' },
  { name: 'Cobalt',    caption: 'Industry · Design system 2022' },
  { name: 'Solstice',  caption: 'Retail · Omnichannel 2024' },
];

// Diagonal river geometry. Each unit of `rel` (distance from the focused card)
// steps the card along the diagonal: right + up + into the screen.
const DIAG_X     = 150;   // px to the right per card receding into the queue
const DIAG_Y     = 96;    // px upward per card receding (applied as -y)
const Z_GAP      = 150;   // px into the screen per card receding
const Z_FRONT    = 300;   // px toward the camera per card once it has passed
const Z_RANGE    = 950;   // depth over which upcoming cards fade in
const EXIT_SPAN  = 1.35;  // rel units over which a passed card fades out
const ROT_Y      = 32;    // deg — base deck angle (cards seen at a slant)
const STRAIGHTEN = 0.55;  // fraction the focused card straightens toward camera

// Mouse parallax
const MOUSE_LERP = 0.08;
const ROT_Y_MAX  = 7;     // deg of stack rotateY at mouseX = ±1
const ROT_X_MAX  = 4;     // deg of stack rotateX at mouseY = ±1

export function mountClients({ container, orchestrator, title = DEFAULT_TITLE, subtitle = DEFAULT_SUBTITLE, clients = DEFAULT_CLIENTS } = {}) {
  const section = container.querySelector('[data-section="clients"]');
  if (!section) return null;
  section.classList.add('clients');

  // Hoisted to <body> (not the section) so its z-index:9995 escapes #app's
  // stacking context and sits above the #noise overlay — the cards stay crisp
  // while the WebGL river background behind them keeps its grain.
  const stage = document.createElement('div');
  stage.className = 'clients__stage';
  document.body.appendChild(stage);

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

    if (client.logo) {
      const img = document.createElement('img');
      img.className = 'clients__card-image';
      img.src = client.logo;
      img.alt = client.name;
      img.loading = 'lazy';
      inner.appendChild(img);
    }

    const logo = document.createElement('div');
    logo.className = 'clients__card-logo';
    logo.textContent = client.name;
    inner.appendChild(logo);

    card.appendChild(inner);
    pivot.appendChild(card);
    stack.appendChild(pivot);

    return { el: pivot, logo, index: i };
  });

  // ── Per-frame state ───────────────────────────────────────────────────────
  let scrollProgress = 0;
  let targetMouseX = 0, targetMouseY = 0;
  let curMouseX    = 0, curMouseY    = 0;

  orchestrator?.onProgress('clients', ({ progress }) => {
    scrollProgress = progress;
  });

  function onPointerMove(e) {
    const rect = stage.getBoundingClientRect();
    targetMouseX = ((e.clientX - rect.left) / rect.width)  * 2 - 1; // -1..1
    targetMouseY = ((e.clientY - rect.top)  / rect.height) * 2 - 1; // -1..1
  }
  function onPointerLeave() { targetMouseX = 0; targetMouseY = 0; }

  // Listen on the stage (the section is now just a scroll spacer; the stage is
  // the full-viewport, body-level layer that actually holds the cards).
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerleave', onPointerLeave);

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

    cards.forEach(({ el, logo, index }) => {
      // rel < 0 → already passed; rel = 0 → in focus; rel > 0 → upcoming.
      const rel = index - focusedIdx;

      // Position along the diagonal: receding cards step up-and-right into the
      // distance; passed cards drift down-and-left toward the camera.
      const x = rel * DIAG_X;
      const y = -rel * DIAG_Y;
      const z = rel >= 0 ? -rel * Z_GAP : -rel * Z_FRONT;

      // The focused card straightens toward the viewer to present itself.
      const focusAmt = Math.max(0, 1 - Math.abs(rel)); // 1 at focus → 0 a card away
      const rotY = ROT_Y * (1 - focusAmt * STRAIGHTEN);

      let opacity;
      if (rel >= 0) {
        // Upcoming / at focus: fade in with proximity to the camera.
        opacity = Math.max(0.03, Math.min(1, 1 + z / Z_RANGE));
      } else {
        // Passed: fade out over a fraction of a card's scroll as it sweeps past.
        opacity = Math.max(0, 1 + rel / EXIT_SPAN);
      }

      el.style.transform =
        `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) ` +
        `rotateY(${rotY.toFixed(2)}deg)`;
      el.style.opacity = opacity.toFixed(3);
      // Only the visible card receives the pointer (for the hover lift).
      el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';

      // Label reads in only as the card settles into focus.
      logo.style.opacity = (focusAmt * focusAmt).toFixed(3);
    });
  }

  // Only animate while the section is on screen — main.js toggles this on
  // clients enter/leave so the stack stops costing frames elsewhere.
  let active = false;
  function setActive(on) {
    if (on === active) return;
    active = on;
    stage.classList.toggle('is-visible', on);
    if (on) gsap.ticker.add(update);
    else    gsap.ticker.remove(update);
  }

  return {
    section,
    setActive,
    destroy() {
      setActive(false);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.remove();
    },
  };
}
