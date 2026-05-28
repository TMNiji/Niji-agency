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
import { createTitle } from '../hero/title.js';

const DEFAULT_TITLE    = 'Grands noms.';
const DEFAULT_SUBTITLE = 'Projets à leur hauteur.';

// Each client has a `type` (project category — shown on the front in place of
// the legacy name) and a `back` describing what flips into view on click:
//   - 'qr':   render a QR pointing to `url` (case-study link)
//   - 'text': render `blurb` as a short project description
// QR codes are generated via the QR-Server API (no extra dependency).
// Each client carries an `accent` hex sampled from its logo's dominant colour
// (or, when no real logo exists yet, a sector-appropriate stand-in). The card
// chrome reads it via the --card-accent CSS variable so the glow + tint matches
// the brand instead of every card sharing the same purple/blue.
const DEFAULT_CLIENTS = [
  { type: 'SaaS',           back: 'qr',   url: 'https://niji.fr/case/grand-frais', logo: '/logo/grand_frais_grey.svg', accent: '#2EA84A' },
  { type: 'Mobile App',     back: 'text', blurb: 'Native iOS / Android · 2023 launch · 1.2M users',           accent: '#3DA9FC' },
  { type: 'B2B Platform',   back: 'qr',   url: 'https://niji.fr/case/northwind',                              accent: '#5B6CFF' },
  { type: 'E-commerce',     back: 'text', blurb: 'Headless commerce · Composable stack · +38% AOV',           accent: '#FF7A45' },
  { type: 'Brand System',   back: 'qr',   url: 'https://niji.fr/case/polaris',                                accent: '#F4C95D' },
  { type: 'Service Design', back: 'text', blurb: 'Journey re-mapping · 12 personas · NPS +27',                accent: '#FF5FA2' },
  { type: 'Data Platform',  back: 'qr',   url: 'https://niji.fr/case/cobalt',                                 accent: '#22B5C1' },
  { type: 'Internal Tool',  back: 'text', blurb: 'Ops dashboard · 8 teams · 4× faster onboarding',            accent: '#A86BFF' },
];

