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

// ── Dropdown copy ────────────────────────────────────────────────────────────
// DESIGN (frames 1-160) and CODE (frames 161-end) each get their own service
// panel. Tags render with a leading "/" added by createServiceDropdowns.
export const DESIGN_SERVICES = [
  { tag: 'CONCEPT',  items: ['Vision produit, direction créative',  'Concepts qui tiennent en boardroom'] },
  { tag: 'WORKSHOP', items: ['Idéation co-conçue avec vos équipes', 'Une idée par mur. Une décision par jour.'] },
  { tag: 'WORKFLOW', items: ['IA générative dans le process créatif', 'Idée prototypée en quelques heures'] },
];

export const CODE_SERVICES = [
  { tag: 'FRONT',          items: ['React, Next.js, Vue, TypeScript',       'Shopify, Salesforce Commerce Cloud'] },
  { tag: 'ANIMATION',      items: ['GSAP, Three.js, Framer Motion, Lottie', 'Le mouvement sert le produit, ou il sort'] },
  { tag: 'AI PIXEL CODEUR', items: ['Figma vers React, sans handoff',        'Design-to-code-to-design'] },
];

export function mountVideo({
  container,
  orchestrator,
  sectionId = 'video',
  frames,
  title = '',
  subtitle = '',
  services = [],
} = {}) {
  const section = container.querySelector(`[data-section="${sectionId}"]`);
  if (!section) return null;
  section.classList.add('video');

  const stage = document.createElement('div');
  stage.className = 'video__stage';
  section.appendChild(stage);

  // ── Title + subtitle overlay ───────────────────────────────────────────────
  // Built via the shared createTitle so it glitches in/out on section
  // enter/leave, matching the clients/awards rhythm. The subtitle reads as the
  // large/bold line, the title as the smaller lead-in beneath it.
  const titleHandle = createTitle({
    baseClass: 'video-title',
    tag: 'div',
    lines: [
      { text: title,    cls: 'video-title__line--large' },
      { text: subtitle, cls: 'video-title__line--small' },
    ],
    glitchFontClasses: [],
    glitchDuration: 0,
  });
  titleHandle.el.classList.add('video__title');
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

  const placeholder = document.createElement('div');
  placeholder.className = 'video__placeholder';
  placeholder.innerHTML = `
    <div class="video__placeholder-frame">
      <div class="video__placeholder-icon" aria-hidden="true">▶</div>
      <div class="video__placeholder-label">Loading frames…</div>
      <div class="video__placeholder-hint">Scroll to scrub</div>
    </div>
  `;
  stage.appendChild(placeholder);

  // ── Preload the sequence ──────────────────────────────────────────────────
  // `start`/`end` are 1-based, inclusive frame numbers. This mount only loads
  // its own slice of the full clip, so DESIGN and CODE never double up.
  const { base = '/video/frames/frame_', pad = 4, ext = 'jpg', start = 1, end = start } = frames || {};
  const count = Math.max(0, end - start + 1);
  const imgs = new Array(count);
  let settled = 0;
  let firstReady = false;

  const onSettle = (i) => {
    settled++;
    if (!firstReady && imgs[i].naturalWidth) {
      firstReady = true;
      resize();        // size the backing store, draw the first frame
      drawIndex(lastIdx >= 0 ? lastIdx : 0, true);
    }
    if (settled >= count) placeholder.classList.add('is-hidden');
  };

  for (let i = 0; i < count; i++) {
    const img = new Image();
    img.decoding = 'async';
    img.addEventListener('load',  () => onSettle(i), { once: true });
    img.addEventListener('error', () => onSettle(i), { once: true });
    img.src = `${base}${String(start + i).padStart(pad, '0')}.${ext}`;
    imgs[i] = img;
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
    const idx = Math.max(0, Math.min(count - 1, Math.round(progress * (count - 1))));
    schedule(idx);
  });

  // A ResizeObserver catches both viewport changes and the moment Vite's
  // async-injected CSS first stretches the canvas to fullscreen — a plain
  // window 'resize' listener would miss that initial layout flip.
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return { section, canvas, designServices, titleHandle };
}
