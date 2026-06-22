// Video section — scroll-scrubbed image sequence drawn to a <canvas>.
//
// Seeking a real <video> by currentTime stutters: inter-frame compression
// forces the decoder to seek to the nearest keyframe and decode forward on
// every scroll tick. Instead we preload the clip as a numbered frame sequence
// (exported with ffmpeg) and on scroll just blit frame N to a canvas — zero
// decode-forward, zero seek latency, frame-accurate. This is the Apple-style
// product-page technique.
//
// Frames live in public/video/frames/ as frame_0001.webp … frame_NNNN.webp.
// The full clip is split across two sections (DESIGN + CODE): each mount only
// preloads + scrubs its own frame range, so the work is shared, not doubled.

import { createServiceDropdowns } from '../shared/serviceDropdowns.js';
import { createTitle } from '../hero/title.js';
import { asset } from '@/lib/asset.js';

// ── Dropdown copy ────────────────────────────────────────────────────────────
// DESIGN (frames 1-262) and CODE (frames 263-end) each get their own service
// panel. Tags render with a leading "/" added by createServiceDropdowns. Each
// is a { fr, en } map — pick() in main.js selects the active language.
export const DESIGN_SERVICES = {
  fr: [
    { tag: 'CONCEPT',  items: ['Vision produit, direction créative',  'Concepts qui tiennent en boardroom'] },
    { tag: 'WORKSHOP', items: ['Idéation co-conçue avec vos équipes', 'Une idée par mur. Une décision par jour.'] },
    { tag: 'WORKFLOW', items: ['IA générative dans le process créatif', 'Idée prototypée en quelques heures'] },
  ],
  en: [
    { tag: 'CONCEPT',  items: ['Product vision, creative direction',   'Concepts that hold up in the boardroom'] },
    { tag: 'WORKSHOP', items: ['Ideation co-built with your teams',    'One idea per wall. One decision per day.'] },
    { tag: 'WORKFLOW', items: ['Generative AI inside the creative process', 'An idea prototyped in hours'] },
  ],
};

export const CODE_SERVICES = {
  fr: [
    { tag: 'FRONT',           items: ['React, Next.js, Vue, TypeScript',       'Shopify, Salesforce Commerce Cloud'] },
    { tag: 'ANIMATION',       items: ['GSAP, Three.js, Framer Motion, Lottie', 'Le mouvement sert le produit, ou il sort'] },
    { tag: 'AI PIXEL CODEUR', items: ['Figma vers React, sans handoff',        'Design-to-code-to-design'] },
  ],
  en: [
    { tag: 'FRONT',          items: ['React, Next.js, Vue, TypeScript',       'Shopify, Salesforce Commerce Cloud'] },
    { tag: 'ANIMATION',      items: ['GSAP, Three.js, Framer Motion, Lottie', 'Motion serves the product, or it goes'] },
    { tag: 'AI PIXEL CODER', items: ['Figma to React, no handoff',            'Design-to-code-to-design'] },
  ],
};

