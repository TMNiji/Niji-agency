import { gsap }              from 'gsap';
import { initScroll }        from '@modules/scroll.js';
import { initWebGL }         from '@modules/webgl.js';
import { createOrchestrator } from '@modules/orchestrator.js';
import { mountHero }          from './sections/hero/index.js';
import { mountThinking }      from './sections/thinking/index.js';
import { mountChaos }         from './sections/chaos/index.js';
import { mountVideo }         from './sections/video/index.js';
import { mountClients }       from './sections/clients/index.js';
import { mountAwards }        from './sections/awards/index.js';
import { fetchHomePage }      from './lib/sanity.js';
import { initNoise }         from '@modules/noise.js';

// All sections share the same 200vh height so each occupies one full section of
// scroll. The rainbow → colorful-bg transition is driven by thinking's last
// quarter (see onProgress below), so by the time the user reaches chaos.top the
// colorful background is already at full strength.
const SECTION_HEIGHT = '200vh';

const SECTIONS = [
  {
    id: 'hero',
    label: 'VISION',
    triggerHeight: SECTION_HEIGHT,
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'thinking',
    label: 'BUILD',
    triggerHeight: SECTION_HEIGHT,
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'chaos',
    label: 'CONCEPTION',
    triggerHeight: SECTION_HEIGHT,
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'video',
    label: 'DESIGN',
    triggerHeight: SECTION_HEIGHT,
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'clients',
    label: 'CLIENTS',
    triggerHeight: SECTION_HEIGHT,
    triggerStart: 'top top',
    // 'bottom bottom' so progress 0→1 maps cleanly over the section's first
    // viewport of scroll (awards then takes over the trailing 100vh).
    triggerEnd: 'bottom bottom',
  },
  {
    id: 'awards',
    label: 'AWARDS',
    triggerHeight: SECTION_HEIGHT,
    triggerStart: 'top top',
    // 'bottom top' (not 'bottom bottom') so the trigger's end sits past the
    // document bottom — awards stays revealed while the user rests at the very
    // bottom. It's a hover list with no scroll-scrubbed progress, so only the
    // enter/leave edges matter. awards.css pulls this section up 100vh to sit
    // over clients' trailing tail (no dark gap between the two).
    triggerEnd: 'bottom top',
  },
];

// Fraction of thinking's scroll devoted to the rainbow → colorful-bg
// transition. Below this threshold, the cell + dots are shown (hero_grain).
// Above it, the prism shader animates so the colorful bg is full by the
// time the user lands on CONCEPTION at chaos.top.
const PRISM_THRESHOLD = 0.6;

initNoise();

