#include common.glsl;

// Awards backdrop — IDENTICAL to the clients section's field (the shared
// awardsBackdrop + the body-level #noise overlay, which is left visible here),
// plus one addition: a soft gold halo that follows the cursor so the user
// visibly "warms" the dark stage as they explore the trophy cloud. No extra
// grain and no uProgress fade — anything beyond the halo would make the
// backdrop diverge from clients.

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;

  vec3 col = awardsBackdrop(uv, aspect);

  // Aspect-corrected centred coords (same space the awards section uses for
  // the cloud raycaster) so the halo tracks the cursor 1:1 at any aspect.
  vec2 cUv  = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 mPos = vec2(uMouse.x * 0.5 * aspect, uMouse.y * 0.5);
  float dM  = length(cUv - mPos);

  // Two stacked exponential falloffs — a tight warm core and a wide diffuse
  // bleed — additive so the gold lives on top of the charcoal backdrop without
  // washing it out where the cursor isn't. uProgress ramps 0→1 on section
  // enter so the halo fades in rather than snapping to full strength; on phones
  // it's held at 0 (no cursor → no hover glow).
  float halo = exp(-dM * 2.4) * 0.10 + exp(-dM * 5.2) * 0.05;
  vec3 gold  = vec3(0.85, 0.62, 0.24);
  col += gold * halo * uProgress;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
