// Preloader controller — drives the real progress counter for the boot overlay
// defined in index.html (styled in styles/preloader.css).
//
// The DOM already paints (and the CSS glitch already runs) during the JS-bundle
// download, so this module's only jobs are: ramp a smoothed 0→100 counter that
// real boot milestones nudge forward, then — once the page is ready — reveal the
// ENTER button and resolve when the visitor clicks it. The page reveal itself
// (the pixel-grid dissolve) is handed off to modules/pixelReveal.js by the
// caller, which also tears this overlay down.
import { prefersReducedMotion } from '@modules/motion.js';

export function createPreloader() {
  const root = document.getElementById('preloader');
  // No markup (e.g. unexpected DOM) → return a no-op so boot never depends on it.
  if (!root) return { to() {}, finish: () => Promise.resolve(), root: null };

  const fill     = root.querySelector('.preloader__bar-fill');
  const pct      = root.querySelector('.preloader__pct');
  const status   = root.querySelector('.preloader__status');
  const enterBtn = root.querySelector('.preloader__enter');

  let target    = 0.08;   // seed so the bar starts with a little life
  let current   = 0;
  let finishing = false;
  let ready     = false;
  let raf       = 0;

  // Status phase is driven by the *displayed* percentage (not the milestone
  // target) so the label and the counter never disagree — on a fast load the
  // eased bar lags the real target, and a label that ran ahead of the number
  // read as a glitch in the wrong sense.
  function phaseFor(n) {
    if (n >= 100) return 'PRÊT';
    if (n >= 80)  return 'ASSEMBLAGE';
    if (n >= 60)  return 'COMPILATION';
    if (n >= 40)  return 'CHARGEMENT';
    return 'INITIALISATION';
  }

  function frame() {
    // Idle creep — keep inching toward 90% so the bar always feels alive even
    // between milestones; real milestones overtake this via Math.max in to().
    if (!finishing && target < 0.9) target = Math.min(0.9, target + 0.0016);

    current += (target - current) * 0.08;
    // Snap once within ~0.5% so the asymptotic tail doesn't linger at a
    // displayed "100%" for a beat before the exit fires.
    if (current > target - 0.005) current = target;

    const p = Math.min(1, current);
    const n = Math.round(p * 100);
    if (fill)   fill.style.transform = `scaleX(${p.toFixed(4)})`;
    if (pct)    pct.textContent = String(n).padStart(2, '0');
    if (status) status.textContent = phaseFor(n);
    root.setAttribute('aria-valuenow', String(n));

    // Reaching 100% stops the rAF loop and reveals the ENTER button; the overlay
    // then waits for the visitor's click (resolved by finish()).
    if (finishing && p >= 1) { reveal(); return; }
    raf = requestAnimationFrame(frame);
  }

  function reveal() {
    cancelAnimationFrame(raf);
    if (ready) return;
    ready = true;
    root.classList.add('is-ready');
    if (enterBtn) enterBtn.disabled = false;
    // Focus the button so keyboard users can press Enter/Space immediately;
    // preventScroll keeps the locked page from jumping.
    enterBtn?.focus?.({ preventScroll: true });
  }

  // Advance the target to `value` (0..1). The status label tracks the eased
  // counter in frame(), so callers only need to push the number forward.
  function to(value) {
    target = Math.max(target, value);
  }

  // Ramp to 100%, reveal the ENTER button, and resolve when it's clicked. The
  // caller owns the page reveal + overlay teardown from there.
  function finish() {
    finishing = true;
    target = 1;
    return new Promise((resolve) => {
      enterBtn?.addEventListener('click', () => {
        if (enterBtn.disabled) return;
        enterBtn.disabled = true; // guard against a double-fire
        resolve();
      }, { once: true });
    });
  }

  // Reduced motion: skip the smoothed ramp; the counter still updates per
  // milestone but without the per-frame easing flourish.
  if (prefersReducedMotion()) current = target;
  raf = requestAnimationFrame(frame);

  return { to, finish, root };
}
