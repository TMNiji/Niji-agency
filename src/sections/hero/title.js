// Hero title — "living" glitch effect. Letters keep their N27 form, but every
// so often a random letter flickers into a decorative face (Niconne script or
// Rubik 80s Fade) for a beat, as if the title were being hacked in place.

import { prefersReducedMotion } from '@modules/motion.js';

// Decorative faces a glitched letter can flip to (CSS classes in hero.css).
const GLITCH_FONTS = ['hero-title__char--niconne', 'hero-title__char--rubik'];
const GLITCH_LIFE = 460;   // ms a letter stays glitched — matches the CSS blink
const SPAWN_MIN = 90;      // ms — shortest gap between two glitch spawns
const SPAWN_MAX = 380;     // ms — longest gap

/**
 * Builds the title as per-letter spans and animates an ongoing font-glitch.
 *
 * @param {Object} opts
 * @param {string} opts.text - the title string
 */
export function createTitle({ text } = {}) {
  const el = document.createElement('h1');
  el.className = 'hero-title';
  el.dataset.text = text;

  // Letters become inline-block spans (width-locked on play) so a font swap
  // changes only the glyph, never the layout. Each run of letters is wrapped in
  // a `nowrap` word span so the line can only break at the whitespace between
  // words — adjacent inline-block letters would otherwise break apart mid-word.
  // Whitespace/newlines stay as text nodes so wrapping behaves like plain text.
  const charSpans = [];
  let word = null;
  for (const ch of text) {
    if (ch === ' ' || ch === '\n') {
      word = null;
      el.appendChild(document.createTextNode(ch));
      continue;
    }
    if (!word) {
      word = document.createElement('span');
      word.className = 'hero-title__word';
      el.appendChild(word);
    }
    const span = document.createElement('span');
    span.className = 'hero-title__char';
    span.textContent = ch;
    word.appendChild(span);
    charSpans.push(span);
  }

  let timer = null;
  let running = false;

  // Pin each letter's box to its N27 advance width so swapping to a wider/
  // narrower face doesn't shift its neighbours (the glyph overflows centred).
  function lockWidths() {
    charSpans.forEach((s) => { s.style.width = ''; });          // measure natural
    charSpans.forEach((s) => {
      s.style.width = `${s.getBoundingClientRect().width.toFixed(2)}px`;
    });
  }

  function glitchOne() {
    const idle = charSpans.filter((s) => !s.classList.contains('is-glitch'));
    if (!idle.length) return;
    const s = idle[(Math.random() * idle.length) | 0];
    const font = GLITCH_FONTS[(Math.random() * GLITCH_FONTS.length) | 0];
    s.classList.add('is-glitch', font);
    setTimeout(() => s.classList.remove('is-glitch', ...GLITCH_FONTS), GLITCH_LIFE);
  }

  function spawn() {
    if (!running) return;
    glitchOne();
    timer = setTimeout(spawn, SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN));
  }

  function play() {
    // Reduced motion: leave the title static in its base face, no glitching.
    if (prefersReducedMotion()) return;
    // Wait for fonts so width measurement reflects N27, not a fallback face.
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      lockWidths();
      if (running) return;
      running = true;
      spawn();
    });
  }

  // Re-measure after a resize — the title's font-size is viewport-relative.
  function relock() {
    if (!running) return;
    charSpans.forEach((s) => s.classList.remove('is-glitch', ...GLITCH_FONTS));
    lockWidths();
  }
  window.addEventListener('resize', relock);

  return {
    el,
    play,
    destroy() {
      running = false;
      clearTimeout(timer);
      window.removeEventListener('resize', relock);
    },
  };
}
