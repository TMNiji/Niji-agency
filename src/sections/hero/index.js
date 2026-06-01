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

  // Heading wrapper stacks the glitch title + a small agency descriptor below,
  // both right-anchored within the overlay so they share the same right edge.
  const heading = document.createElement('div');
  heading.className = 'hero__heading';
  heading.appendChild(title.el);

  const subtitle = document.createElement('p');
  subtitle.className = 'hero__subtitle';
  // Non-breaking spaces glue numbers to their units ("115 designers" stays as
  // one block) and a non-breaking hyphen (‑, U+2011) keeps "AI-native"
  // together if the line happens to break right at the dash.
  subtitle.innerHTML =
    "Agence de product design AI‑native.<br>"
    + "115 designers&nbsp;|&nbsp;9 bureaux<br>"
    + "25 ans à construire<br>"
    + "ce qui se regarde, s'utilise<br>"
    + "et maintenant se parle.";
  heading.appendChild(subtitle);

  overlay.appendChild(heading);
  section.appendChild(overlay);

  // Hoist the timeline AND the header outside #app's stacking context (z-index:1)
  // so their z-index can beat the body-level section stages (clients/awards
  // hoist their full-viewport stages to <body> with z-index 9995 — without
  // this hoist they sit on top of the timeline and swallow label clicks on
  // AWARDS / CONTACT / BACK TO START).
  document.body.appendChild(timeline.el);
  document.body.appendChild(header.el);

  requestAnimationFrame(() => requestAnimationFrame(() => title.play()));

  orchestrator?.onProgress('hero', ({ progress }) => {
    facePack.setProgress(progress);
    webgl?.shaderPlane?.setProgress(progress);
    // Cell growth — emerges from a point and reaches default size by the end
    // of hero. Thinking continues to push uCellGrow past 1 (walk-through).
    webgl?.shaderPlane?.setCellGrow(progress);

    // Title glitches out instead of fading — title.setExit drives a per-letter
    // pop-off (driven by CSS --exit + --exit-t) and pumps an aggressive glitch
    // burst so the title visibly shatters apart on scroll exit. Same curve as
    // the previous fade so the timing relative to the facepack dive is unchanged.
    const fade = ease.smoothstep(Math.max(0, Math.min(1, (progress - 0.40) / 0.55)));
    const move = ease.smoothstep(progress);
    title.setExit(fade);
    title.el.style.transform = `scale(${(1 + move * 0.05).toFixed(4)}) translateY(${(-move * 28).toFixed(1)}px)`;
    // Subtitle fades in lockstep with the title's shatter — same `fade` curve
    // so the descriptor never lingers after the title has come apart.
    subtitle.style.opacity = (1 - fade).toFixed(3);
    subtitle.style.transform = `translateY(${(-move * 22).toFixed(1)}px)`;
    // Once shattered the title is invisible but, with pointer-events:auto, it
    // still sits above the thinking section (hero z-index:2 > thinking:1) and
    // would swallow clicks meant for the orbital dots behind it.
    title.el.style.pointerEvents = (1 - fade) > 0.02 ? 'auto' : 'none';
  });

  return { section, header, timeline, title, facePack };
}
