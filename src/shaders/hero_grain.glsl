precision highp float;

uniform float uTime;
uniform float uProgress;
uniform vec2  uResolution;

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

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;

  // ── Hero-phase: light settles quickly to centre so it doesn't feel like
  //    scrolling *down* — reaches centre by progress ≈ 0.5.
  float srcY = mix(1.20, 0.50, clamp(uProgress * 2.0, 0.0, 1.0));

  vec2 p;
  p.x = (uv.x - 0.5) * aspect * 0.55;
  p.y = srcY - uv.y;
  float d = length(p);

  // Aspect-corrected coords centred on screen.
  vec2 cUv = uv - vec2(0.5);
  cUv.x *= aspect;
  float dc = length(cUv);

  // Background halo.
  float fallSharpness = mix(1.30, 5.50, uProgress);
  float fall = exp(-d * fallSharpness);
  float core = smoothstep(
    mix(1.30, 0.30, uProgress),
    mix(0.20, 0.02, uProgress),
    d
  );

  // Cell membrane ring — starts appearing immediately with the first scroll.
  float cellR    = 0.19;
  float ringW    = 0.028;
  float ringProg = smoothstep(0.0, 0.60, uProgress);
  float ring     = smoothstep(ringW, 0.0, abs(dc - cellR)) * ringProg;
  ring = ring * ring;

  float ring2 = smoothstep(0.018, 0.0, abs(dc - cellR * 0.62)) * ringProg * 0.4;

  float n       = snoise(vec2(d * 1.7, uTime * 0.08));
  float wobble  = 1.0 + 0.05 * n * smoothstep(0.35, 1.50, d);
  float breathe = 0.96 + 0.04 * sin(uTime * 0.22);

  float haloStr = mix(0.78, 0.12, uProgress);
  float coreStr = mix(0.42, 0.06, uProgress);
  float lightMix =
    (fall * haloStr + core * coreStr + ring * 0.85 + ring2 * 0.3)
    * breathe * wobble;

  // ── Progress gates ────────────────────────────────────────────────────────────
  float cytoProg = smoothstep(0.05, 0.65, uProgress);
  float cellProg = smoothstep(0.20, 0.75, uProgress);

  // ── Background atmospheric glow — covers the full viewport ───────────────────
  // exp(-dc * 0.80): ~41% intensity at screen corners (dc ≈ 1.0, aspect 16:9)
  float nebulaCentral = exp(-dc * 0.80) * cytoProg;
  float dc1 = length(cUv - vec2( 0.38,  0.12));
  float dc2 = length(cUv + vec2( 0.32,  0.20));
  float nebulaOff = (exp(-dc1 * 1.80) * 0.55 + exp(-dc2 * 2.00) * 0.45) * cytoProg;
  float nebula = (nebulaCentral + nebulaOff) * 0.07;

  // ── Cytoplasm — subtle white interior fill inside the ring ───────────────────
  float cytoFill = smoothstep(cellR * 1.02, cellR * 0.02, dc) * cytoProg;
  float cyto = cytoFill * 0.14;

  // ── Organelles — 3 bright points orbiting inside the nucleus ─────────────────
  float organelles = 0.0;
  float nucR = cellR * 0.55;
  for (int i = 0; i < 3; i++) {
    float fi    = float(i);
    float angle = fi / 3.0 * 6.28318 + uTime * (0.11 + fi * 0.05);
    float r     = nucR * (0.38 + 0.22 * sin(fi * 2.3));
    float od    = length(cUv - vec2(cos(angle), sin(angle)) * r);
    float oSize = 0.007 + 0.003 * sin(fi * 1.7 + uTime * 0.9);
    organelles += smoothstep(oSize, 0.0, od);
  }
  organelles *= cellProg * 0.55;

  // ── Membrane particles — drift around the cell ring ───────────────────────────
  float drift = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi    = float(i);
    float angle = fi / 7.0 * 6.28318 + uTime * (0.03 + fi * 0.007);
    float r     = cellR * (1.0 + 0.04 * sin(fi * 2.7 + uTime * 0.5));
    float dd    = length(cUv - vec2(cos(angle), sin(angle)) * r);
    drift += smoothstep(0.006, 0.0, dd) * 0.65;
  }
  drift *= cellProg;

  // ── Composite — black and white only ─────────────────────────────────────────
  float intensity =
      lightMix * 0.5
    + nebula
    + cyto
    + (organelles + drift * 0.6) * 0.9;

  intensity = clamp(intensity, 0.0, 1.0);
  vec3 col = vec3(intensity);

  // Film grain.
  float grain = hash(gl_FragCoord.xy + mod(uTime * 60.0, 997.0));
  col += (grain - 0.5) * 0.05;

  gl_FragColor = vec4(col, 1.0);
}
