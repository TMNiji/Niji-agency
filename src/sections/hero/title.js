// Hero title — four stacked lines, each its own size/alignment, with a "living"
// glitch effect. Letters keep their N27 form, but for the first few seconds
// after load a random letter flickers into a decorative face (Niconne script or
// Rubik 80s Fade) for a beat, as if the title were being hacked in place. When
// the glitch self-stops a few seconds in, it FREEZES: whatever letters are
// switched at that instant keep their decorative face, the flicker just stops.
// A page reload replays it from the start.

import { prefersReducedMotion } from '@modules/motion.js';

const GLITCH_LIFE = 560;       // ms a letter stays glitched — matches the CSS blink
const SPAWN_MIN = 170;         // ms — shortest gap between two glitch spawns
const SPAWN_MAX = 600;         // ms — longest gap
const GLITCH_DURATION = 5000;  // ms — default time after which switching stops (and freezes)

/**
 * Builds the title as stacked lines of per-letter spans and animates a
 * time-boxed font-glitch that freezes on stop.
 *
 * @param {Object} opts
 * @param {Array<string|{text:string, cls?:string}>} opts.lines - one entry per
 *   visual line; an object can carry a per-line modifier class.
 * @param {string} [opts.baseClass] - BEM block prefix for the generated element
 *   and its line/char classes, so the same glitch can be themed per use
 *   (hero title vs footer email).
 * @param {string} [opts.tag] - element tag for the root (default 'h1').
 * @param {number} [opts.glitchDuration] - ms before switching freezes. Pass
 *   `Infinity` to keep it running forever (the footer never freezes).
 */
export function createTitle({
  lines = [],
  baseClass = 'hero-title',
  tag = 'h1',
  glitchDuration = GLITCH_DURATION,
} = {}) {
  const el = document.createElement(tag);
  el.className = baseClass;

  // Decorative faces a glitched letter can flip to (CSS classes, e.g. hero.css).
  const glitchFonts = [`${baseClass}__char--niconne`, `${baseClass}__char--rubik`];

  // Each line is a block span; letters within are width-locked inline-block
  // spans (set on play) so a font swap changes only the glyph, never the
  // layout. A leading "&" gets the raised-ampersand modifier.
  const charSpans = [];
  for (const item of lines) {
    const text = typeof item === 'string' ? item : item.text;
    const cls  = typeof item === 'string' ? '' : (item.cls ?? '');
    const line = document.createElement('span');
    line.className = cls ? `${baseClass}__line ${cls}` : `${baseClass}__line`;
    for (const ch of text) {
      if (ch === ' ') {
        line.appendChild(document.createTextNode(' '));
        continue;
      }
      const span = document.createElement('span');
      span.className = `${baseClass}__char`;
      if (ch === '&') span.classList.add(`${baseClass}__char--amp`);
      span.textContent = ch;
      line.appendChild(span);
      charSpans.push(span);
    }
    el.appendChild(line);
  }

  let timer = null;
  let stopTimer = null;
  let running = false;
  let locked = false;
  const revertTimers = new Map();   // span → pending revert timeout

  // Pin each letter's box to its N27 advance width so swapping to a wider/
  // narrower face doesn't shift its neighbours (the glyph overflows centred).
  // Any decorative face currently on a letter is preserved across the re-measure.
  function lockWidths() {
    const fonts = charSpans.map((s) => {
      const f = glitchFonts.find((c) => s.classList.contains(c)) ?? null;
      if (f) s.classList.remove(f);
      s.style.width = '';
      return f;
    });
    const widths = charSpans.map((s) => s.getBoundingClientRect().width);
    charSpans.forEach((s, i) => {
      s.style.width = `${widths[i].toFixed(2)}px`;
      if (fonts[i]) s.classList.add(fonts[i]);
    });
    locked = true;
  }

  function glitchOne() {
    const idle = charSpans.filter((s) => !s.classList.contains('is-glitch'));
    if (!idle.length) return;
    const s = idle[(Math.random() * idle.length) | 0];
    const font = glitchFonts[(Math.random() * glitchFonts.length) | 0];
    s.classList.remove(...glitchFonts);   // clear any face left frozen from a prior run
    s.classList.add('is-glitch', font);
    const id = setTimeout(() => {
      s.classList.remove('is-glitch', ...glitchFonts);
      revertTimers.delete(s);
    }, GLITCH_LIFE);
    revertTimers.set(s, id);
  }

  function spawn() {
    if (!running) return;
    glitchOne();
    timer = setTimeout(spawn, SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN));
  }

  // Freeze: stop spawning and cancel pending reverts so currently-switched
  // letters keep their decorative face. Drop only `is-glitch` so the flicker
  // ends but the swapped glyph stays. Width locks remain in place.
  function stop() {
    running = false;
    clearTimeout(timer);
    revertTimers.forEach((id, s) => {
      clearTimeout(id);
      s.classList.remove('is-glitch');
    });
    revertTimers.clear();
  }

  function play() {
    // Reduced motion: leave the title static in its base face, no glitching.
    if (prefersReducedMotion()) return;
    // Wait for fonts so width measurement reflects N27, not a fallback face.
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (running) return;
      lockWidths();
      running = true;
      spawn();
      // Finite duration freezes the glitch on stop; Infinity keeps it running.
      if (Number.isFinite(glitchDuration)) stopTimer = setTimeout(stop, glitchDuration);
    });
  }

  // Re-measure after a resize — the title's font-size is viewport-relative.
  // Skipped until the first play so a reduced-motion title is never touched.
  function relock() {
    if (locked) lockWidths();
  }
  window.addEventListener('resize', relock);

  return {
    el,
    play,
    destroy() {
      running = false;
      clearTimeout(timer);
      clearTimeout(stopTimer);
      revertTimers.forEach((id) => clearTimeout(id));
      revertTimers.clear();
      window.removeEventListener('resize', relock);
    },
  };
}
