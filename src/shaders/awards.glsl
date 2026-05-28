#include common.glsl;

// Awards backdrop — the shared dark radial + grain field (see awardsBackdrop in
// common.glsl), plus a soft gold halo that follows the cursor so the user
// visibly "warms" the dark stage as they explore the trophy cloud.
// uProgress crossfades it in from black on section enter, so the
// clients→awards hand-off is a smooth bg morph rather than a hard shader swap.

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
  // washing it out where the cursor isn't. Toned down from 0.45/0.20: at the
  // peak the gold was washing the trophy cloud and the noise underneath.
  float halo = exp(-dM * 2.4) * 0.20 + exp(-dM * 5.2) * 0.09;
  vec3 gold  = vec3(0.85, 0.62, 0.24);
  col += gold * halo;

  // Extra film grain — added on top of the shared backdrop's subtle base grain
  // so the awards background reads textured even with the body-level #noise
  // overlay hidden during this section (it would otherwise crosshatch the
  // gold trophies, which the user wants kept clean).
  float gExtra = hash21(gl_FragCoord.xy + fract(uTime) * 213.7);
  col += (gExtra - 0.5) * 0.060;

  // uProgress fades the whole field in from black on section enter.
  col *= uProgress;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
