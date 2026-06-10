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
import { openCaseOverlay } from '@modules/caseOverlay.js';
import { createTitle } from '../hero/title.js';
import { asset } from '@/lib/asset.js';

// Resolve the verso CTA for a client from its case URL — both the visible label
// and whether the click opens the in-page 16:9 overlay or just leaves the site.
//   App store links  → "Télécharger l'app", external redirect
//   Vimeo cases      → "Voir le case study", overlay (embedded player)
//   Everything else  → "Voir le site",       external redirect (sites block
//                       iframe embedding, so we open them in a new tab)
function ctaConfig(caseUrl) {
  const url = safeExternalUrl(caseUrl);
  if (!url) return null;
  let host = '';
  try { host = new URL(url).hostname; } catch (_) {}
  if (/(^|\.)(apps\.apple\.com|play\.google\.com)$/.test(host)) {
    return { url, label: "Télécharger l'app", overlay: false };
  }
  if (/(^|\.)vimeo\.com$/.test(host)) {
    return { url, label: 'Voir le case study', overlay: true };
  }
  return { url, label: 'Voir le site', overlay: false };
}

// Build the verso CTA — a bordered pill with a label + arrow. Replaces the old
// fixed-text button.svg so the label can vary per client, and routes the click
// to the overlay (Vimeo / site preview) unless it's a store download link.
function makeCta(caseUrl, brandName) {
  const cfg = ctaConfig(caseUrl);
  if (!cfg) return null;
  const cta = document.createElement('a');
  cta.className = 'clients__card-cta';
  cta.href = cfg.url;
  cta.setAttribute('aria-label', `${cfg.label} ${brandName}`.trim());
  cta.innerHTML = `<span class="clients__card-cta-label"></span>` +
    `<svg class="clients__card-cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
  cta.querySelector('.clients__card-cta-label').textContent = cfg.label;
  if (cfg.overlay) {
    cta.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCaseOverlay(cfg.url, brandName);
    });
  } else {
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
  }
  return cta;
}

// Validate an external URL before turning it into a click target. Same shape
// as aiLinks.js — we don't export there because keeping the helper local
// makes the file self-contained.
function safeExternalUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch (_) {
    return null;
  }
}

const DEFAULT_TITLE    = 'Quelques grands noms qui nous font confiance';
const DEFAULT_SUBTITLE = 'Des produits à leur hauteur';

// Per-client shape:
//   name        Brand name — used for alt text + back-face label
//   logo        Path to brand asset (in /public/logo). Falls back to the
//               frontLabel text if the file is missing.
//   frontLabel  Project / engagement text shown under the logo on the recto
//   back        What flips into view on click:
//                 'qr'    → QR code (qrSvg) + "Voir le case study" button
//                 'image' → Screenshot at `image` path (in /public/clients)
//                 'text'  → Short text `blurb` (multi-line via \n)
//   qrSvg       Pre-rendered QR SVG path (in /public/clients/qr).
//   caseUrl     Click-target for the "Voir le case study" button (Vimeo etc.).
//   accent      Brand hex sampled from the logo's dominant colour. Read by
//               .clients__card-glow / .clients__card-inner via --card-accent
//               so each card's tint and glow match its brand.
const DEFAULT_CLIENTS = [
  // 1. Lacoste — 1ère app m-commerce / screenshot
  {
    name: 'Lacoste',
    logo: '/logo/lacoste.svg',
    logoScale: 1.5, // wide wordmark — enlarge past the default 48.6% card width
    frontLabel: '1ère app m-commerce',
    back: 'image',
    image: '/clients/screenshots/lacoste.webp',
    accent: '#00563F',
  },
  // 2. Grand Frais — 1ère app m-commerce / screenshot
  {
    name: 'Grand Frais',
    logo: '/logo/grand_frais_grey.svg',
    frontLabel: '1ère app m-commerce',
    back: 'image',
    image: '/clients/screenshots/grand-frais.webp',
    caseUrl: 'https://apps.apple.com/fr/app/grand-frais/id6753673412',
    accent: '#2EA84A',
  },
  // 3. Aromazone — App & Commerce / Product & Experience
  {
    name: 'Aromazone',
    logo: '/logo/aromazone.svg',
    logoScale: 1.5, // wide wordmark — enlarge past the default 48.6% card width
    frontLabel: 'App & Commerce',
    back: 'text',
    blurb: 'Product & Experience',
    accent: '#4A3428',
  },
  // 4. Orange — Experience / "Design Partenaire depuis 10 ans"
  {
    name: 'Orange',
    logo: '/logo/orange.png',
    frontLabel: 'Experience',
    back: 'text',
    blurb: 'Design, Experience, B2C, B2B\nPartenaire depuis 10 ans',
    accent: '#FF7900',
  },
  // 5. Relais & Châteaux — Plateforme de marque & Ecosystème digital / QR + Vimeo
  {
    name: 'Relais & Châteaux',
    logo: '/logo/relais-chateaux.png',
    frontLabel: 'Plateforme de marque & Ecosystème digital',
    back: 'qr',
    qrSvg: '/clients/qr/relais-chateaux.svg',
    caseUrl: 'https://vimeo.com/842443761/4551f51afc?share=copy&fl=sv&fe=ci',
    accent: '#7A1A2F',
  },
  // 6. Arte — Plateforme digitale / Product & Experience
  {
    name: 'Arte',
    logo: '/logo/arte.svg',
    frontLabel: 'Plateforme digitale',
    back: 'text',
    blurb: 'Product & Experience',
    accent: '#FF4E00',
  },
  // 7. Decathlon — Application métiers / 8 ans
  {
    name: 'Decathlon',
    logo: '/logo/decathlon.svg',
    frontLabel: 'Application métiers',
    back: 'text',
    blurb: 'Partenaire depuis 8 ans',
    accent: '#0082C3',
  },
  // 8. Accor — Site Corporate / screenshot
  {
    name: 'Accor',
    logo: '/logo/accor.png',
    frontLabel: 'Site Corporate',
    back: 'image',
    image: '/clients/screenshots/accor.webp',
    caseUrl: 'https://group.accor.com/fr',
    accent: '#C9A14D',
  },
  // 9. BNP Paribas — Design System / Partenaire depuis 9 ans
  {
    name: 'BNP Paribas',
    logo: '/logo/bnp-paribas.png',
    frontLabel: 'Design System. Partenaire depuis 9 ans.',
    back: 'text',
    blurb: 'Partenaire depuis 9 ans',
    accent: '#008855',
  },
  // 10. Ritz — Ecosystème digital / QR + Vimeo
  {
    name: 'Ritz',
    logo: '/logo/ritz.png',
    frontLabel: 'Ecosystème digital',
    back: 'qr',
    qrSvg: '/clients/qr/ritz.svg',
    caseUrl: 'https://vimeo.com/911295072/ad02f28185?share=copy&fl=sv&fe=ci',
    accent: '#1F2A44',
  },
  // 11. RATP — 1er site web eco-conçu et accessible / QR + Vimeo
  {
    name: 'RATP',
    logo: '/logo/ratp.webp',
    frontLabel: '1er site web eco-conçu et accessible',
    back: 'qr',
    qrSvg: '/clients/qr/ratp.svg',
    caseUrl: 'https://vimeo.com/911295002/cabba31990?share=copy&fl=sv&fe=ci',
    accent: '#008C53',
  },
  // 12. Groupe Bel — Site Groupe / screenshot
  {
    name: 'Groupe Bel',
    logo: '/logo/groupe-bel.png',
    frontLabel: 'Site Groupe',
    back: 'image',
    image: '/clients/screenshots/bel.webp',
    caseUrl: 'https://www.groupe-bel.com',
    accent: '#E60028',
  },
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
const BLUR_START = 0.6;   // rel units of fully-sharp range around focus before DoF blur

// Mouse parallax
const MOUSE_LERP = 0.08;
const ROT_Y_MAX  = 7;     // deg of stack rotateY at mouseX = ±1
const ROT_X_MAX  = 4;     // deg of stack rotateX at mouseY = ±1

// Map a CMS client (Sanity image objects) onto the internal shape the renderer
// expects (flat URL strings). Falls through any plain string fields untouched
// so a partially-filled CMS entry still renders.
function fromCms(c) {
  return {
    name:       c.name,
    logo:       c.logo?.asset?.url  ?? c.logo,
    frontLabel: c.frontLabel,
    back:       c.back,
    image:      c.image?.asset?.url ?? c.image,
    qrSvg:      c.qr?.asset?.url    ?? c.qrSvg,
    blurb:      c.blurb,
    caseUrl:    c.caseUrl,
    accent:     c.accent,
  };
}

export function mountClients({ container, orchestrator, content = null } = {}) {
  const title    = content?.title    ?? DEFAULT_TITLE;
  const subtitle = content?.subtitle ?? DEFAULT_SUBTITLE;
  const clients  = (content?.list?.length ? content.list.map(fromCms) : DEFAULT_CLIENTS)
    // Ritz is hidden for now — drop it whether the list comes from the CMS or
    // the hardcoded defaults. Remove this filter to bring the card back.
    .filter((c) => c.name?.toLowerCase() !== 'ritz');
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
      { text: subtitle, cls: 'clients-title__line--large' },
      { text: title,    cls: 'clients-title__line--small' },
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
    pivot.setAttribute('role', 'button');
    pivot.setAttribute('tabindex', '0');
    pivot.setAttribute('aria-pressed', 'false');

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

    // Brand name used for alt text + back-face label.
    const brandName  = client.name       ?? '';
    const frontLabel = client.frontLabel ?? '';

    if (client.logo) {
      const img = document.createElement('img');
      img.className = 'clients__card-image';
      img.src = asset(client.logo);
      img.alt = brandName;
      img.loading = 'lazy';
      // Optional per-client size override (base width is 48.6% — see clients.css).
      if (client.logoScale) img.style.width = `${(48.6 * client.logoScale).toFixed(1)}%`;
      front.appendChild(img);
    }

    // Front text label — only created when the client actually has one.
    // Cards like Relais & Châteaux are logo-only and skip this entirely so the
    // recto doesn't reserve vertical space for a label that doesn't exist.
    const logo = document.createElement('div');
    logo.className = 'clients__card-logo';
    if (frontLabel) {
      logo.textContent = frontLabel;
      front.appendChild(logo);
    }

    // ── Back face ────────────────────────────────────────────────────────
    const back = document.createElement('div');
    back.className = `clients__card-inner clients__card-face clients__card-face--back clients__card-face--${client.back}`;

    if (client.back === 'qr' && client.qrSvg) {
      const qr = document.createElement('img');
      qr.className = 'clients__card-qr';
      // Pre-rendered SVG QR provided in /public/clients/qr/*.svg.
      qr.src = asset(client.qrSvg);
      qr.alt = `QR · ${brandName}`;
      qr.loading = 'lazy';
      back.appendChild(qr);

      // Verso CTA — label + behaviour derived from the case URL (see makeCta).
      const cta = makeCta(client.caseUrl, brandName);
      if (cta) back.appendChild(cta);
    } else if (client.back === 'image' && client.image) {
      const shot = document.createElement('img');
      shot.className = 'clients__card-screenshot';
      shot.src = asset(client.image);
      shot.alt = `${brandName} — capture d'écran`;
      shot.loading = 'lazy';
      back.appendChild(shot);

      // Verso CTA — label + behaviour derived from the case URL (see makeCta).
      // When there's no case URL, fall back to showing the brand label.
      const cta = makeCta(client.caseUrl, brandName);
      if (cta) {
        back.appendChild(cta);
      } else {
        const tag = document.createElement('div');
        tag.className = 'clients__card-back-label';
        tag.textContent = brandName;
        back.appendChild(tag);
      }
    } else {
      const blurb = document.createElement('p');
      blurb.className = 'clients__card-blurb';
      blurb.textContent = client.blurb ?? '';
      back.appendChild(blurb);

      const tag = document.createElement('div');
      tag.className = 'clients__card-back-label';
      tag.textContent = brandName;
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
    // Exception: clicks on the "Voir le case study" CTA must reach the anchor
    // so the browser opens the Vimeo link. Returning early there leaves the
    // anchor's default behaviour intact.
    if (brandName) pivot.setAttribute('aria-label', brandName);
    const flip = () => {
      const flipped = card.classList.toggle('is-flipped');
      pivot.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    };
    pivot.addEventListener('click', (e) => {
      if (e.target.closest('.clients__card-cta')) return;
      e.stopPropagation();
      e.preventDefault();
      flip();
    });
    pivot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('.clients__card-cta')) return;
        e.preventDefault();
        e.stopPropagation();
        flip();
      }
    });

    return { el: pivot, logo, index: i };
  });

  // Last-written discrete state per card, so the update loop only touches the
  // DOM for pointer-events / tabindex / blur when they actually change (they
  // stay constant for most of the scroll, unlike transform/opacity).
  const cardState = cards.map(() => ({ interactable: null, blur: NaN }));

  // ── Per-frame state ───────────────────────────────────────────────────────
  let scrollProgress = 0;
  let targetMouseX = 0, targetMouseY = 0;
  let curMouseX    = 0, curMouseY    = 0;

  // Pre-roll scroll position used during the preview (while the prior video
  // section is still on screen). Negative and deep enough (~5 steps up-right of
  // the progress-0 resting spot) that the lead card sits past the depth-fade
  // floor — so the stack reads as invisible while parked and only sweeps into
  // view as the preview glides toward 0, instead of lingering on screen for the
  // whole video section.
  const PREVIEW_START = -7 / (N + 1);

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
    // On phones the per-card label is held constant instead of fading in/out as
    // the river cycles (it just rides the card's own opacity). Matches the 600px
    // phone breakpoint in clients.css.
    const phone = window.innerWidth <= 600;
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
      const st = cardState[index];
      // Only the visible card receives the pointer (for the hover lift) and is
      // reachable by keyboard, so Tab doesn't cycle through 10 stacked cards.
      const interactable = opacity > 0.5;
      if (interactable !== st.interactable) {
        st.interactable = interactable;
        el.style.pointerEvents = interactable ? 'auto' : 'none';
        el.setAttribute('tabindex', interactable ? '0' : '-1');
      }

      // Depth-of-field blur — upcoming cards (rel > 0) read blurry until
      // they approach focus (rel → 0). A sharp dead-zone (rel ≤ BLUR_START)
      // keeps the card crisp as it passes through the centre of the screen;
      // the blur only kicks in for cards further back in the queue and ramps
      // gently from there. Passed cards (rel < 0) stay sharp.
      const blurPx = rel > BLUR_START ? Math.min((rel - BLUR_START) * 1.7, 6) : 0;
      const blurR = Math.round(blurPx * 100) / 100;
      if (blurR !== st.blur) {
        st.blur = blurR;
        el.style.setProperty('--card-blur', `${blurR}px`);
      }

      // Label stays fully white across the whole stretch where the card reads as
      // focused, so the project text is comfortably legible rather than flashing
      // readable for an instant at dead-centre. A wide dead-zone (|rel| ≤ 0.2)
      // holds full white, then a smoothstep falloff fades it out by |rel| ≈ 0.45.
      const labelT = 1 - Math.min(1, Math.max(0, (Math.abs(rel) - 0.2) / 0.25));
      logo.style.opacity = phone ? '1' : (labelT * labelT * (3 - 2 * labelT)).toFixed(3);
    });
  }

  // Only animate while the section is on screen — main.js toggles this on
  // clients enter/leave so the stack stops costing frames elsewhere.
  let active = false;
  let previewing = false;
  let ticking = false;
  function startTicker() { if (!ticking) { gsap.ticker.add(update); ticking = true; } }
  function stopTicker()  { if (ticking) { gsap.ticker.remove(update); ticking = false; } }

  // Far-preview while the prior video section is still on screen: render the
  // card stack (opacity:1, no pointer-events) with the first card parked
  // up-right of its resting spot, then glide it down as the video finishes.
  function setPreview(on) {
    if (active) return;
    previewing = on;
    stage.classList.toggle('is-preview', on);
    if (on) { scrollProgress = PREVIEW_START; startTicker(); }
    else stopTicker();
  }
  function setPreviewProgress(t) {
    if (active || !previewing) return;
    const ct = Math.max(0, Math.min(1, t));
    const eased = ct * ct * (3 - 2 * ct); // smoothstep — gentle glide
    scrollProgress = PREVIEW_START * (1 - eased); // PREVIEW_START → 0
  }

  function setActive(on) {
    if (on === active) return;
    active = on;
    stage.classList.remove('is-preview');
    previewing = false;
    stage.classList.toggle('is-visible', on);
    if (on) {
      startTicker();
      titleHandle.glitchIn(0.7);
    } else {
      stopTicker();
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
    setPreview,
    setPreviewProgress,
    destroy() {
      setActive(false);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.remove();
    },
  };
}