async function boot() {
  // Fetch CMS content and init scroll concurrently — neither blocks the other.
  const [sanityContent, lenis] = await Promise.all([
    fetchHomePage(),
    Promise.resolve(initScroll()),
  ]);

  const webgl = initWebGL({
    canvas: document.querySelector('#webgl-canvas'),
    initialShader: 'hero_grain',
  });

  const root = document.querySelector('#app');
  root.innerHTML = SECTIONS.map((s) => {
    const h = s.triggerHeight ? ` style="min-height:${s.triggerHeight}"` : '';
    return `<section id="${s.id}" data-section="${s.id}"${h}></section>`;
  }).join('');

  const orchestrator = createOrchestrator({ sections: SECTIONS });

  // Hero — ensure correct shader is set. uProgress is driven continuously by
  // onProgress('hero') in hero/index.js so the cell emerges as the face explodes.
  orchestrator.onEnter('hero', () => {
    webgl.shaderPlane.setShader('hero_grain');
  });

  // Thinking — safety net: if the page loads mid-scroll inside thinking,
  // hero's onProgress never ran, so force uProgress to 1 here.
  orchestrator.onEnter('thinking', () => {
    webgl.shaderPlane.setProgress(1);
  });

  const sectionLabels = SECTIONS.map((s) => s.label);
  const hero     = mountHero({
    container: root, orchestrator, webgl, sectionLabels, content: sanityContent,
  });
  const thinking = mountThinking({ container: root, orchestrator, webgl, content: sanityContent });
  const chaos    = mountChaos({ container: root });
  const video    = mountVideo({ container: root, orchestrator });
  const clients  = mountClients({ container: root, orchestrator });
  const awards   = mountAwards({ container: root });

  // Section-label clicks navigate the page. Use a smooth, eased scroll (not an
  // instant jump) so the user sees the sections animate on the way there.
  hero?.timeline?.setScrollHandler((y) =>
    lenis.scrollTo(y, { duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3) }));

  // The timeline's active index is derived from scroll position below (single
  // source of truth) rather than from bouncy ScrollTrigger enter/leave edges.

  // ── Rainbow transition — driven by thinking's last quarter ─────────────────
  // Below PRISM_THRESHOLD: hero_grain @ uProgress=1 (cell + dots).
  // Above PRISM_THRESHOLD: prism shader animates so colorful bg is full by
  // the moment chaos.top (CONCEPTION snap) is reached.
  let prismActive = false;
  // Fade the orbital + service panel during the prism cross-fade. Each module
  // owns its own inline styles via these setters — no cross-module DOM poking.
  const setUIVisible = (visible) => {
    thinking?.orbital?.setOpacity(visible);
    thinking?.setPanelOpacity?.(visible);
  };

  orchestrator.onProgress('thinking', ({ progress }) => {
    if (progress >= PRISM_THRESHOLD) {
      const p = Math.min(1, (progress - PRISM_THRESHOLD) / (1 - PRISM_THRESHOLD));
      if (!prismActive) {
        webgl.shaderPlane.setShader('prism');
        prismActive = true;
      }
      webgl.shaderPlane.setProgress(p);
      setUIVisible(1 - p);
    } else if (prismActive) {
      webgl.shaderPlane.setShader('hero_grain');
      webgl.shaderPlane.setProgress(1);
      setUIVisible(1);
      prismActive = false;
    }
  });

  // ── Chaos — colorful background holds at uProgress=1 ───────────────────────
  orchestrator.onEnter('chaos', () => {
    webgl.shaderPlane.setShader('prism');
    webgl.shaderPlane.setProgress(1);
    prismActive = true;
    setUIVisible(0);
  });

  orchestrator.onProgress('chaos', () => {
    webgl.shaderPlane.setProgress(1);
  });

  orchestrator.onLeave('chaos', ({ direction }) => {
    if (direction === 'down') {
      // Going down into video — drop the prism, return to the dark grain bg.
      webgl.shaderPlane.setShader('hero_grain');
      webgl.shaderPlane.setProgress(0);
      prismActive = false;
    }
    // Going up into thinking: thinking's onProgress re-drives the shader.
  });

  // ── Video + Clients — reveal stage when active ──────────────────────────
  const setActive = (id, on) => {
    const el = document.querySelector(`[data-section="${id}"]`);
    if (el) el.classList.toggle('is-visible', on);
  };

  orchestrator.onEnter('video', () => setActive('video', true));
  orchestrator.onLeave('video', () => setActive('video', false));

  orchestrator.onEnter('clients', () => { setActive('clients', true); clients?.setActive(true); });
  orchestrator.onLeave('clients', () => { setActive('clients', false); clients?.setActive(false); });

  // Awards — reveal the DOM stage, run its cursor-follow loop, and crossfade the
  // WebGL backdrop (the dark radial + grain lives in the `awards` shader). Tweening
  // uProgress turns the clients→awards hand-off into a smooth background morph out
  // of black rather than a hard shader swap.
  const awardsBg = { v: 0 };
  const tweenAwardsBg = (to, onComplete) =>
    gsap.to(awardsBg, {
      v: to,
      duration: to > 0 ? 0.9 : 0.55,
      ease: to > 0 ? 'power2.out' : 'power2.in',
      overwrite: true,
      onUpdate: () => webgl.shaderPlane.setProgress(awardsBg.v),
      onComplete,
    });

  orchestrator.onEnter('awards', () => {
    setActive('awards', true);
    awards?.setActive(true);
    webgl.shaderPlane.setShader('awards');
    tweenAwardsBg(1);
  });
  orchestrator.onLeave('awards', () => {
    setActive('awards', false);
    awards?.setActive(false);
    tweenAwardsBg(0, () => webgl.shaderPlane.setShader('hero_grain'));
  });

  // ── Pause offscreen per-frame work ───────────────────────────────────────
  // The face pack only matters while hero is on screen; stop ticking it once
  // it has exploded away (re-arms when scrolling back up into hero).
  orchestrator.onEnter('hero', () => hero?.facePack?.setActive(true));
  orchestrator.onLeave('hero', () => hero?.facePack?.setActive(false));

  orchestrator.refresh();

  // Render last on the shared gsap.ticker — after every section's transform
  // callback above has updated its meshes for this frame.
  webgl.startRenderLoop();

  // Drive the timeline ruler with Lenis's smoothed scroll position. The ruler
  // derives its own current/prev/next labels from this scroll value, so no
  // separate active-index tracking is needed here.
  lenis.on('scroll', ({ scroll }) => {
    hero?.timeline?.update(scroll);
  });

  window.__niji = { lenis, webgl, orchestrator, hero, thinking, chaos, video, clients, awards };
}

boot();
