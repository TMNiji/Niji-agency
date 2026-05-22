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
  // Reveal range tightened so the cell is essentially fully present by the
  // time the face-pack fragments finish fading (opacity hits 0 around
  // uProgress ≈ 0.40, see facePack.js). Previously this used a 0→0.70 range,
  // which left the cell at ~60% intensity at the moment the face vanished —
  // producing a visible gap between "face gone" and "cell here".
  float reveal = smoothstep(0.0, 0.42, uProgress);
  col += drawCell(cUv, reveal, 0.0);

  // ── Cinematic finish ─────────────────────────────────────────────────────
  col *= vignette(dc);
  col += (filmGrain(gl_FragCoord.xy) - 0.5) * 0.05;
  col *= uFade;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
