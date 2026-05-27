import { createHeader }   from './header.js';
import { createTimeline } from './timeline.js';
import { createTitle }    from './title.js';
import { createFacePack } from './facePack.js';
import { ease }           from '@modules/motion.js';

const DEFAULT_TITLE = 'We make products for humans & AGENTS';

export function mountHero({ container, orchestrator, webgl, sectionLabels = [], content = null } = {}) {
  const section = container.querySelector('[data-section="hero"]');
  if (!section) return null;

  section.classList.add('hero');

  // Build Sanity image URL map (frag-id → CDN URL), falls back to static paths.
  const fp = content?.hero?.facePack ?? {};
  const FRAG_KEY_MAP = {
    'neck':           fp.neck,
    'center-head':    fp.centerHead,
    'cheek-left':     fp.cheekLeft,
    'cheek-right':    fp.cheekRight,
    'eye-left':       fp.eyeLeft,
    'eye-right':      fp.eyeRight,
    'mouth':          fp.mouth,
    'forehead-left':  fp.foreheadLeft,
    'forehead-right': fp.foreheadRight,
  };
  const imageSrcs = Object.fromEntries(
    Object.entries(FRAG_KEY_MAP)
      .filter(([, v]) => v?.asset?.url)
      .map(([k, v]) => [k, v.asset.url]),
  );

  const header   = createHeader();
  const timeline = createTimeline({ labels: sectionLabels });
  const title    = createTitle({ text: content?.hero?.title ?? DEFAULT_TITLE });
  const facePack = createFacePack({ webgl, imageSrcs });

  section.innerHTML = '';

  // Sticky stage — face pack renders on the WebGL canvas overlay above this
  const stage = document.createElement('div');
  stage.className = 'hero__stage';
  section.appendChild(stage);

  const overlay = document.createElement('div');
  overlay.className = 'hero__overlay';
  overlay.appendChild(title.el);
  section.appendChild(overlay);

  stage.appendChild(timeline.el);
  // Hoist header outside #app's stacking context (z-index:1) so its z-index:9999
  // wins against the body-level #noise overlay (z-index:9998). Otherwise #app's
  // local context caps the header below the grain.
  document.body.appendChild(header.el);

  requestAnimationFrame(() => requestAnimationFrame(() => title.play()));

  orchestrator?.onProgress('hero', ({ progress }) => {
    facePack.setProgress(progress);
    webgl?.shaderPlane?.setProgress(progress);

    // Dissolve the title in lockstep with the fragments (same curves as
    // facePack.js): opacity tracks `fade` (gone ~0.82), drift tracks `move`.
    const fade = ease.smoothstep(Math.min(1, progress / 0.82));
    const move = ease.smoothstep(progress);
    title.el.style.opacity   = String(Math.max(0, 1 - fade).toFixed(3));
    title.el.style.transform = `scale(${(1 + move * 0.05).toFixed(4)}) translateY(${(-move * 28).toFixed(1)}px)`;
  });

  return { section, header, timeline, title, facePack };
}
