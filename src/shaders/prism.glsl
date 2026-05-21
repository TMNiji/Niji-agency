precision highp float;

uniform float uTime;
uniform float uProgress;
uniform vec2  uResolution;

// ── Utilities ──────────────────────────────────────────────────────────────────

float hash(vec2 p) {
  p = fract(p * vec2(443.8975, 397.2973));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Distance from point p to segment [a, b]
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - (a + t * ab));
}

// Narrow Gaussian beam from origin along dir (positive side only)
float rayBeam(vec2 p, vec2 dir, float w) {
  float t    = dot(p, dir);
  float perp = length(p - t * dir);
  return exp(-perp * perp / (w * w)) * step(0.0, t);
}

void main() {
  vec2 uv  = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;

  // Aspect-corrected, centre-anchored coords.
  // uv.y = 0 at bottom, 1 at top (standard WebGL fragcoord).
  vec2 c  = (uv - 0.5) * vec2(aspect, 1.0);
  float dc = length(c);

  vec3 col = vec3(0.0);

  // ── Phase timing ───────────────────────────────────────────────────────────
  //   0.00 → 0.42  bolt travels from bottom-left to cell centre
  //   0.38 → 0.46  impact flash peaks
  //   0.38 → 0.78  rainbow fan builds
  //   0.60 → 1.00  colour-fog fills the screen
  float boltArrival = smoothstep(0.00, 0.42, uProgress);
  float impactPeak  = smoothstep(0.38, 0.46, uProgress)
                    * (1.0 - smoothstep(0.46, 0.64, uProgress));
  float rainbowProg = smoothstep(0.38, 0.78, uProgress);
  float fogProg     = smoothstep(0.60, 1.00, uProgress);
  float cellFade    = 1.0 - smoothstep(0.00, 0.38, uProgress);

  // ── Cell ring — carried over from thinking section, fades quickly ──────────
  float cellR = 0.19;
  float ring  = smoothstep(0.028, 0.0, abs(dc - cellR));
  ring = ring * ring;
  float cyto  = smoothstep(cellR, 0.0, dc) * 0.14;
  col += vec3(ring * 0.85 + cyto) * cellFade;

  // ── White bolt from bottom-left to cell centre ─────────────────────────────
  // bFrom sits just off-screen in the bottom-left corner.
  // In aspect-corrected space, bottom-left ≈ (-aspect*0.5, -0.5).
  vec2 bFrom = vec2(-aspect * 0.54, -0.50);
  vec2 bTip  = mix(bFrom, vec2(0.0, 0.0), boltArrival);

  float bd    = segDist(c, bFrom, bTip);
  float bCore = exp(-bd * bd * 18000.0);
  float bGlow = exp(-bd * bd * 1400.0) * 0.55;
  col += vec3(1.00, 0.97, 0.93) * (bCore + bGlow) * boltArrival;

  // ── Impact flash — bright bloom at cell centre when bolt arrives ───────────
  col += vec3(1.0) * impactPeak * exp(-dc * dc * 28.0) * 2.4;

  // ── Rainbow fan — 7 spectral bands, upper-right quadrant ──────────────────
  // Angles are in standard math coords (sin positive = screen-up).
  // Fan spans ≈ 25° (red) to ≈ 85° (violet) above horizontal.
  float rw = 0.022; // beam half-width in aspect-corrected units

  col += vec3(1.00, 0.20, 0.18) * rayBeam(c, vec2(cos(0.436), sin(0.436)), rw) * rainbowProg;
  col += vec3(1.00, 0.56, 0.08) * rayBeam(c, vec2(cos(0.611), sin(0.611)), rw) * rainbowProg;
  col += vec3(0.95, 0.86, 0.08) * rayBeam(c, vec2(cos(0.785), sin(0.785)), rw) * rainbowProg;
  col += vec3(0.18, 0.84, 0.30) * rayBeam(c, vec2(cos(0.960), sin(0.960)), rw) * rainbowProg;
  col += vec3(0.00, 0.78, 1.00) * rayBeam(c, vec2(cos(1.134), sin(1.134)), rw) * rainbowProg;
  col += vec3(0.00, 0.40, 1.00) * rayBeam(c, vec2(cos(1.309), sin(1.309)), rw) * rainbowProg;
  col += vec3(0.50, 0.27, 0.96) * rayBeam(c, vec2(cos(1.484), sin(1.484)), rw) * rainbowProg;

  // ── Atmospheric colour fog — niji brand palette (blue / purple / pink) ─────
  // Three soft Gaussian blobs whose centres drift on slow Lissajous paths.
  float ta = uTime * 0.10;

  vec2 ca = vec2(cos(ta)        * 0.42 * aspect, sin(ta * 0.80)        * 0.30);
  vec2 cb = vec2(cos(ta + 2.09) * 0.36 * aspect, sin(ta * 0.90 + 1.50) * 0.34);
  vec2 cc = vec2(cos(ta + 4.19) * 0.48 * aspect, sin(ta * 0.65 + 3.00) * 0.26);

  float blobA = exp(-dot(c - ca, c - ca) * 2.2);
  float blobB = exp(-dot(c - cb, c - cb) * 2.8);
  float blobC = exp(-dot(c - cc, c - cc) * 2.5);

  col += vec3(0.00, 0.40, 1.00) * blobA * fogProg * 0.65; // niji blue  #0065FF
  col += vec3(0.50, 0.27, 0.96) * blobB * fogProg * 0.60; // niji purple #8147F5
  col += vec3(0.98, 0.37, 0.70) * blobC * fogProg * 0.55; // niji pink  #FA5EB3

  // Film grain
  col += (hash(gl_FragCoord.xy + mod(uTime * 60.0, 997.0)) - 0.5) * 0.045;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
