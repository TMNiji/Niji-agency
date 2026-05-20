import { createHeader }   from './header.js';
import { createTimeline }  from './timeline.js';
import { createTitle }     from './title.js';
import { createFacePack }  from './facePack.js';
import { createCellElement } from './cellElement.js';

const HERO_TITLE = 'We make products for humans and agents';

export function mountHero({ container, orchestrator, webgl } = {}) {
  const section = container.querySelector('[data-section="hero"]');
  if (!section) return null;

  section.classList.add('hero');

  const header   = createHeader();
  const timeline = createTimeline({ labels: ['Hello!'], startIndex: 0 });
  const title    = createTitle({ text: HERO_TITLE });
  const facePack = createFacePack({ webgl });
  const cell     = createCellElement();

  section.innerHTML = '';

  // Sticky stage holds only the cell (face renders in WebGL canvas overlay)
  const stage = document.createElement('div');
  stage.className = 'hero__stage';
  stage.appendChild(cell.el);
  section.appendChild(stage);

  const overlay = document.createElement('div');
  overlay.className = 'hero__overlay';
  overlay.appendChild(title.el);
  section.appendChild(overlay);

  section.appendChild(timeline.el);
  section.appendChild(header);

  requestAnimationFrame(() => requestAnimationFrame(() => title.play()));

  orchestrator?.onProgress('hero', ({ progress }) => {
    facePack.setProgress(progress);
    cell.setProgress(progress);
  });

  orchestrator?.onEnter('hero', () => {
    webgl?.shaderPlane?.setShader('hero_grain');
  });

  return { section, header, timeline, title, facePack, cell };
}
