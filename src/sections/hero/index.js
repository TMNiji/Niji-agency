import { createHeader }   from './header.js';
import { createTimeline } from './timeline.js';
import { createTitle }    from './title.js';
import { createFacePack } from './facePack.js';

const DEFAULT_TITLE = 'We make products for humans and agents';

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
  const timeline = createTimeline({ labels: sectionLabels, startIndex: 0 });
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

  section.appendChild(timeline.el);
  section.appendChild(header.el);

  requestAnimationFrame(() => requestAnimationFrame(() => title.play()));

  orchestrator?.onProgress('hero', ({ progress }) => {
    facePack.setProgress(progress);
    webgl?.shaderPlane?.setProgress(progress);
  });

  return { section, header, timeline, title, facePack };
}
