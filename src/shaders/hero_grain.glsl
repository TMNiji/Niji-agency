#include common.glsl;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;

  // Aspect-corrected coords centred on screen.
  vec2 cUv = uv - vec2(0.5);
  cUv.x *= aspect;
  float dc = length(cUv);

  // Pure black background — no halo or atmosphere. The cell emerges directly
  // out of darkness as the face pack explodes.
  vec3 col = vec3(0.0);

  // ── Cell — revealed by scroll progress ──────────────────────────────────
  // Reveal spans most of the section so the cell emerges across the whole
  // explosion scrub (not crammed into the first 42%). It is ~full by the time
  // the face-pack fragments finish fading (opacity hits 0 around uProgress ≈
  // 0.82, see facePack.js), with a short hold to the section end so snapping to
  // the boundary always lands on the fully-formed cell.
  float reveal = smoothstep(0.12, 0.90, uProgress);
  col += drawCell(cUv, reveal, 0.0);

  // ── Cinematic finish — grain comes from the DOM #noise overlay ───────────
  col *= vignette(dc);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
