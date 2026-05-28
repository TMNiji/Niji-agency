import { createOrbital } from '../hero/orbital.js';
import { createAiLinks, DEFAULT_AI_LINKS } from '../shared/aiLinks.js';

const DEFAULT_SERVICES = [
  { tag: 'PRODUCT',  items: ['Product Design', 'User Research'] },
  { tag: 'BUSINESS', items: ['Brand Strategy', 'Market Analysis'] },
  { tag: 'BRANDING', items: ['Visual Identity', 'Brand Systems'] },
  { tag: 'TECH',     items: ['Frontend Engineering', 'System Design'] },
];

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
  const { el: aiLinks } = createAiLinks({ data: AI_LINKS, baseClass: 'thinking__ai-links' });

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
    webgl?.shaderPlane?.setCellGrow(1);
    orbital.show();   // appear in sync with the cell
    reveal();
  });

  // Drive the cell's continued growth across BUILD. uCellGrow > 1 balloons
  // the cell past default size — the "walk-through" — and the prism shader
  // reads the same uniform so the cell stays the right size after the shader
  // swap instead of snapping back to default.
  orchestrator?.onProgress('thinking', ({ progress }) => {
    // Map BUILD's full scroll to a 1 → 2.30 growth ramp, capped so the cell
    // stops swelling once the prism rainbow begins fading the cell out anyway.
    const extra = Math.min(progress / 0.85, 1.0);
    webgl?.shaderPlane?.setCellGrow(1 + extra * 1.3);
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
