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
  { text: 'for humans.',   cls: 'hero-title__line--humans' },
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

  const header   = createHeader({ logoSrc: content?.logo?.asset?.url });
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
  //
  // Each line ends with a real space *before* its <br>. On desktop the <br>
  // forces the 5-line editorial layout (the trailing space is invisible); on
  // phones the <br> is hidden (hero.css @600) so the text reflows into a
  // compact 3-line block and the spaces keep the words apart.
  const DEFAULT_SUBTITLE =
    "Agence de product design AI‑native. <br>"
    + "115 designers&nbsp;|&nbsp;9 bureaux <br>"
    + "25 ans à construire <br>"
    + "ce qui se regarde, s'utilise <br>"
    + "et maintenant se parle.";
  const cmsSubtitle = content?.hero?.subtitle;
  // CMS value is plain multiline text. Render one line per row (honouring the
  // editor's line breaks), escaped so a visitor can't inject markup, then apply
  // the same typographic glue as the designed default: a non-breaking separator
  // around " | ", a non-breaking hyphen inside compounds like "AI-native", and a
  // non-breaking space tying a number to its unit ("115 designers", "9 bureaux").
  // The space before each <br> mirrors the default so the mobile reflow keeps its
  // word spacing when the breaks are hidden. Falls back to the default above.
  const NB_HYPHEN = '‑';
  const polishLine = (line) => {
    const div = document.createElement('div');
    div.textContent = line; // escape first — everything below only adds safe glue
    return div.innerHTML
      .replace(/ \| /g, '&nbsp;|&nbsp;')
      .replace(/(\p{L})-(\p{L})/gu, `$1${NB_HYPHEN}$2`)
      .replace(/(\d) +(?=\p{L})/gu, '$1&nbsp;');
  };
  subtitle.innerHTML = cmsSubtitle
    ? cmsSubtitle.split('\n').map(polishLine).join(' <br>')
    : DEFAULT_SUBTITLE;

  // Subtitle stacks directly under the title inside the right-anchored heading
  // on desktop (see hero.css). On phones CSS re-pins it bottom-centre of the
  // full-viewport overlay (@600), so the DOM placement is unchanged there.
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

  // Last-written values so we skip redundant style writes when scroll stalls.
  let lastMove = NaN, lastFade = NaN, lastPE = '';
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
    const fade = Math.round(ease.smoothstep(Math.max(0, Math.min(1, (progress - 0.40) / 0.55))) * 1000) / 1000;
    const move = Math.round(ease.smoothstep(progress) * 1000) / 1000;

    if (fade !== lastFade) {
      lastFade = fade;
      title.setExit(fade);
      subtitle.style.opacity = (1 - fade).toFixed(3);
      // Once shattered the title is invisible but, with pointer-events:auto, it
      // still sits above the thinking section (hero z-index:2 > thinking:1) and
      // would swallow clicks meant for the orbital dots behind it.
      const pe = (1 - fade) > 0.02 ? 'auto' : 'none';
      if (pe !== lastPE) { lastPE = pe; title.el.style.pointerEvents = pe; }
    }

    if (move !== lastMove) {
      lastMove = move;
      title.el.style.transform = `scale(${(1 + move * 0.05).toFixed(4)}) translateY(${(-move * 28).toFixed(1)}px)`;
      // Subtitle slides in lockstep with the title's shatter. Write only the Y
      // lift to --sub-y so CSS owns the horizontal placement (bottom-left on
      // desktop, centred on phones — see hero.css .hero__subtitle).
      subtitle.style.setProperty('--sub-y', `${(-move * 22).toFixed(1)}px`);
    }
  });

  return { section, header, timeline, title, facePack };
}
