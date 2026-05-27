#include common.glsl;

// Distance from point p to segment [a, b] — used for the bolt.
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - (a + t * ab));
}

// ── Brand-colour spectrum ──────────────────────────────────────────────────
// t = 0 → #F65555 (red)  ·  t = 1 → #8147F5 (deep purple)
// Cascading mix: each stop replaces its predecessor as t crosses n/6.
vec3 brandGradient(float t) {
  vec3 c0 = vec3(0.965, 0.333, 0.333); // #F65555 red
  vec3 c1 = vec3(1.000, 0.635, 0.000); // #FFA200 orange
  vec3 c2 = vec3(0.996, 0.894, 0.251); // #FEE440 yellow
  vec3 c3 = vec3(0.047, 0.910, 0.608); // #0CE89B green
  vec3 c4 = vec3(0.984, 0.373, 0.702); // #FB5FB3 pink
  vec3 c5 = vec3(0.733, 0.278, 0.961); // #BB47F5 purple
  vec3 c6 = vec3(0.506, 0.278, 0.961); // #8147F5 deep purple
  float s  = clamp(t, 0.0, 1.0) * 6.0;
  vec3 col = c0;
  col = mix(col, c1, smoothstep(0.0, 1.0, s - 0.0));
  col = mix(col, c2, smoothstep(0.0, 1.0, s - 1.0));
  col = mix(col, c3, smoothstep(0.0, 1.0, s - 2.0));
  col = mix(col, c4, smoothstep(0.0, 1.0, s - 3.0));
  col = mix(col, c5, smoothstep(0.0, 1.0, s - 4.0));
  col = mix(col, c6, smoothstep(0.0, 1.0, s - 5.0));
  return col;
}

void main() {
  vec2 uv  = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;

  // Aspect-corrected, centre-anchored coords (same space as drawCell).
  vec2 c  = (uv - 0.5) * vec2(aspect, 1.0);
  float dc = length(c);

  vec3 col = vec3(0.0);

  // ── Phase timing ──────────────────────────────────────────────────────────
  //   0.00 → 0.42  bolt travels diagonal bottom-left → cell centre
  //   0.38 → 0.55  cell glows from impact (energize)
  //   0.42 → 0.58  rainbow refracts (the "split")
  //   0.50 → 0.75  bolt fades out as rainbow takes over
  //   0.60 → 0.78  rainbow's sharp band fades — definition lost
  //   0.68 → 0.92  rainbow's wide glow fades — blur dissolves
  //   0.60 → 0.90  cell fades alongside the rainbow it spawned
  //   0.55 → 0.95  three-colour atmospheric background takes over (resting state)
  float boltArrival   = smoothstep(0.00, 0.42, uProgress);
  float boltFade      = 1.0 - smoothstep(0.50, 0.75, uProgress);
  float energize      = smoothstep(0.38, 0.48, uProgress)
                      * (1.0 - smoothstep(0.55, 0.90, uProgress));
  float rainbowAppear = smoothstep(0.42, 0.58, uProgress);
  float bandFade      = 1.0 - smoothstep(0.60, 0.78, uProgress);
  float glowFade      = 1.0 - smoothstep(0.68, 0.92, uProgress);
  float cellFade      = 1.0 - smoothstep(0.60, 0.90, uProgress);
  float bgProg        = smoothstep(0.55, 0.95, uProgress);

  // ── Cell — visible at start (continuity with thinking), fades into bg ─────
  col += drawCell(c, 1.0, energize) * cellFade;

  // ── White bolt — diagonal from off-screen bottom-left to cell centre ──────
  vec2 bFrom = vec2(-aspect * 0.54, -0.50);
  vec2 bTip  = mix(bFrom, vec2(0.0, 0.0), boltArrival);
  float bd    = segDist(c, bFrom, bTip);
  float bCore = exp(-bd * bd * 22000.0);
  float bGlow = exp(-bd * bd * 1500.0) * 0.55;
  col += vec3(1.00, 0.97, 0.93) * (bCore + bGlow) * boltArrival * boltFade;

  // ── Brand-colour rainbow — continuous angle-based gradient ────────────────
  // Every pixel gets its colour from its angular position in the fan;
  // there are no discrete beams so no gaps are possible.
  //
  //   fanMin (-30°) = red (#F65555)  →  fanMax (+30°) = deep purple (#8147F5)
  //
  vec2  prismOrigin = vec2(CELL_R, 0.0);
  vec2  rel    = c - prismOrigin;
  float fwd    = smoothstep(0.0, 0.015, rel.x);  // soft mask: only rightward
  float angle  = atan(rel.y, rel.x);
  float fanMin = -0.524;               // -30°
  float fanMax =  0.524;               //  +30°
  float u      = (angle - fanMin) / (fanMax - fanMin);  // 0 = red, 1 = violet

  // Two layers: soft-edged fill + extra-wide bloom.
  // Each smoothstep range covers ~30–60 % of the fan width so the band fades
  // gradually into black rather than cutting off sharply.
  float band = smoothstep(-0.30, 0.05, u) * smoothstep(1.30, 0.95, u);
  float glow = smoothstep(-0.60, 0.00, u) * smoothstep(1.60, 1.00, u);

  // Two-stage fade creates the "blur" effect: the crisp band loses definition
  // first, then the diffuse glow softly dissolves into the background.
  vec3 rbCol = brandGradient(clamp(u, 0.0, 1.0));
  col += rbCol * (band * 0.88 * bandFade + glow * 0.20 * glowFade)
       * fwd * rainbowAppear;

  // ── Three-colour atmospheric background — chaos section's resting state ──
  // Heavily blurred large blobs in fixed positions create the smooth gradient
  // from the storyboard: deep purple cool side, pink centre, orange warm side.
  // Slow drift gives the atmosphere life without distracting from UI content.
  //   blurFalloff = 0.55 → blobs extend ~1.5 viewport heights before fading
  //                       out, ensuring full screen coverage at any aspect.
  float ta = uTime * 0.04;
  vec2 posPurple = vec2(-0.40 * aspect + cos(ta)       * 0.03,
                         0.00          + sin(ta * 0.7) * 0.04);
  vec2 posPink   = vec2( 0.05 * aspect + cos(ta + 2.1) * 0.04,
                        -0.08          + sin(ta * 0.8 + 1.5) * 0.05);
  vec2 posOrange = vec2( 0.42 * aspect + cos(ta + 4.2) * 0.03,
                         0.14          + sin(ta * 0.6 + 3.0) * 0.04);

  float blurFalloff = 0.55;  // smaller = wider blobs = more diffuse blur
  float fPurple = exp(-dot(c - posPurple, c - posPurple) * blurFalloff);
  float fPink   = exp(-dot(c - posPink,   c - posPink)   * blurFalloff);
  float fOrange = exp(-dot(c - posOrange, c - posOrange) * blurFalloff);

  col += vec3(0.506, 0.278, 0.961) * fPurple * bgProg * 0.70; // #8147F5
  col += vec3(0.984, 0.373, 0.702) * fPink   * bgProg * 0.62; // #FB5FB3
  col += vec3(1.000, 0.635, 0.000) * fOrange * bgProg * 0.75; // #FFA200

  // ── Cinematic finish — grain comes from the DOM #noise overlay ───────────
  col *= vignette(dc);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
