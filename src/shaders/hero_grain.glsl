#include common.glsl;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;

  // Aspect-corrected coords centred on screen. A tiny pointer-driven parallax
  // lets the cell drift gently toward the cursor so the field feels alive.
  vec2 cUv = uv - vec2(0.5);
  cUv.x *= aspect;
  cUv -= uMouse * 0.02;
  float dc = length(cUv);

  // Cell emerges over the shared dark backdrop (added below, after the cell is
  // vignetted) so hero / clients / video share one textured base field.
  vec3 col = drawCell(cUv, uCellGrow, 0.0);

  // ── Cinematic finish — grain comes from the DOM #noise overlay ───────────
  col *= vignette(dc);

  // Shared dark backdrop beneath the (vignetted) cell — un-vignetted so it reads
  // the same as the standalone awards section.
  col += awardsBackdrop(uv, aspect);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
