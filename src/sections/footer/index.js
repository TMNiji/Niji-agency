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

  let played = false;

  return {
    section,
    title,
    // Toggled by main.js on section enter/leave. Start the glitch on the first
    // reveal. The seamless loop calls title.glitchBurst() on its way out and
    // halts the spawn loop, so subsequent enters must replay() to resume the
    // running flicker — without it, the email would land static after a loop.
    setActive(on) {
      if (!on) return;
      if (!played) { played = true; title.play(); }
      else         { title.replay(); }
    },
    destroy() {
      title.destroy();
    },
  };
}
