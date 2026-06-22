import { createOrbital } from '../hero/orbital.js';
import { createAiLinks, DEFAULT_AI_LINKS } from '../shared/aiLinks.js';
import { createServiceDropdowns } from '../shared/serviceDropdowns.js';
import { pick } from '@/lib/lang.js';

const DEFAULT_SERVICES = {
  fr: [
    { tag: 'PRODUCT',  items: ['Vision, conception et roadmap',     'Design system, tokens, gouvernance'] },
    { tag: 'AI',       items: ['Audit, workflows',                  'Développement d\'agents'] },
    { tag: 'BUSINESS', items: ['Unit economics, cost-to-serve',      'Cadrage produit, business case, go-to-market'] },
    { tag: 'BRANDING', items: ['Plateforme et positionnement',      'Promesse, preuves, expérience'] },
  ],
  en: [
    { tag: 'PRODUCT',  items: ['Vision, design and roadmap',        'Design system, tokens, governance'] },
    { tag: 'AI',       items: ['Audit, workflows',                  'Agent development'] },
    { tag: 'BUSINESS', items: ['Unit economics, cost-to-serve',     'Product scoping, business case, go-to-market'] },
    { tag: 'BRANDING', items: ['Platform and positioning',         'Promise, proof, experience'] },
  ],
};

export function mountThinking({ container, orchestrator, webgl, content = null, lang = 'fr' } = {}) {
  const section = container.querySelector('[data-section="thinking"]');
  if (!section) return null;
  section.classList.add('thinking');

  // ── Sticky stage — pins to viewport; holds cell + orbital ─────────────────
  const stage = document.createElement('div');
  stage.className = 'thinking__stage';
  section.appendChild(stage);

  const orbital = createOrbital({ stage, cards: content?.thinking?.cards, lang });

  // ── Service panel — dropdowns ──────────────────────────────────────────────
  const SERVICES   = content?.thinking?.services?.length ? content.thinking.services : pick(DEFAULT_SERVICES, lang);
  const AI_LINKS   = content?.thinking?.aiLinks?.buttons?.length ? content.thinking.aiLinks : DEFAULT_AI_LINKS;

  const { el: services } = createServiceDropdowns({ services: SERVICES });

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
    services.classList.add('is-on');
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
    services.classList.remove('is-on');
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