// Diagonal river geometry. Each unit of `rel` (distance from the focused card)
// steps the card along the diagonal: right + up + into the screen.
const DIAG_X     = 190;   // px to the right per card receding into the queue
const DIAG_Y     = 150;   // px upward per card receding (applied as -y)
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

  // ── Title — uses the shared createTitle so the section enter/leave can
  //          glitch it in/out exactly like the hero title's shatter, instead
  //          of the previous plain opacity fade.
  const titleHandle = createTitle({
    baseClass: 'clients-title',
    tag: 'div',
    lines: [
      { text: title,    cls: 'clients-title__line--small' },
      { text: subtitle, cls: 'clients-title__line--large' },
    ],
    // No glyph swap — clean RGB-split flicker only (the burst spawn pulses the
    // is-glitch class so the CSS chromatic-aberration keyframe fires).
    glitchFontClasses: [],
    glitchDuration: 0,
  });
  titleHandle.el.classList.add('clients__title');
  stage.appendChild(titleHandle.el);

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
    // Per-client accent — read by .clients__card-glow / .clients__card-inner
    // in clients.css so each card's tint and glow match its logo's brand color.
    if (client.accent) card.style.setProperty('--card-accent', client.accent);

    // Flipper — preserve-3d wrapper that rotateY()s 180deg on .is-flipped so
    // the back face swings into view on click. Front + back share the same
    // glass chrome (.clients__card-inner) so the card stays consistent through
    // the flip, only the content payload swaps.
    const flipper = document.createElement('div');
    flipper.className = 'clients__card-flipper';

    // ── Front face ────────────────────────────────────────────────────────
    const front = document.createElement('div');
    front.className = 'clients__card-inner clients__card-face clients__card-face--front';

    const sheen = document.createElement('div');
    sheen.className = 'clients__card-sheen';
    front.appendChild(sheen);

    const glow = document.createElement('div');
    glow.className = 'clients__card-glow';
    front.appendChild(glow);

    if (client.logo) {
      const img = document.createElement('img');
      img.className = 'clients__card-image';
      img.src = client.logo;
      img.alt = client.type;
      img.loading = 'lazy';
      front.appendChild(img);
    }

    const logo = document.createElement('div');
    logo.className = 'clients__card-logo';
    logo.textContent = client.type;
    front.appendChild(logo);

    // ── Back face ────────────────────────────────────────────────────────
    const back = document.createElement('div');
    back.className = `clients__card-inner clients__card-face clients__card-face--back clients__card-face--${client.back}`;

    if (client.back === 'qr' && client.url) {
      const qr = document.createElement('img');
      qr.className = 'clients__card-qr';
      // QR-Server is a stable, public QR endpoint — swap for a bundled
      // generator later if offline rendering becomes a requirement.
      const encoded = encodeURIComponent(client.url);
      qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encoded}`;
      qr.alt = `QR · ${client.type}`;
      qr.loading = 'lazy';
      back.appendChild(qr);

      const qrLabel = document.createElement('div');
      qrLabel.className = 'clients__card-back-label';
      qrLabel.textContent = 'Scan for case study';
      back.appendChild(qrLabel);
    } else {
      const blurb = document.createElement('p');
      blurb.className = 'clients__card-blurb';
      blurb.textContent = client.blurb ?? '';
      back.appendChild(blurb);

      const tag = document.createElement('div');
      tag.className = 'clients__card-back-label';
      tag.textContent = client.type;
      back.appendChild(tag);
    }

    flipper.appendChild(front);
    flipper.appendChild(back);
    card.appendChild(flipper);
    pivot.appendChild(card);
    stack.appendChild(pivot);

    // Toggle the 3D rotateY flip on click. Pivot-level pointer-events are
    // gated to the focused card by the per-frame update loop below, so only
    // the centred card responds — passed/queued cards stay inert.
    // stopPropagation so the click doesn't bubble to document handlers that
    // could close popups or scroll-anchor the page.
    pivot.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      card.classList.toggle('is-flipped');
    });

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

    // Fractional index of the card currently in focus — linear so scrolling
    // tracks the river 1:1. Spans N + 1 so by progress=1 the LAST card has
    // also passed the focus point and slid into the exit (rel < 0), clearing
    // the stage before awards takes over.
    //   progress=0           → focusedIdx=-1   (first card waiting upper-right)
    //   progress=1/(N+1)     → focusedIdx=0    (first card in focus)
    //   progress=N/(N+1)     → focusedIdx=N-1  (last card in focus)
    //   progress=1           → focusedIdx=N    (last card passed)
    const focusedIdx = scrollProgress * (N + 1) - 1;

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

      // Depth-of-field blur — upcoming cards (rel > 0) read blurry until
      // they approach focus (rel → 0). Passed cards (rel < 0) stay sharp:
      // they're already opacity-fading off the bottom-left exit, so layering
      // blur on top would muddy the read-out.
      const blurPx = rel > 0 ? Math.min(rel * 2.6, 12) : 0;
      el.style.setProperty('--card-blur', `${blurPx.toFixed(2)}px`);

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
    if (on) {
      gsap.ticker.add(update);
      titleHandle.glitchIn(0.7);
    } else {
      gsap.ticker.remove(update);
      titleHandle.glitchOut(0.4);
      // The per-frame loop sets `el.style.pointerEvents = 'auto'` on whichever
      // card is currently focused, and the loop stops here without a final
      // pass to clear it. Without this reset the focused-card pivot keeps
      // pointer-events:auto and (sitting at body level, z 9995) keeps
      // capturing clicks over the contact section's AI bar.
      cards.forEach(({ el }) => { el.style.pointerEvents = 'none'; });
    }
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
