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
  vec3 col = vec3(0.0);

  // ── Cell — revealed by scroll progress ──────────────────────────────────
  // Reveal spans most of the section so the cell emerges across the whole
  // explosion scrub (not crammed into the first 42%). It is ~full by the time
  // the face-pack fragments finish fading (opacity hits 0 around uProgress ≈
  // 0.82, see facePack.js), with a short hold to the section end so snapping to
  // the boundary always lands on the fully-formed cell.
  float reveal = smoothstep(0.12, 0.90, uProgress);
  // Cell grows from a smaller "far" size up to full size as it resolves, so it
  // reads as rushing toward the viewer through the dissolving face-pack layers.
  // A >1 multiplier zooms the cell coords out (smaller cell); it settles to 1.0
  // (full size) by the time the reveal completes.
  float cellScale = mix(1.45, 1.0, reveal);
  col += drawCell(cUv * cellScale, reveal, 0.0);

  // ── Cinematic finish — grain comes from the DOM #noise overlay ───────────
  col *= vignette(dc);

  // Shared dark backdrop beneath the (vignetted) cell — un-vignetted so it reads
  // the same as the standalone awards section.
  col += awardsBackdrop(uv, aspect);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
