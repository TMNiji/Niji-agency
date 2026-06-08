// Contact section — a glitching headline pinned in a fixed stage, just like the
// other sections (video/clients/awards). The headline reuses the hero title's
// font-glitch (createTitle): letters flicker for a few seconds, then freeze.
// main.js reveals the stage and calls setActive(true) on section enter, which
// plays the glitch once. Below the headline, two columns: the "Explore with AI"
// bar on one side, the named contact list (topic + mailto) on the other.

import { createTitle } from '../hero/title.js';
import { createAiLinks, DEFAULT_AI_LINKS } from '../shared/aiLinks.js';

const DEFAULT_HEADLINE = ['Question rapide, demandez à votre IA.', 'Sujet sérieux, demandez à un humain.'];
const DEFAULT_EMAIL = 'hello@niji.agency';
const DEFAULT_LOOP_LABEL = 'Keep scrolling — back to start';

// Break a headline sentence into non-wrapping glitch lines. The title builder
// renders one line per array entry with white-space:nowrap, so we split at the
// first comma to keep each column heading on two balanced lines.
function splitHeadline(sentence) {
  const i = sentence.indexOf(',');
  if (i === -1) return [sentence];
  return [sentence.slice(0, i + 1), sentence.slice(i + 1).trim()];
}

export function mountFooter({ container, content = null } = {}) {
  const HEADLINE   = content?.contact?.headline?.length ? content.contact.headline : DEFAULT_HEADLINE;
  const EMAIL      = content?.contact?.email ?? DEFAULT_EMAIL;
  const LOOP_LABEL = content?.contact?.loopLabel ?? DEFAULT_LOOP_LABEL;
  const section = container.querySelector('[data-section="contact"]');
  if (!section) return null;
  section.classList.add('footer');

  const stage = document.createElement('div');
  stage.className = 'footer__stage';
  section.appendChild(stage);

  // Two-column layout: each half of the headline tops its own column — the AI
  // side (left) over the "Explore with AI" bar, the human side (right) over the
  // single contact email. Both titles reuse the hero glitch (blink only, no
  // glyph swap via glitchFontClasses: []).
  const makeTitle = (sentence) => {
    const t = createTitle({
      lines: splitHeadline(sentence),
      baseClass: 'footer-headline',
      tag: 'span',
      glitchFontClasses: [],
    });
    t.el.classList.add('footer__col-title');
    return t;
  };
  const titleAi    = makeTitle(HEADLINE[0]);
  const titleHuman = makeTitle(HEADLINE[1] ?? DEFAULT_HEADLINE[1]);

  const columns = document.createElement('div');
  columns.className = 'footer__columns';
  stage.appendChild(columns);

  // Left column — AI heading + "Explore with AI" bar (same icon chrome as the
  // right-panel version). main.js hides the right-panel AI bar on contact, so
  // the two never overlap.
  const aiData = content?.contact?.aiLinks?.buttons?.length
    ? content.contact.aiLinks
    : (content?.thinking?.aiLinks?.buttons?.length ? content.thinking.aiLinks : DEFAULT_AI_LINKS);
  const { el: aiBar } = createAiLinks({ data: aiData, baseClass: 'footer__ai-links' });
  const aiCol = document.createElement('div');
  aiCol.className = 'footer__col footer__col--ai';
  aiCol.append(titleAi.el, aiBar);
  columns.appendChild(aiCol);

  // Right column — human heading + a single mailto address.
  const contactsCol = document.createElement('div');
  contactsCol.className = 'footer__col footer__contacts';
  const item = document.createElement('a');
  item.className = 'footer__contact';
  const MAIL_SUBJECT = 'Prise de contact';
  const MAIL_BODY = "J'ai potentiellement un projet sur lequel vous pourriez m'aider et j'aimerais en savoir plus sur votre agence.";
  item.href = `mailto:${EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(MAIL_BODY)}`;
  const emailEl = document.createElement('span');
  emailEl.className = 'footer__contact-email';
  emailEl.textContent = EMAIL;
  item.appendChild(emailEl);
  contactsCol.append(titleHuman.el, item);
  columns.appendChild(contactsCol);

  // Loop hint — bottom-centre button that signals scrolling past the contact
  // section wraps the page back to the top. Clicking it scrolls to the start
  // immediately (cheaper UX than waiting for the auto-loop). The hint is
  // anchored to the stage's bottom so it sits below the AI bar regardless of
  // viewport height.
  const loopCta = document.createElement('button');
  loopCta.type = 'button';
  loopCta.className = 'footer__loop-cta';
  loopCta.setAttribute('aria-label', 'Back to start');
  loopCta.innerHTML = `
    <span class="footer__loop-cta-label"></span>
    <span class="footer__loop-cta-arrow" aria-hidden="true">↓</span>
  `;
  loopCta.querySelector('.footer__loop-cta-label').textContent = LOOP_LABEL;
  loopCta.addEventListener('click', () => {
    // Defer to the seamless loop handler in main.js by triggering a scroll
    // past the document bottom. Falls back to native scroll-to-top if Lenis
    // isn't wired up yet (e.g. during boot).
    const lenis = window.__niji?.lenis;
    if (lenis) lenis.scrollTo(lenis.limit, { duration: 0.8 });
    else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  });
  stage.appendChild(loopCta);

  // Fan a glitch call out to both column titles so they animate in lockstep.
  const glitchBoth = (method, dur) => { titleAi[method](dur); titleHuman[method](dur); };

  return {
    section,
    // main.js's seamless-loop exit calls `title.glitchOut` — fan it to both.
    title: { glitchOut: (d) => glitchBoth('glitchOut', d) },
    // Toggled by main.js on section enter/leave.
    setActive(on) {
      if (on) glitchBoth('glitchIn', 0.7);
      else    glitchBoth('glitchOut', 0.4);
    },
    destroy() {
      titleAi.destroy();
      titleHuman.destroy();
    },
  };
}
