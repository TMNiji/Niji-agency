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
const PRISM_THRESHOLD = 0.75;

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

  // 1-second debounce: after the last timeline drag, wait before scrolling.
  let dragScrollTimer = null;

  const sectionLabels       = SECTIONS.map((s) => s.label);
  const sectionLabelAnchors = SECTIONS.map((s) => s.labelAnchor ?? 'top');
  const hero     = mountHero({
    container: root, orchestrator, webgl, sectionLabels, sectionLabelAnchors, content: sanityContent,
    onSectionChange: (index) => {
      clearTimeout(dragScrollTimer);
      dragScrollTimer = setTimeout(() => {
        const s  = SECTIONS[index];
        if (!s) return;
        const el = document.querySelector(`[data-section="${s.id}"]`);
        if (!el) return;
        const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
        lenis.scrollTo(top === 0 ? 0 : top + 4, { duration: 0.7 });
      }, 1000);
    },
  });
  const thinking = mountThinking({ container: root, orchestrator, webgl, content: sanityContent });
  const chaos    = mountChaos({ container: root });
  const video    = mountVideo({ container: root, orchestrator });
  const clients  = mountClients({ container: root, orchestrator });

  // Wire drag-to-scrub: timeline calls this when the user drags the ruler strip.
  hero?.timeline?.setScrollHandler((y) => lenis.scrollTo(y, { duration: 0.15 }));

  // ── Timeline + header label — sync with active section ──────────────────────
  // 2-second delay so the timeline update doesn't flash on quick scroll-through.
  let timelineUpdateTimer = null;

  orchestrator.onEnter('thinking', () => {
    clearTimeout(timelineUpdateTimer);
    timelineUpdateTimer = setTimeout(() => {
      hero?.timeline?.setIndex(1);
    }, 2000);
  });
  orchestrator.onLeave('thinking', ({ direction }) => {
    clearTimeout(timelineUpdateTimer);
    if (direction === 'up') {
      hero?.timeline?.setIndex(0);
    }
  });

  // ── Rainbow transition — driven by thinking's last quarter ─────────────────
  // Below PRISM_THRESHOLD: hero_grain @ uProgress=1 (cell + dots).
  // Above PRISM_THRESHOLD: prism shader animates so colorful bg is full by
  // the moment chaos.top (CONCEPTION snap) is reached.
  let prismActive = false;
  const setUIVisible = (visible) => {
    const orbital = document.querySelector('.hero-orbital');
    const panel   = document.querySelector('.thinking__right-panel');
    const opacity = String(visible.toFixed(3));
    if (orbital) { orbital.style.transition = 'none'; orbital.style.opacity = opacity; }
    if (panel)   { panel.style.transition   = 'none'; panel.style.opacity   = opacity; }
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

    clearTimeout(timelineUpdateTimer);
    timelineUpdateTimer = setTimeout(() => {
      hero?.timeline?.setIndex(2);
    }, 2000);
  });

  orchestrator.onProgress('chaos', () => {
    webgl.shaderPlane.setProgress(1);
  });

  orchestrator.onLeave('chaos', ({ direction }) => {
    clearTimeout(timelineUpdateTimer);
    if (direction === 'up') {
      // Going back up into thinking — thinking's onProgress will re-drive the
      // shader from its current progress, so don't force a shader swap here.
      hero?.timeline?.setIndex(1);
    } else {
      // Going down into video — drop the prism, return to the dark grain bg.
      webgl.shaderPlane.setShader('hero_grain');
      webgl.shaderPlane.setProgress(0);
      prismActive = false;
      setUIVisible(1);
      hero?.timeline?.setIndex(3);
    }
  });

  // ── Video + Clients — reveal stage when active ──────────────────────────
  const setActive = (id, on) => {
    const el = document.querySelector(`[data-section="${id}"]`);
    if (el) el.classList.toggle('is-visible', on);
  };

  orchestrator.onEnter('video',   () => { setActive('video', true);  hero?.timeline?.setIndex(3); });
  orchestrator.onLeave('video',   ({ direction }) => {
    setActive('video', false);
    if (direction === 'up') hero?.timeline?.setIndex(2);
  });

  orchestrator.onEnter('clients', () => { setActive('clients', true); hero?.timeline?.setIndex(4); });
  orchestrator.onLeave('clients', ({ direction }) => {
    setActive('clients', false);
    if (direction === 'up') hero?.timeline?.setIndex(3);
  });

  orchestrator.refresh();

  // ── Snap-scroll — every section top plus the document bottom ────────────
  // All five section tops are anchors so the user always lands on a
  // well-defined viewport no matter where they pause scrolling. The snap
  // window in snapScroll.js is wide enough that a stop anywhere in the page
  // resolves to the nearest anchor.
  // Non-zero targets get +4 px so Lenis's ease-out still crosses the
  // ScrollTrigger start boundary reliably.
  initSnapScroll(lenis, () => {
    const snapIds = ['hero', 'thinking', 'chaos', 'video', 'clients'];
    const tops = snapIds.map((id) => {
      const el = document.querySelector(`[data-section="${id}"]`);
      if (!el) return null;
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      return top === 0 ? 0 : top + 4;
    }).filter((t) => t !== null);
    const docBottom = document.documentElement.scrollHeight - window.innerHeight;
    return [...tops, docBottom];
  });

  // Drive the timeline ruler with Lenis's smoothed scroll position.
  lenis.on('scroll', ({ scroll }) => { hero?.timeline?.update(scroll); });

  window.__niji = { lenis, webgl, orchestrator, hero, thinking, chaos, video, clients };
}

boot();
