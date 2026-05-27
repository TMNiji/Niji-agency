// Shared motion language — one source of truth for easing curves and durations.
// JS consumers import `ease`/`duration`; CSS mirrors the same curves via the
// custom properties declared in main.css (:root). Keep the two in sync.

// Easing functions operate on a normalised t ∈ [0,1] and return eased ∈ [0,1].
export const ease = {
  // Decelerating — responsive start, gentle settle. The site's signature curve.
  outExpo:   (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outCubic:  (t) => 1 - Math.pow(1 - t, 3),
  outQuart:  (t) => 1 - Math.pow(1 - t, 4),
  // Symmetric soft start + soft end — good for scroll-scrubbed reveals.
  smoothstep:   (t) => t * t * (3 - 2 * t),
  smootherstep: (t) => t * t * t * (t * (t * 6 - 15) + 10),
};

// Durations in seconds (JS) — the CSS mirror uses ms.
export const duration = {
  fast: 0.15,
  base: 0.6,
  slow: 1.1,
};

// CSS bezier mirror of `ease.outExpo` — used by JS that sets inline transitions.
export const CSS_EASE_OUT_EXPO = 'cubic-bezier(0.22, 1, 0.36, 1)';

// Lenis expects an easing over t ∈ [0,1]; reuse the signature curve.
export const lenisEasing = ease.outExpo;

let _reducedMotion = null;
// Cached so per-frame callers don't hit matchMedia repeatedly. Updated live
// if the user toggles the OS setting mid-session.
export function prefersReducedMotion() {
  if (_reducedMotion === null) {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    _reducedMotion = mq?.matches ?? false;
    mq?.addEventListener?.('change', (e) => { _reducedMotion = e.matches; });
  }
  return _reducedMotion;
}
