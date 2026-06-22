// Single source of truth for "is this the phone layout?", mirroring the CSS
// breakpoint used across the stylesheets. A phone counts as mobile in BOTH
// orientations: portrait is caught by the width (≤600px); landscape by a small,
// short viewport (≤1024px wide AND ≤720px tall) — which covers phones AND large
// phones/foldables in landscape while still excluding iPads (height 768 > 720)
// and laptops/desktops (width > 1024).
export const PHONE_MQ = '(max-width: 600px), (max-width: 1024px) and (max-height: 720px)';

export function isPhoneViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(PHONE_MQ).matches;
}
