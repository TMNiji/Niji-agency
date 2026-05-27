import { initScroll }        from '@modules/scroll.js';
import { initWebGL }         from '@modules/webgl.js';
import { createOrchestrator } from '@modules/orchestrator.js';
import { initSnapScroll }     from '@modules/snapScroll.js';
import { mountHero }          from './sections/hero/index.js';
import { mountThinking }      from './sections/thinking/index.js';
import { mountChaos }         from './sections/chaos/index.js';
import { mountVideo }         from './sections/video/index.js';
import { mountClients }       from './sections/clients/index.js';
import { fetchHomePage }      from './lib/sanity.js';
import { initNoise }         from '@modules/noise.js';

// All sections share the same 200vh height so every snap-to-snap hop takes
// the same scroll distance (one full section). The rainbow → colorful-bg
// transition is driven by thinking's last quarter (see onProgress below), so
// by the time CONCEPTION snaps in at chaos.top the colorful background is
// already at full strength.
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
    // 'bottom bottom' so progress 0→1 maps cleanly onto scroll 0→maxScroll
    // (would otherwise require scrolling past maxScroll to reach progress=1).
    triggerEnd: 'bottom bottom',
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

  // Wire drag-to-scrub: timeline calls this when the user drags the ruler strip.
  hero?.timeline?.setScrollHandler((y) => lenis.scrollTo(y, { duration: 0.15 }));

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

  // ── Pause offscreen per-frame work ───────────────────────────────────────
  // The face pack only matters while hero is on screen; stop ticking it once
  // it has exploded away (re-arms when scrolling back up into hero).
  orchestrator.onEnter('hero', () => hero?.facePack?.setActive(true));
  orchestrator.onLeave('hero', () => hero?.facePack?.setActive(false));

  orchestrator.refresh();

  // Render last on the shared gsap.ticker — after every section's transform
  // callback above has updated its meshes for this frame.
  webgl.startRenderLoop();

  // ── Snap-scroll — keyframes the user always comes to rest on ────────────
  // Every section start is a keyframe; the snap window (snapScroll.js) is wide
  // enough that any rest position resolves to the nearest one, so the user
  // never stops on a half-played animation. Clients adds one keyframe per card
  // so its 3D queue snaps card-to-card instead of skipping the middle.
  // Section starts get +4 px so Lenis's ease-out reliably crosses the
  // ScrollTrigger start boundary (which drives the shader swaps).
  initSnapScroll(lenis, () => {
    const docBottom = document.documentElement.scrollHeight - window.innerHeight;
    const topOf = (id) => {
      const el = document.querySelector(`[data-section="${id}"]`);
      if (!el) return null;
      return Math.round(el.getBoundingClientRect().top + window.scrollY);
    };
    const points = ['hero', 'thinking', 'chaos', 'video', 'clients']
      .map(topOf)
      .filter((t) => t !== null)
      .map((t) => (t === 0 ? 0 : t + 4));
    const clientsTop = topOf('clients');
    const cardCount  = document.querySelectorAll('.clients__card-pivot').length;
    if (clientsTop !== null && cardCount > 1) {
      const range = docBottom - clientsTop; // clients uses a 'bottom bottom' trigger
      for (let i = 1; i < cardCount - 1; i++) {
        points.push(Math.round(clientsTop + (i / (cardCount - 1)) * range));
      }
    }
    points.push(docBottom); // last card / document end
    return points;
  });

  // Drive the timeline ruler with Lenis's smoothed scroll position, and derive
  // the active section index from that same position — the section occupying the
  // viewport centre. Position-based (not edge-event based) so it never flashes
  // on fast scroll-through and needs no debounce.
  let lastIndex = -1;
  const updateActiveIndex = (scroll) => {
    const sectionH = window.innerHeight * 2; // every section is 200vh
    const idx = Math.max(0, Math.min(SECTIONS.length - 1,
      Math.floor((scroll + window.innerHeight / 2) / sectionH)));
    if (idx !== lastIndex) {
      lastIndex = idx;
      hero?.timeline?.setIndex(idx);
    }
  };
  lenis.on('scroll', ({ scroll }) => {
    hero?.timeline?.update(scroll);
    updateActiveIndex(scroll);
  });
  updateActiveIndex(0);

  window.__niji = { lenis, webgl, orchestrator, hero, thinking, chaos, video, clients };
}

boot();
