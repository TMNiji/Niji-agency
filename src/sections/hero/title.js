// Hero title — glyph-scramble decoding effect on first paint.

import { prefersReducedMotion } from '@modules/motion.js';

const GLYPHS = '!<>-_\\/[]{}—=+*^?#________01∮ABCDEF0123456789';

/**
 * Reveals the title character-by-character using a "decoding" scramble.
 * - Each character cycles through random glyphs before resolving to its target.
 * - Stagger per character + ease-out gives a tech/glitch feel.
 *
 * @param {Object} opts
 * @param {string} opts.text  - target string to resolve to
 * @param {number} [opts.duration=1200] - total animation duration (ms)
 * @param {number} [opts.stagger=22]   - per-character offset (ms)
 */
export function createTitle({ text, duration = 1200, stagger = 22 } = {}) {
  const el = document.createElement('h1');
  el.className = 'hero-title';
  el.dataset.text = text;

  // Pre-fill with random glyphs so layout settles before the animation runs.
  el.textContent = scrambleString(text);

  function play() {
    // Respect reduced-motion — show the final title immediately, no scramble.
    if (prefersReducedMotion()) {
      el.textContent = text;
      el.dispatchEvent(new CustomEvent('title:decoded'));
      return;
    }

    // Lock the box to the final text's measured size for the duration of the
    // scramble. Glyph widths differ frame-to-frame; without this, each frame
    // re-wraps and re-lays-out the <h1>. Spaces/newlines stay at the same
    // indices, so a fixed box keeps wrapping identical — repaint, not reflow.
    el.textContent = text;
    const lockW = el.offsetWidth;
    const lockH = el.offsetHeight;
    el.style.width  = `${lockW}px`;
    el.style.height = `${lockH}px`;

    const start = performance.now();
    const chars = text.split('');
    // When each character "locks": resolveAt[i] = stagger * i, plus ease window.
    const lockTimes = chars.map((_, i) => stagger * i);

    function frame(now) {
      const t = now - start;
      let buf = '';
      for (let i = 0; i < chars.length; i++) {
        const target = chars[i];
        if (target === ' ' || target === '\n') {
          buf += target;
          continue;
        }
        const locked = t >= lockTimes[i] + 220;            // 220ms scramble window
        if (locked) {
          buf += target;
        } else if (t < lockTimes[i]) {
          // Not yet started — keep the current scrambled glyph stable for a moment.
          buf += randomGlyph();
        } else {
          buf += randomGlyph();
        }
      }
      el.textContent = buf;
      if (t < duration) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = text;                              // ensure exact final
        el.style.width = '';                                // release the locked box
        el.style.height = '';
        el.dispatchEvent(new CustomEvent('title:decoded'));
      }
    }
    requestAnimationFrame(frame);
  }

  // Public API
  return {
    el,
    play,
    getText() { return el.textContent ?? ''; },
    setText(next) {
      el.dataset.text = next;
      el.textContent = next;
    },
  };
}

function randomGlyph() {
  return GLYPHS[(Math.random() * GLYPHS.length) | 0];
}

function scrambleString(s) {
  return s
    .split('')
    .map((c) => (c === ' ' || c === '\n' ? c : randomGlyph()))
    .join('');
}
