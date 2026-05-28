// Hero title — four stacked lines, each its own size/alignment, with a "living"
// glitch effect. Letters keep their N27 form, but for the first few seconds
// after load a random letter flickers into a decorative face (Niconne script or
// Rubik 80s Fade) for a beat, as if the title were being hacked in place. When
// the glitch self-stops a few seconds in, it FREEZES: whatever letters are
// switched at that instant keep their decorative face, the flicker just stops.
// A page reload replays it from the start.

import { gsap } from 'gsap';
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
 * @param {string[]|null} [opts.glitchFontClasses] - decorative face classes a
 *   glitched letter can flip to. Pass `null` to keep the flicker but skip the
 *   font swap (footer uses this — flicker only, no glyph morph).
 */
export function createTitle({
  lines = [],
  baseClass = 'hero-title',
  tag = 'h1',
  glitchDuration = GLITCH_DURATION,
  glitchFontClasses,
} = {}) {
  const el = document.createElement(tag);
  el.className = baseClass;

  // Decorative faces a glitched letter can flip to (CSS classes, e.g. hero.css).
  const glitchFonts = glitchFontClasses ?? [`${baseClass}__char--niconne`, `${baseClass}__char--rubik`];

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
      // Per-letter exit threshold — scrolling out of the section ramps
      // `--exit` 0 → 1 on the root; each letter pops off when --exit crosses
      // its own --exit-t. Deterministic hash with a +374761393 constant so
      // index 0 doesn't collapse to 0 (the first "W" was disappearing at rest
      // because exit-t=0 made `(exit-t − exit) × 14` clamp to 0 even with
      // exit=0). Range biased to [0.1, 0.95] so every letter starts fully
      // visible — the multiplier ×14 makes 0.1 already clamp to opacity 1.
      const h = ((charSpans.length * 2654435761 + 374761393) >>> 0) % 1000;
      const exitT = 0.1 + (h / 1000) * 0.85;
      span.style.setProperty('--exit-t', exitT.toFixed(3));
      line.appendChild(span);
      charSpans.push(span);
    }
    el.appendChild(line);
  }

  let timer = null;
  let stopTimer = null;
  let running = false;
  let locked = false;
  let exitTimer = null;
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
    if (glitchFonts.length) s.classList.remove(...glitchFonts);
    s.classList.add('is-glitch');
    if (glitchFonts.length) {
      s.classList.add(glitchFonts[(Math.random() * glitchFonts.length) | 0]);
    }
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

  // Replay the intro from scratch — used by the seamless loop in main.js after
  // wrapping the page. Cancels any in-flight run, clears every frozen
  // decorative face so all letters start clean, then plays again. play() alone
  // is a no-op while running is true, hence this dedicated entry point.
  function replay() {
    clearTimeout(stopTimer);
    stopTimer = null;
    if (running) stop();
    charSpans.forEach((s) => s.classList.remove(...glitchFonts));
    play();
  }

  // Burst: flicker every letter at once for one CSS blink cycle. Used by the
  // loop exit so the contact email reads as "glitching out" rather than just
  // fading away. Stops the regular spawn so the burst is the only thing on
  // screen for that beat; play()/replay() resumes the running glitch after.
  function glitchBurst() {
    running = false;
    clearTimeout(timer);
    revertTimers.forEach((id) => clearTimeout(id));
    revertTimers.clear();
    charSpans.forEach((s) => {
      s.classList.remove('is-glitch');
      // Force a reflow so re-adding the class restarts the CSS animation.
      void s.offsetWidth;
      s.classList.add('is-glitch');
      if (glitchFonts.length) {
        s.classList.add(glitchFonts[(Math.random() * glitchFonts.length) | 0]);
      }
    });
  }

  // Scroll-out glitch — driven by the section's scroll progress. CSS uses --exit
  // + per-letter --exit-t to pop letters off in a randomized order; this side
  // pumps an aggressive glitch loop so the title visibly shatters apart
  // (faster spawn, multiple letters at once) while it disappears.
  function setExit(amount) {
    const a = Math.max(0, Math.min(1, amount));
    el.style.setProperty('--exit', a.toFixed(3));
    el.classList.toggle('is-exiting', a > 0.02);
    if (a > 0.02) {
      if (!exitTimer) {
        clearTimeout(stopTimer);
        running = true;
        if (!locked) lockWidths();
        const tick = () => {
          // Burst — more letters glitch per tick as exit advances.
          const burst = 1 + Math.floor(a * 4);
          for (let i = 0; i < burst; i++) glitchOne();
          exitTimer = setTimeout(tick, 50);
        };
        tick();
      }
    } else if (exitTimer) {
      clearTimeout(exitTimer);
      exitTimer = null;
    }
  }

  // Tweened glitch in/out — used by clients, awards, contact to glitch their
  // titles into/out of view on section enter/leave. Internally drives setExit
  // (which already wires the per-letter pop + spawn-burst loop) so the visual
  // matches the hero title's scroll-out shatter, just on a fixed duration
  // instead of being scrubbed by section progress.
  const exitVal = { v: 0 };
  function glitchIn(duration = 0.7) {
    if (!locked) lockWidths();
    gsap.killTweensOf(exitVal);
    if (prefersReducedMotion()) { setExit(0); return; }
    exitVal.v = 1;
    setExit(1);
    gsap.to(exitVal, {
      v: 0,
      duration,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => setExit(exitVal.v),
    });
  }
  function glitchOut(duration = 0.5) {
    gsap.killTweensOf(exitVal);
    if (prefersReducedMotion()) { setExit(1); return; }
    gsap.to(exitVal, {
      v: 1,
      duration,
      ease: 'power2.in',
      overwrite: true,
      onUpdate: () => setExit(exitVal.v),
    });
  }

  return {
    el,
    play,
    replay,
    glitchBurst,
    setExit,
    glitchIn,
    glitchOut,
    destroy() {
      running = false;
      gsap.killTweensOf(exitVal);
      clearTimeout(timer);
      clearTimeout(stopTimer);
      clearTimeout(exitTimer);
      revertTimers.forEach((id) => clearTimeout(id));
      revertTimers.clear();
      window.removeEventListener('resize', relock);
    },
  };
}
