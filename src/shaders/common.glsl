// Shared utilities + cell rendering, included by hero_grain.glsl and prism.glsl
// via vite-plugin-glsl's #include resolver. The cell is identical across both
// stages so the user sees a continuous visual entity through the scroll.

precision highp float;

uniform float uTime;
uniform float uProgress;
uniform float uFade;
uniform vec2  uResolution;

// ── Noise utilities ────────────────────────────────────────────────────────
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

// ── Cell geometry constants ────────────────────────────────────────────────
// Radii in the aspect-corrected space cUv = (uv - 0.5) * vec2(aspect, 1).
// The cell is a layered system of concentric soft disks — outer atmosphere
// halo, inner glow, bright body, central nucleolus.
const float CELL_R        = 0.075;  // bright body
const float CELL_GLOW_R   = 0.16;   // inner atmospheric halo
const float CELL_FIELD_R  = 0.40;   // outer faint field
const float NUCLEOLUS_R   = 0.018;  // central bright dot

// Soft disk — value in [0,1] across a smooth fall-off from `inner` to `outer`.
float softDisk(float d, float inner, float outer) {
  return smoothstep(outer, inner, d);
}

// ── Cell rendering ─────────────────────────────────────────────────────────
// Pure concentric circles, monochrome white — celestial/atomic feel.
//
// cUv:      aspect-corrected coords centred on screen (centre = vec2(0,0))
// reveal:   [0,1] — 0 hides the cell entirely, 1 shows it fully
// energize: [0,1] — extra glow + bright pulse when bolt impacts the cell
vec3 drawCell(vec2 cUv, float reveal, float energize) {
  if (reveal <= 0.0) return vec3(0.0);

  float dc = length(cUv);

  // Outer faint field — large dim disk that reads as cell territory.
  float outerField = softDisk(dc, 0.0, CELL_FIELD_R) * 0.06;
  // Crisp soft ring at the field boundary.
  float outerRing  = smoothstep(0.012, 0.0, abs(dc - CELL_FIELD_R)) * 0.10;

  // Inner atmospheric glow — brighter zone around the cell body.
  float glow       = softDisk(dc, 0.0, CELL_GLOW_R) * 0.16;
  float glowRing   = smoothstep(0.006, 0.0, abs(dc - CELL_GLOW_R)) * 0.16;

  // Cell body — bright crisp disk with a soft outer falloff.
  float body       = softDisk(dc, CELL_R * 0.92, CELL_R * 1.04) * 0.78;
  float bodySoft   = softDisk(dc, CELL_R, CELL_R * 1.65) * 0.18;

  // Nucleolus — tiny bright core dot at centre.
  float nucleolus  = softDisk(dc, NUCLEOLUS_R * 0.6, NUCLEOLUS_R * 1.15) * 1.00;

  float intensity = outerField + outerRing
                  + glow + glowRing
                  + body + bodySoft
                  + nucleolus;

  vec3 col = vec3(intensity);

  // Energize — bolt impact lights the cell from the centre outward.
  col += vec3(1.0) * exp(-dc * dc * 50.0) * energize * 1.4;
  col += vec3(1.0) * softDisk(dc, 0.0, CELL_R * 1.2) * energize * 0.35;

  return col * reveal;
}

// ── Cinematic vignette — darken edges, leave cell untouched ───────────────
float vignette(float dc) {
  float v = 1.0 - smoothstep(0.40, 1.15, dc * 1.7);
  return mix(1.0, v, 0.55);
}

// ── Animated film grain ───────────────────────────────────────────────────
float filmGrain(vec2 fragCoord) {
  return hash(fragCoord + mod(uTime * 60.0, 997.0));
}
