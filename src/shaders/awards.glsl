#include common.glsl;

// Awards backdrop — the shared dark radial + grain field (see awardsBackdrop in
// common.glsl). uProgress crossfades it in from black on section enter, so the
// clients→awards hand-off is a smooth bg morph rather than a hard shader swap.

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;

  vec3 col = awardsBackdrop(uv, aspect) * uProgress;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
