import { createOrbital } from '../hero/orbital.js';

const DEFAULT_SERVICES = [
  { tag: 'PRODUCT',  items: ['Product Design', 'User Research'] },
  { tag: 'BUSINESS', items: ['Brand Strategy', 'Market Analysis'] },
  { tag: 'BRANDING', items: ['Visual Identity', 'Brand Systems'] },
  { tag: 'TECH',     items: ['Frontend Engineering', 'System Design'] },
];

// Brand SVG logos — inline so there are no external requests.
const LOGOS = {
  claude: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M13.827 3.52h3.603l-7.744 16.96H6.083l7.744-16.96zm-7.258 0h3.603L2.428 20.48H-1.175l7.744-16.96z" transform="translate(3,0)"/></svg>`,
  gpt:    `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zm-11.717 9.61a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zm-9.662-4.127a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062l-4.84 2.796a4.5 4.5 0 0 1-6.14-1.651zm-1.25-10.225a4.485 4.485 0 0 1 2.366-1.973v5.677a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786a4.504 4.504 0 0 1-.648-6.117zm16.597 3.855l-5.833-3.387 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.412-.663zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681v.001zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5-.005-2.999z"/></svg>`,
  gemini: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C12 7.52 14.48 9.99 20 12c-5.52 2.01-8 4.48-8 10-2.01-5.52-4.48-8-10-8 5.52-2.01 8-4.48 8-10z"/></svg>`,
};

// Map from button label (lowercase) → logo key
const LOGO_MAP = { claude: 'claude', gpt: 'gpt', chatgpt: 'gpt', gemini: 'gemini' };

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
    .map((b) => {
      const key = LOGO_MAP[b.label.toLowerCase()] ?? null;
      const inner = key && LOGOS[key]
        ? LOGOS[key]
        : `<span class="thinking__ai-btn-text">${b.label}</span>`;
      return `<a class="thinking__ai-btn" href="${b.url}" target="_blank" rel="noopener" aria-label="${b.label}">${inner}</a>`;
    })
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
