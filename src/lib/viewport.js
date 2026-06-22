// Single source of truth for "is this the phone layout?", mirroring the CSS
// breakpoint used across the stylesheets. A phone counts as mobile in BOTH
// orientations: portrait is caught by the width (≤600px); landscape by a small,
// short viewport (≤950px wide AND ≤600px tall) — which covers every phone in
// landscape (≤932px wide, ≤430px tall) while excluding tablets (>950px wide)
// and normal desktops (>600px tall).
export const PHONE_MQ = '(max-width: 600px), (max-width: 950px) and (max-height: 600px)';

export function isPhoneViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(PHONE_MQ).matches;
}
