// Contact section — a glitching headline pinned in a fixed stage, just like the
// other sections (video/clients/awards). The headline reuses the hero title's
// font-glitch (createTitle): letters flicker for a few seconds, then freeze.
// main.js reveals the stage and calls setActive(true) on section enter, which
// plays the glitch once. Below the headline, two columns: the "Explore with AI"
// bar on one side, the named contact list (topic + mailto) on the other.

import { createTitle } from '../hero/title.js';
import { createAiLinks, DEFAULT_AI_LINKS } from '../shared/aiLinks.js';

const DEFAULT_HEADLINE = ['Question rapide, demandez à une IA.', 'Sujet sérieux, demandez à un humain.'];
const DEFAULT_CONTACTS = [
  { topic: 'Pour parler burning platform et impact P&L global', email: 'yv.corbeil@niji.fr' },
  { topic: 'Pour parler AI commerce, conversion, refonte e-commerce', email: 'nicolas.prudhomme@niji.fr' },
  { topic: 'Pour parler produit, branding et agents IA', email: 'chris.de-abreu@niji.fr' },
];
const DEFAULT_LOOP_LABEL = 'Keep scrolling — back to start';

export function mountFooter({ container, content = null } = {}) {
  const HEADLINE   = content?.contact?.headline?.length ? content.contact.headline : DEFAULT_HEADLINE;
  const CONTACTS   = content?.contact?.contacts?.length ? content.contact.contacts : DEFAULT_CONTACTS;
  const LOOP_LABEL = content?.contact?.loopLabel ?? DEFAULT_LOOP_LABEL;
  const section = container.querySelector('[data-section="contact"]');
  if (!section) return null;
  section.classList.add('footer');

  const stage = document.createElement('div');
  stage.className = 'footer__stage';
  section.appendChild(stage);

  // Headline — reuses the hero title's timed auto-glitch (default ~5s, then
  // freezes). glitchFontClasses: [] keeps the per-letter blink but skips the
  // Niconne/Rubik glyph swap, so the text stays in N27 the whole time.
  const title = createTitle({
    lines: HEADLINE,
    baseClass: 'footer-headline',
    tag: 'span',
    glitchFontClasses: [],
  });
  title.el.classList.add('footer__headline');
  stage.appendChild(title.el);

  // Two-column layout below the headline: AI bar on the left, named contacts on
  // the right.
  const columns = document.createElement('div');
  columns.className = 'footer__columns';
  stage.appendChild(columns);

  // "Explore with AI" bar — same icon chrome as the right-panel version, but
  // centred inside the contact stage. main.js already hides the right-panel AI
  // bar on contact, so the two never overlap.
  const aiData = content?.contact?.aiLinks?.buttons?.length
    ? content.contact.aiLinks
    : (content?.thinking?.aiLinks?.buttons?.length ? content.thinking.aiLinks : DEFAULT_AI_LINKS);
  const { el: aiBar } = createAiLinks({ data: aiData, baseClass: 'footer__ai-links' });
  const aiCol = document.createElement('div');
  aiCol.className = 'footer__col footer__col--ai';
  aiCol.appendChild(aiBar);
  columns.appendChild(aiCol);

  // Named contacts — each is a mailto with its topic line above the address.
  const contactsCol = document.createElement('div');
  contactsCol.className = 'footer__col footer__contacts';
  CONTACTS.forEach(({ topic, email }) => {
    const item = document.createElement('a');
    item.className = 'footer__contact';
    item.href = `mailto:${email}`;

    const topicEl = document.createElement('span');
    topicEl.className = 'footer__contact-topic';
    topicEl.textContent = topic;

    const emailEl = document.createElement('span');
    emailEl.className = 'footer__contact-email';
    emailEl.textContent = email;

    item.append(topicEl, emailEl);
    contactsCol.appendChild(item);
  });
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

  return {
    section,
    title,
    // Toggled by main.js on section enter/leave. The contact email used to
    // also run a 5s ambient blink (play / replay) on top of the entrance,
    // which is gone now — the email reads clean once the glitch-in settles,
    // matching the clients / awards titles exactly.
    setActive(on) {
      if (on) title.glitchIn(0.7);
      else    title.glitchOut(0.4);
    },
    destroy() {
      title.destroy();
    },
  };
}
