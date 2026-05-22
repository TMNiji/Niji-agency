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

const SECTIONS = [
  {
    id: 'hero',
    label: 'Identity',
    // 140vh: longer gesture so the explosion isn't hyper-sensitive to small
    // scrolls. 80vh used to land the user mid-explosion on a single trackpad swipe.
    triggerHeight: '140vh',
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'thinking',
    label: 'Thinking',
    triggerHeight: '160vh',  // section 2 — cell + orbital; 160vh of dwell for dot interaction
    triggerStart: 'top top',
    triggerEnd: 'bottom top', // progress=1 right as chaos starts — no dead scroll between sections
  },
  {
    id: 'chaos',
    label: 'Beyond',
    labelAnchor: 'bottom', // "Beyond" = state after the rainbow; show label near section end
    // Reduced from 250vh — previous value padded a long dead-scroll stretch
    // between Thinking and Beyond. 160vh keeps the prism deliberate without
    // wasting screen estate.
    triggerHeight: '160vh',
    triggerStart: 'top top',
    triggerEnd: 'bottom top', // chaos is no longer last — progress 0→1 across the section
  },
  {
    id: 'video',
    label: 'Video',
    triggerHeight: '150vh',  // section 4 — scroll-scrubbed transparent video
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'clients',
    label: 'Clients',
    triggerHeight: '150vh',  // section 5 — last section, snaps to doc bottom
    triggerStart: 'top top',
    // 'bottom bottom' so progress 0→1 maps cleanly onto scroll 0→maxScroll
    // (would otherwise require scrolling past maxScroll to reach progress=1).
    triggerEnd: 'bottom bottom',
  },
];

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
  const clients  = mountClients({ container: root });

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

  // ── Chaos — prism shader, scroll-driven ────────────────────────────────────
  // Use direct setShader (not setShaderWithTransition): the cell is rendered
  // identically in both shaders at the transition point, so a hard swap is
  // visually seamless — and avoids the fade-to-black gap that made the cell
  // briefly disappear.

  orchestrator.onEnter('chaos', () => {
    webgl.shaderPlane.setShader('prism');

    // Delay the timeline/label update — shader animation is immediate.
    clearTimeout(timelineUpdateTimer);
    timelineUpdateTimer = setTimeout(() => {
      hero?.timeline?.setIndex(2);
    }, 2000);
  });

  // uProgress is driven by scroll position through the chaos section.
  orchestrator.onProgress('chaos', ({ progress }) => {
    webgl.shaderPlane.setProgress(progress);
  });

  orchestrator.onLeave('chaos', ({ direction }) => {
    clearTimeout(timelineUpdateTimer);
    if (direction === 'up') {
      webgl.shaderPlane.setProgress(1);
      webgl.shaderPlane.setShader('hero_grain');
      hero?.timeline?.setIndex(1);
    } else {
      // Going down into video — drop the prism, return to the dark grain bg.
      webgl.shaderPlane.setShader('hero_grain');
      webgl.shaderPlane.setProgress(0);
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
