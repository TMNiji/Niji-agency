// Contact section — a single mailto link pinned in a fixed stage, just like the
// other sections (video/clients/awards). The address reuses the hero title's
// font-glitch (createTitle): letters flicker into a decorative face for a few
// seconds, then freeze. main.js reveals the stage and calls setActive(true) on
// section enter, which plays the glitch once.

import { createTitle } from '../hero/title.js';
import { createAiLinks, DEFAULT_AI_LINKS } from '../shared/aiLinks.js';

const EMAIL = 'contact@niji.fr';

export function mountFooter({ container, content = null } = {}) {
  const section = container.querySelector('[data-section="contact"]');
  if (!section) return null;
  section.classList.add('footer');

  const stage = document.createElement('div');
  stage.className = 'footer__stage';
  section.appendChild(stage);

  const link = document.createElement('a');
  link.className = 'footer__email';
  link.href = `mailto:${EMAIL}`;
  link.setAttribute('aria-label', EMAIL); // letters are split into spans

  // Reuse the hero title's timed auto-glitch (default ~5s, then freezes).
  // glitchFontClasses: [] keeps the per-letter blink but skips the Niconne/Rubik
  // glyph swap — the address stays in N27 the whole time.
  // Displayed uppercase even though the mailto + aria-label keep the canonical
  // lowercase address.
  const title = createTitle({
    lines: [EMAIL.toUpperCase()],
    baseClass: 'footer-email',
    tag: 'span',
    glitchFontClasses: [],
  });
  link.appendChild(title.el);
  stage.appendChild(link);

  // "Explore with AI" bar under the email — same icon chrome as the right-panel
  // version, but centred inside the contact stage. main.js already hides the
  // right-panel AI bar on contact, so the two never overlap.
  const aiData = content?.thinking?.aiLinks?.buttons?.length ? content.thinking.aiLinks : DEFAULT_AI_LINKS;
  const { el: aiBar } = createAiLinks({ data: aiData, baseClass: 'footer__ai-links' });
  stage.appendChild(aiBar);

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
    <span class="footer__loop-cta-label">Keep scrolling — back to start</span>
    <span class="footer__loop-cta-arrow" aria-hidden="true">↓</span>
  `;
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