export function mountVideo({
  container,
  orchestrator,
  sectionId = 'video',
  frames,
  title = '',
  subtitle = '',
  services = [],
  // Title layout: 'top' is the default top-centre overlay (CODE); 'center'
  // drops it dead-centre (DESIGN). See video.css.
  titleVariant = 'top',
  // Optional explicit line spec for createTitle — lets a section build a custom
  // stack (e.g. DESIGN's Du / CHAOS / naît le produit, with `switch:true` on the
  // CHAOS line to font-morph just that word). Falls back to title + subtitle.
  titleLines = null,
} = {}) {
  const section = container.querySelector(`[data-section="${sectionId}"]`);
  if (!section) return null;
  section.classList.add('video');

  const stage = document.createElement('div');
  stage.className = 'video__stage';
  section.appendChild(stage);

  // ── Title + subtitle overlay ───────────────────────────────────────────────
  // Built via the shared createTitle so it glitches in/out on section
  // enter/leave, matching the clients/awards rhythm. Default stack is the
  // large/bold lead line + a smaller line below; a section can override `lines`.
  const titleHandle = createTitle({
    baseClass: 'video-title',
    tag: 'div',
    lines: titleLines ?? [
      { text: title,    cls: 'video-title__line--large' },
      { text: subtitle, cls: 'video-title__line--small' },
    ],
    // The whole-title shatter stays flicker-only (no font swap); any font
    // morphing is scoped to a `switch:true` line via createTitle's word loop.
    glitchFontClasses: [],
    glitchDuration: 0,
  });
  titleHandle.el.classList.add('video__title', `video__title--${titleVariant}`);
  stage.appendChild(titleHandle.el);

  // ── Service dropdowns — same panel as THINKING ─────────────────────────────
  // The container is built here but mounted into the shared right-panel (and
  // revealed/hidden per scroll) by main.js, so it stacks above the persistent
  // AI-links bar instead of overlapping it.
  const { el: designServices } = createServiceDropdowns({ services });

  const canvas = document.createElement('canvas');
  canvas.className = 'video__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // ── Preload the sequence ──────────────────────────────────────────────────
  // `start`/`end` are 1-based, inclusive frame numbers. This mount only loads
  // its own slice of the full clip, so DESIGN and CODE never double up.
  const { base = '/video/frames/frame_', pad = 4, ext = 'webp', start = 1, end = start } = frames || {};
  const count = Math.max(0, end - start + 1);
  const imgs = new Array(count);
  let firstReady = false;

  const onSettle = (i) => {
    if (!firstReady && imgs[i].naturalWidth) {
      firstReady = true;
      resize();        // size the backing store, draw the first frame
      drawIndex(lastIdx >= 0 ? lastIdx : 0, true);
    }
  };

  // Frames are fetched lazily: each section's slice only starts downloading when
  // the user is one section away (wired in main.js via startPreload), so the
  // initial page load isn't competing with all ~500 frames at once. Idempotent,
  // and also fired from onProgress below as a safety net for deep page loads.
  let preloadStarted = false;
  function startPreload() {
    if (preloadStarted || count <= 0) return;
    preloadStarted = true;
    for (let i = 0; i < count; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.addEventListener('load',  () => onSettle(i), { once: true });
      img.addEventListener('error', () => onSettle(i), { once: true });
      img.src = asset(`${base}${String(start + i).padStart(pad, '0')}.${ext}`);
      imgs[i] = img;
    }
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  let lastIdx = -1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    canvas.width  = Math.round(r.width  * dpr);
    canvas.height = Math.round(r.height * dpr);
    if (lastIdx >= 0) drawIndex(lastIdx, true);
  }

  // When the requested frame hasn't downloaded yet, fall back to the nearest
  // one that has, so scrubbing never shows a blank.
  function pick(i) {
    if (imgs[i] && imgs[i].naturalWidth) return imgs[i];
    for (let d = 1; d < count; d++) {
      const a = imgs[i - d], b = imgs[i + d];
      if (a && a.naturalWidth) return a;
      if (b && b.naturalWidth) return b;
    }
    return null;
  }

  function drawIndex(i, force = false) {
    if (i === lastIdx && !force) return;
    const img = pick(i);
    if (!img || !canvas.width) return;
    lastIdx = i;
    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih);   // cover
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  // Coalesce a burst of scroll events into one paint per animation frame.
  let pending = -1, raf = 0;
  function schedule(i) {
    pending = i;
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; drawIndex(pending); });
  }

  orchestrator?.onProgress(sectionId, ({ progress }) => {
    if (count <= 0) return;
    startPreload(); // safety net: ensure frames load if we reach this section directly
    const idx = Math.max(0, Math.min(count - 1, Math.round(progress * (count - 1))));
    schedule(idx);
  });

  // A ResizeObserver catches both viewport changes and the moment Vite's
  // async-injected CSS first stretches the canvas to fullscreen — a plain
  // window 'resize' listener would miss that initial layout flip.
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return { section, canvas, designServices, titleHandle, startPreload };
}
