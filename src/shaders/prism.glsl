#include common.glsl;

// Distance from point p to segment [a, b].
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - (a + t * ab));
}

// Narrow Gaussian beam from `origin` along `dir` (positive side only).
float rayBeam(vec2 p, vec2 origin, vec2 dir, float w) {
  vec2 rel = p - origin;
  float t    = dot(rel, dir);
  float perp = length(rel - t * dir);
  return exp(-perp * perp / (w * w)) * step(0.0, t);
}

void main() {
  vec2 uv  = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;

  // Aspect-corrected, centre-anchored coords (same space as drawCell uses).
  vec2 c  = (uv - 0.5) * vec2(aspect, 1.0);
  float dc = length(c);

  vec3 col = vec3(0.0);

  // ── Phase timing ───────────────────────────────────────────────────────
  //   0.00 → 0.42  bolt travels diagonally from bottom-left to cell centre
  //   0.38 → 0.55  cell glows from impact (energize)
  //   0.42 → 0.88  rainbow refracts out from cell's right edge
  //   0.50 → 0.75  bolt fades out as rainbow takes over
  //   0.65 → 1.00  brand-colour fog fills the surrounding atmosphere
  float boltArrival = smoothstep(0.00, 0.42, uProgress);
  float boltFade    = 1.0 - smoothstep(0.50, 0.75, uProgress);
  float energize    = smoothstep(0.38, 0.48, uProgress)
                    * (1.0 - smoothstep(0.55, 0.90, uProgress));
  float rainbowProg = smoothstep(0.42, 0.88, uProgress);
  float fogProg     = smoothstep(0.65, 1.00, uProgress);

  // ── Cell — always visible (carried over from hero/thinking) ────────────
  col += drawCell(c, 1.0, energize);

  // ── White bolt — diagonal from off-screen bottom-left to cell centre ───
  vec2 bFrom = vec2(-aspect * 0.54, -0.50);
  vec2 bTip  = mix(bFrom, vec2(0.0, 0.0), boltArrival);
  float bd    = segDist(c, bFrom, bTip);
  float bCore = exp(-bd * bd * 22000.0);
  float bGlow = exp(-bd * bd * 1500.0) * 0.55;
  col += vec3(1.00, 0.97, 0.93) * (bCore + bGlow) * boltArrival * boltFade;

  // ── Refracted rainbow — beams fan out from cell's RIGHT edge ───────────
  // Origin: cell's right edge on the x-axis.
  vec2 prismOrigin = vec2(CELL_R, 0.0);

  // 7 spectral beams fanning from -30° (red, lower) to +30° (violet, upper)
  // measured from horizontal axis pointing right.
  float rw  = 0.020;  // sharp core width
  float rwG = 0.078;  // wide glow width
  float glo = 0.18;

  vec2 d0 = vec2(cos(-0.524), sin(-0.524)); // -30° red
  vec2 d1 = vec2(cos(-0.349), sin(-0.349)); // -20° orange
  vec2 d2 = vec2(cos(-0.175), sin(-0.175)); // -10° yellow
  vec2 d3 = vec2(cos( 0.000), sin( 0.000)); //   0° green
  vec2 d4 = vec2(cos( 0.175), sin( 0.175)); //  10° cyan
  vec2 d5 = vec2(cos( 0.349), sin( 0.349)); //  20° blue
  vec2 d6 = vec2(cos( 0.524), sin( 0.524)); //  30° violet

  col += vec3(1.00, 0.20, 0.18) * (rayBeam(c, prismOrigin, d0, rw) + rayBeam(c, prismOrigin, d0, rwG) * glo) * rainbowProg;
  col += vec3(1.00, 0.56, 0.08) * (rayBeam(c, prismOrigin, d1, rw) + rayBeam(c, prismOrigin, d1, rwG) * glo) * rainbowProg;
  col += vec3(0.95, 0.86, 0.08) * (rayBeam(c, prismOrigin, d2, rw) + rayBeam(c, prismOrigin, d2, rwG) * glo) * rainbowProg;
  col += vec3(0.18, 0.84, 0.30) * (rayBeam(c, prismOrigin, d3, rw) + rayBeam(c, prismOrigin, d3, rwG) * glo) * rainbowProg;
  col += vec3(0.00, 0.78, 1.00) * (rayBeam(c, prismOrigin, d4, rw) + rayBeam(c, prismOrigin, d4, rwG) * glo) * rainbowProg;
  col += vec3(0.00, 0.40, 1.00) * (rayBeam(c, prismOrigin, d5, rw) + rayBeam(c, prismOrigin, d5, rwG) * glo) * rainbowProg;
  col += vec3(0.50, 0.27, 0.96) * (rayBeam(c, prismOrigin, d6, rw) + rayBeam(c, prismOrigin, d6, rwG) * glo) * rainbowProg;

  // ── Atmospheric colour fog — niji palette (blue / purple / pink) ───────
  float ta = uTime * 0.10;
  vec2 ca = vec2(cos(ta)        * 0.42 * aspect, sin(ta * 0.80)        * 0.30);
  vec2 cb = vec2(cos(ta + 2.09) * 0.36 * aspect, sin(ta * 0.90 + 1.50) * 0.34);
  vec2 cc = vec2(cos(ta + 4.19) * 0.48 * aspect, sin(ta * 0.65 + 3.00) * 0.26);
  float blobA = exp(-dot(c - ca, c - ca) * 2.2);
  float blobB = exp(-dot(c - cb, c - cb) * 2.8);
  float blobC = exp(-dot(c - cc, c - cc) * 2.5);
  col += vec3(0.00, 0.40, 1.00) * blobA * fogProg * 0.55;
  col += vec3(0.50, 0.27, 0.96) * blobB * fogProg * 0.50;
  col += vec3(0.98, 0.37, 0.70) * blobC * fogProg * 0.45;

  // ── Cinematic finish ─────────────────────────────────────────────────────
  col *= vignette(dc);
  col += (filmGrain(gl_FragCoord.xy) - 0.5) * 0.045;
  col *= uFade;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
