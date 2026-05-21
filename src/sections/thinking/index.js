import { createOrbital } from '../hero/orbital.js';

const DEFAULT_SERVICES = [
  { tag: 'PRODUCT',  items: ['Product Design', 'User Research'] },
  { tag: 'BUSINESS', items: ['Brand Strategy', 'Market Analysis'] },
  { tag: 'BRANDING', items: ['Visual Identity', 'Brand Systems'] },
  { tag: 'TECH',     items: ['Frontend Engineering', 'System Design'] },
];

const DEFAULT_AI_LINKS = {
  label: 'Explore with AI',
  buttons: [
    { label: 'Claude', url: 'https://claude.ai' },
    { label: 'GPT',    url: 'https://chatgpt.com' },
    { label: 'Gemini', url: 'https://gemini.google.com' },
  ],
};

export function mountThinking({ container, orchestrator, webgl, content = null } = {}) {
  const section = container.querySelector('[data-section="thinking"]');
  if (!section) return null;
  section.classList.add('thinking');

  // ── Sticky stage — pins to viewport; holds cell + orbital ─────────────────
  const stage = document.createElement('div');
  stage.className = 'thinking__stage';
  section.appendChild(stage);

  const orbital = createOrbital({ stage });

  // ── Service panel — dropdowns ──────────────────────────────────────────────
  const services = document.createElement('div');
  services.className = 'thinking__services';

  const SERVICES   = content?.thinking?.services?.length   ? content.thinking.services   : DEFAULT_SERVICES;
  const AI_LINKS   = content?.thinking?.aiLinks?.buttons?.length ? content.thinking.aiLinks : DEFAULT_AI_LINKS;

  const serviceItems = SERVICES.map((s, i) => {
    const item   = document.createElement('div');
    item.className = 'thinking__service';

    const tagBtn = document.createElement('button');
    tagBtn.className = 'thinking__service-tag';

    const subEl  = document.createElement('div');
    subEl.className = 'thinking__service-sub';
    s.items.forEach((text) => {
      const span  = document.createElement('span');
      span.className = 'thinking__service-sub-item';
      span.textContent = text;
      subEl.appendChild(span);
    });

    item.appendChild(tagBtn);
    item.appendChild(subEl);
    services.appendChild(item);

    const setState = (open) => {
      tagBtn.textContent = (open ? '>' : '/') + s.tag;
      item.classList.toggle('is-open', open);
    };
    setState(false); // closed by default; open only on click

    tagBtn.addEventListener('click', () => {
      const wasOpen = item.classList.contains('is-open');
      serviceItems.forEach(({ setState: st }) => st(false));
      if (!wasOpen) setState(true);
    });

    return { item, setState };
  });

  stage.appendChild(services);

  // ── AI links — bottom-right of the stage ─────────────────────────────────
  const aiLinks = document.createElement('div');
  aiLinks.className = 'thinking__ai-links';
  const btnHtml = AI_LINKS.buttons
    .map((b) => `<a class="thinking__ai-btn" href="${b.url}" target="_blank" rel="noopener">${b.label}</a>`)
    .join('');
  aiLinks.innerHTML = `
    <span class="thinking__ai-links-label">${AI_LINKS.label}</span>
    <div class="thinking__ai-links-buttons">${btnHtml}</div>
  `;
  stage.appendChild(aiLinks);

  // ── Orchestration ──────────────────────────────────────────────────────────
  const reveal = () => section.classList.add('is-visible');

  // Debounced hide — the ease-out snap animation can land 1-2px before the
  // trigger start, momentarily firing onLeaveBack before correcting itself.
  // Cancelling the timer in onEnter means the orbital survives that micro-bounce.
  let hideTimer = null;

  orchestrator?.onEnter('thinking', () => {
    clearTimeout(hideTimer);
    hideTimer = null;
    webgl?.shaderPlane?.setProgress(1);
    orbital.show();   // appear in sync with the cell
    reveal();
  });

  orchestrator?.onProgress('thinking', () => {
    webgl?.shaderPlane?.setProgress(1);
    reveal();
  });

  orchestrator?.onLeave('thinking', ({ direction }) => {
    section.classList.remove('is-visible');
    clearTimeout(hideTimer);
    if (direction === 'up') {
      // Debounce: a micro-bounce snap can briefly cross the start boundary going
      // up then immediately re-enter. The 160ms window lets onEnter cancel the
      // hide before it fires, so the orbital never flashes.
      hideTimer = setTimeout(() => {
        orbital.hide();
        orbital.closePopup();
        hideTimer = null;
      }, 160);
    } else {
      // Going down past triggerEnd — hide immediately, no bounce risk.
      orbital.hide();
      orbital.closePopup();
      hideTimer = null;
    }
  });

  requestAnimationFrame(() => {
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) reveal();
  });

  return { section, orbital };
}
