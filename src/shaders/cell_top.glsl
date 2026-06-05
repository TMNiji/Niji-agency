#include common.glsl;

// Cell-only pass with alpha output — rendered AFTER the face-pack overlay so
// the cell punches through the fragments instead of being covered by them.
// Mirrors hero_grain's cell setup so the two passes are identical where they
// overlap (non-facepack pixels).

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;

  vec2 cUv = uv - vec2(0.5);
  cUv.x *= aspect;
  cUv -= uMouse * 0.02;
  float dc = length(cUv);

  // Lift the cell by uCellOffset (phones) to match hero_grain; vignette stays
  // screen-centred via dc above.
  vec2 cellUv = cUv - vec2(0.0, uCellOffset);
  vec3 col = drawCell(cellUv, uCellGrow, 0.0) * vignette(dc);

  // Alpha tracks the cell's brightness — non-cell pixels stay transparent so
  // the underlying facepack render shows through.
  float alpha = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
