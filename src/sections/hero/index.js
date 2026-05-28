import { createHeader }   from './header.js';
import { createTimeline } from './timeline.js';
import { createTitle }    from './title.js';
import { createFacePack } from './facePack.js';
import { ease }           from '@modules/motion.js';

// Four stacked lines, each with its own size/alignment (see hero.css). A CMS
// `hero.title` with explicit line breaks overrides this; a plain (unbroken)
// CMS string keeps the designed layout below.
const DEFAULT_LINES = [
  { text: 'We',            cls: 'hero-title__line--we' },
  { text: 'Make products', cls: 'hero-title__line--make' },
  { text: 'for humans',    cls: 'hero-title__line--humans' },
  { text: '&AGENTS',       cls: 'hero-title__line--agents' },
];

export function mountHero({ container, orchestrator, webgl, sectionLabels = [], content = null } = {}) {
  const section = container.querySelector('[data-section="hero"]');
  if (!section) return null;

  section.classList.add('hero');

  // Build Sanity image URL map (frag-id → CDN URL), falls back to static paths.
  const fp = content?.hero?.facePack ?? {};
  const FRAG_KEY_MAP = {
    'bg-bottom-right':   fp.bgBottomRight,
    'bg-top':            fp.bgTop,
    'forehead-left-bg':  fp.foreheadLeftBg,
    'forehead-bg-right': fp.foreheadBgRight,
    'bg-bottom':         fp.bgBottom,
    'mouth-left':        fp.mouthLeft,
    'mouth-right':       fp.mouthRight,
    'eye-left':          fp.eyeLeft,
    'ear-right':         fp.earRight,
    'bottom-ear-right':  fp.bottomEarRight,
    'ear-left':          fp.earLeft,
    'eye-right':         fp.eyeRight,
  };
  const imageSrcs = Object.fromEntries(
    Object.entries(FRAG_KEY_MAP)
      .filter(([, v]) => v?.asset?.url)
      .map(([k, v]) => [k, v.asset.url]),
  );

  const header   = createHeader();
  // A "back to start" loop anchor past CONTACT hints at the seamless wrap-around
  // to the top (see main.js loop handler).
  const timeline = createTimeline({ labels: sectionLabels, loopLabel: 'BACK TO START' });
  const cmsTitle = content?.hero?.title;
  const lines    = cmsTitle?.includes('\n')
    ? cmsTitle.split('\n').map((text) => ({ text }))
    : DEFAULT_LINES;
  const title    = createTitle({ lines });
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
    // Cell growth — emerges from a point and reaches default size by the end
    // of hero. Thinking continues to push uCellGrow past 1 (walk-through).
    webgl?.shaderPlane?.setCellGrow(progress);

    // Dissolve the title in lockstep with the fragments (same curves as
    // facePack.js): opacity holds, then tracks `fade` (gone ~0.95), drift `move`.
    const fade = ease.smoothstep(Math.max(0, Math.min(1, (progress - 0.40) / 0.55)));
    const move = ease.smoothstep(progress);
    title.el.style.opacity   = String(Math.max(0, 1 - fade).toFixed(3));
    title.el.style.transform = `scale(${(1 + move * 0.05).toFixed(4)}) translateY(${(-move * 28).toFixed(1)}px)`;
    // Once faded out the title is invisible but, with pointer-events:auto, it
    // still sits above the thinking section (hero z-index:2 > thinking:1) and
    // would swallow clicks meant for the orbital dots behind it.
    title.el.style.pointerEvents = (1 - fade) > 0.02 ? 'auto' : 'none';
  });

  return { section, header, timeline, title, facePack };
}
