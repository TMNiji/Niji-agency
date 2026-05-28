// Contact section — a single mailto link pinned in a fixed stage, just like the
// other sections (video/clients/awards). The address reuses the hero title's
// font-glitch (createTitle): letters flicker into a decorative face for a few
// seconds, then freeze. main.js reveals the stage and calls setActive(true) on
// section enter, which plays the glitch once.

import { createTitle } from '../hero/title.js';

const EMAIL = 'contact@niji.fr';

export function mountFooter({ container } = {}) {
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

  // glitchDuration: Infinity → the address keeps switching fonts forever.
  const title = createTitle({ lines: [EMAIL], baseClass: 'footer-email', tag: 'span', glitchDuration: Infinity });
  link.appendChild(title.el);
  stage.appendChild(link);

  let played = false;

  return {
    section,
    title,
    // Toggled by main.js on section enter/leave. Start the glitch on the first
    // reveal; it runs forever (glitchDuration: Infinity), so don't restart it.
    setActive(on) {
      if (on && !played) {
        played = true;
        title.play();
      }
    },
    destroy() {
      title.destroy();
    },
  };
}
