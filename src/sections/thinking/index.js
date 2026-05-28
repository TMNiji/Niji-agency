import { createOrbital } from '../hero/orbital.js';

const DEFAULT_SERVICES = [
  { tag: 'PRODUCT',  items: ['Product Design', 'User Research'] },
  { tag: 'BUSINESS', items: ['Brand Strategy', 'Market Analysis'] },
  { tag: 'BRANDING', items: ['Visual Identity', 'Brand Systems'] },
  { tag: 'TECH',     items: ['Frontend Engineering', 'System Design'] },
];

// Brand SVG logos — exact paths from simple-icons (https://simpleicons.org).
const LOGOS = {
  claude: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/></svg>`,
  gpt:    `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>`,
  perplexity: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z"/></svg>`,
};

// Map from button label (lowercase) → logo key
const LOGO_MAP = { claude: 'claude', gpt: 'gpt', chatgpt: 'gpt', perplexity: 'perplexity' };

const NIJI_PROMPT = 'I want to understand what Niji is and what they do. They are a French digital agency specialising in UX/UI design, custom development, digital transformation, e-commerce, and data & AI services. They work with major enterprise accounts across retail, banking, luxury, and public sector, with over 1,400 people across France. Summarise their capabilities, notable clients, and what makes them stand out: https://www.niji.fr/';

const DEFAULT_AI_LINKS = {
  label: 'Explore with AI',
  buttons: [
    { label: 'Claude',     url: `https://claude.ai/new?q=${encodeURIComponent(NIJI_PROMPT)}` },
    { label: 'GPT',        url: `https://chatgpt.com/?q=${encodeURIComponent(NIJI_PROMPT)}` },
    { label: 'Perplexity', url: `https://www.perplexity.ai/search/new?q=${encodeURIComponent(NIJI_PROMPT)}` },
  ],
};

function safeExternalUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch (_) {
    return null;
  }
}

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
    (s.items ?? []).forEach((text) => {
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

  // ── AI links ──────────────────────────────────────────────────────────────
  const aiLinks = document.createElement('div');
  aiLinks.className = 'thinking__ai-links';
  const aiLinksLabel = document.createElement('span');
  aiLinksLabel.className = 'thinking__ai-links-label';
  aiLinksLabel.textContent = AI_LINKS.label;

  const aiLinksButtons = document.createElement('div');
  aiLinksButtons.className = 'thinking__ai-links-buttons';

  AI_LINKS.buttons.forEach((b) => {
    const href = safeExternalUrl(b?.url);
    if (!href) return;

    const label = b.label ?? 'AI link';
    const button = document.createElement('a');
    button.className = 'thinking__ai-btn';
    button.href = href;
    button.target = '_blank';
    button.rel = 'noopener';
    button.setAttribute('aria-label', label);

    const key = LOGO_MAP[label.toLowerCase()] ?? null;
    if (key && LOGOS[key]) {
      button.innerHTML = LOGOS[key];
    } else {
      const text = document.createElement('span');
      text.className = 'thinking__ai-btn-text';
      text.textContent = label;
      button.appendChild(text);
    }

    aiLinksButtons.appendChild(button);
  });

  aiLinks.appendChild(aiLinksLabel);
  aiLinks.appendChild(aiLinksButtons);

  // ── Right panel — services stacked above AI links, bottom-right ──────────
  // Appended to <body> (not the stage) so it escapes the .thinking stacking
  // context and can sit above the noise overlay (z-index 9998).
  const rightPanel = document.createElement('div');
  rightPanel.className = 'thinking__right-panel';
  rightPanel.appendChild(services);
  rightPanel.appendChild(aiLinks);
  document.body.appendChild(rightPanel);

  // ── Orchestration ──────────────────────────────────────────────────────────
  const reveal = () => {
    section.classList.add('is-visible');
    rightPanel.classList.add('services-on');
  };

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
    rightPanel.classList.remove('services-on');
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
    // Only reveal if the user has already scrolled into the thinking section
    // (top is at or above the viewport). Positive rect.top means the section
    // is below the fold — don't show dropdowns while the user is on hero.
    if (rect.top <= 0 && rect.bottom > 0) reveal();
  });

  // Prism cross-fade for the service dropdowns only (main.js). The AI-links bar
  // lives in the same panel but persists across sections, so it's excluded here.
  // Suppresses the transition so opacity tracks scroll exactly.
  function setServicesOpacity(v) {
    services.style.transition = 'none';
    services.style.opacity = String(v.toFixed(3));
  }

  return { section, orbital, rightPanel, setServicesOpacity };
}
