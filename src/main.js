import { initScroll }        from '@modules/scroll.js';
import { initWebGL }         from '@modules/webgl.js';
import { createOrchestrator } from '@modules/orchestrator.js';
import { initSnapScroll }     from '@modules/snapScroll.js';
import { mountHero }          from './sections/hero/index.js';
import { mountThinking }      from './sections/thinking/index.js';
import { mountChaos }         from './sections/chaos/index.js';
import { fetchHomePage }      from './lib/sanity.js';
import { initNoise }         from '@modules/noise.js';

const SECTIONS = [
  {
    id: 'hero',
    label: 'Identity',
    triggerHeight: '80vh',   // section 1 — longer gesture, full explosion in ~80vh
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'thinking',
    label: 'Thinking',
    triggerHeight: '220vh',  // section 2 — cell + orbital; extra height gives sticky dwell for interaction
    triggerStart: 'top top', // progress starts when thinking hits viewport top
    triggerEnd: 'center top', // progress=1 at halfway through; sticky lasts for dot interaction
  },
  {
    id: 'chaos',
    label: 'Beyond',
    triggerHeight: '250vh',  // section 3 — extra space for the deliberate prism pacing
    triggerStart: 'top top',
    // Use 'bottom bottom' (not 'bottom top') because chaos is the last section:
    // 'bottom top' would require scrolling *past* maxScroll to reach progress=1.
    // With 'bottom bottom', progress 0→1 maps cleanly onto scroll 0→maxScroll.
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

  const sectionLabels = SECTIONS.map((s) => s.label);
  const hero     = mountHero({
    container: root, orchestrator, webgl, sectionLabels, content: sanityContent,
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
    }
  });

  orchestrator.refresh();

  // ── Snap-scroll — section tops + document bottom ──────────────────────────
  // Non-zero snap targets get +4 px so Lenis's ease-out, which can settle
  // 1–2 px short, still crosses the ScrollTrigger start boundary and fires
  // onEnter reliably. Including doc-bottom lets users snap forward when they
  // pause near the end of the final section.
  initSnapScroll(lenis, () => {
    const tops = SECTIONS.map((s) => {
      const el = document.querySelector(`[data-section="${s.id}"]`);
      if (!el) return 0;
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      return top === 0 ? 0 : top + 4;
    });
    const docBottom = document.documentElement.scrollHeight - window.innerHeight;
    return [...tops, docBottom];
  });

  // Drive the timeline ruler with Lenis's smoothed scroll position.
  lenis.on('scroll', ({ scroll }) => { hero?.timeline?.update(scroll); });

  window.__niji = { lenis, webgl, orchestrator, hero, thinking, chaos };
}

boot();
