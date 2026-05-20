import { initScroll }        from '@modules/scroll.js';
import { initWebGL }         from '@modules/webgl.js';
import { createOrchestrator } from '@modules/orchestrator.js';
import { mountHero }          from './sections/hero/index.js';
import { mountThinking }      from './sections/thinking/index.js';

const SECTIONS = [
  {
    id: 'hero',
    triggerHeight: '200vh',
    triggerStart: 'top top',
    triggerEnd: 'bottom top',
  },
  {
    id: 'thinking',
    // Fires when thinking enters the viewport from below (scroll ~100 vh),
    // while the hero face-pack is still exploding — reveals the orbital
    // beneath through the transparent face fragments.
    triggerStart: 'top bottom',
    triggerEnd: 'bottom top',
  },
];

async function boot() {
  const lenis = initScroll();

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

  // Hero — shader light at top, descends toward centre as hero scrolls out
  orchestrator.onEnter('hero', () => webgl.shaderPlane.setShader('hero_grain'));
  orchestrator.onProgress('hero', ({ progress }) =>
    webgl.shaderPlane.setProgress(progress),
  );
  // When hero is left going upward, restore progress to 0
  orchestrator.onLeave('hero', ({ direction }) => {
    if (direction === 'up') webgl.shaderPlane.setProgress(0);
  });

  // Thinking — lock shader at progress=1 (light at screen centre)
  orchestrator.onEnter('thinking', () => webgl.shaderPlane.setProgress(1));
  orchestrator.onProgress('thinking', () => webgl.shaderPlane.setProgress(1));

  const hero     = mountHero({ container: root, orchestrator, webgl });
  const thinking = mountThinking({ container: root, orchestrator, webgl });

  orchestrator.refresh();

  window.__niji = { lenis, webgl, orchestrator, hero, thinking };
}

boot();
