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
    triggerHeight: '30vh',   // section 1 — short gesture, full explosion in ~30vh
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
    triggerHeight: '150vh',  // section 3 — prism transition; sticky dwell for the animation
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
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

  const sectionLabels = SECTIONS.map((s) => s.label);
  const hero     = mountHero({ container: root, orchestrator, webgl, sectionLabels, content: sanityContent });
  const thinking = mountThinking({ container: root, orchestrator, webgl, content: sanityContent });
  const chaos    = mountChaos({ container: root });

  // ── Timeline + header label — sync with active section ──────────────────────
  orchestrator.onEnter('thinking', () => {
    hero?.timeline?.setIndex(1);
    hero?.header?.setSectionLabel('Thinking');
  });
  orchestrator.onLeave('thinking', ({ direction }) => {
    if (direction === 'up') {
      hero?.timeline?.setIndex(0);
      hero?.header?.setSectionLabel('');
    }
  });

  // ── Chaos — prism shader, time-based animation ──────────────────────────────
  let chaosRafId = null;

  orchestrator.onEnter('chaos', () => {
    webgl.shaderPlane.setShader('prism');
    webgl.shaderPlane.setProgress(0);
    hero?.timeline?.setIndex(2);
    hero?.header?.setSectionLabel('Beyond');

    let startTime = null;
    const DURATION = 2000; // ms for the full bolt→rainbow→fog sequence

    function tick(ts) {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / DURATION, 1.0);
      webgl.shaderPlane.setProgress(p);
      if (p < 1.0) chaosRafId = requestAnimationFrame(tick);
    }

    cancelAnimationFrame(chaosRafId);
    chaosRafId = requestAnimationFrame(tick);
  });

  orchestrator.onLeave('chaos', ({ direction }) => {
    cancelAnimationFrame(chaosRafId);
    chaosRafId = null;
    if (direction === 'up') {
      webgl.shaderPlane.setShader('hero_grain');
      webgl.shaderPlane.setProgress(1);
      hero?.timeline?.setIndex(1);
      hero?.header?.setSectionLabel('Thinking');
    }
  });

  orchestrator.refresh();

  // ── Snap-scroll — always land on a section boundary ─────────────────────────
  // Non-zero snap targets get +4 px so Lenis's ease-out, which can settle
  // 1–2 px short, still crosses the ScrollTrigger start boundary and fires
  // onEnter reliably.
  initSnapScroll(lenis, () =>
    SECTIONS.map((s) => {
      const el = document.querySelector(`[data-section="${s.id}"]`);
      if (!el) return 0;
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      return top === 0 ? 0 : top + 4;
    }),
  );

  window.__niji = { lenis, webgl, orchestrator, hero, thinking, chaos };
}

boot();
