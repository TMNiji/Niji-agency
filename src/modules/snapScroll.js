// Snap-scroll — once the user's momentum fades, Lenis animates to the nearest
// section boundary so the viewport always rests on a clean section start.
//
// getSnapPoints: () => number[]  — called each time so it stays correct after
//   resize (sections are sized in vh units, so their px offset changes).
//
// Two paths converge on trySnap():
//   1. Lenis 'scroll' event — handles the common case (slow scrolling, mid-page).
//   2. Wheel/touch debounce — handles the bottom-of-page case where Lenis is
//      already at limit: it then silently clamps further wheel events without
//      emitting a 'scroll', so the listener above never gets to react.

const MOVING_THRESHOLD = 2.0;  // px/frame — above this: still in flight
const AT_POINT_MARGIN  = 2;    // px       — within this of a snap point: done
const SETTLE_DEBOUNCE  = 120;  // ms       — quiet window after input before forcing a snap check
// Snap only when within this fraction of viewport height of a target.
// Outside the window, the user is mid-section consuming content — let them rest.
const SNAP_WINDOW_VH   = 0.4;

export function initSnapScroll(lenis, getSnapPoints) {
  let isSnapping = false;
  let settleTimer = null;

  function nearestSnap(y) {
    const pts = getSnapPoints();
    if (!pts.length) return null;
    const nearest = pts.reduce(
      (best, pt) => (Math.abs(pt - y) < Math.abs(best - y) ? pt : best),
      pts[0],
    );
    // Only return the target if it's within the snap window — otherwise the
    // user is deep inside a section and snapping back would yank them off the
    // content they're reading.
    const snapWindow = window.innerHeight * SNAP_WINDOW_VH;
    return Math.abs(nearest - y) <= snapWindow ? nearest : null;
  }

  function trySnap() {
    // Snap in progress — leave it alone. If lenis isn't actually animating,
    // the flag is stale: a tiny wheel scroll interrupted our previous
    // animation, so onComplete never fired. Clear it and re-snap.
    if (isSnapping && lenis.isScrolling === 'smooth') return;
    isSnapping = false;

    const scroll = lenis.animatedScroll;
    const target = nearestSnap(scroll);
    if (target === null) return;
    if (Math.abs(target - scroll) < AT_POINT_MARGIN) return;

    isSnapping = true;
    lenis.scrollTo(target, {
      duration: 0.45,
      // ease-in-out cubic — deliberate section-flip, not inertial scroll feel
      easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
      onComplete: () => { isSnapping = false; },
    });
  }

  lenis.on('scroll', ({ velocity }) => {
    // Still decelerating — let Lenis finish its own easing first.
    if (Math.abs(velocity) > MOVING_THRESHOLD) return;
    trySnap();
  });

  // Fallback for the bottom-of-page case: at lenis.limit, further wheel/touch
  // input is clamped without producing 'scroll' events, so the listener above
  // never sees that input is over. Debounce raw input to force a snap check
  // once the user is genuinely idle.
  const onInput = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(trySnap, SETTLE_DEBOUNCE);
  };
  window.addEventListener('wheel',     onInput, { passive: true });
  window.addEventListener('touchmove', onInput, { passive: true });
  window.addEventListener('touchend',  onInput, { passive: true });
}
