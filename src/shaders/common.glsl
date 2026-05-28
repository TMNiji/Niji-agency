// Shared utilities + cell rendering, included by hero_grain.glsl and prism.glsl
// via vite-plugin-glsl's #include resolver. The cell is identical across both
// stages so the user sees a continuous visual entity through the scroll.

precision highp float;

uniform float uTime;
uniform float uProgress;
// Cell growth — 0 = invisible point, 1 = default size, >1 = balloons past full
// (walk-through). Drives drawCell's uniform scale from centre.
uniform float uCellGrow;
uniform vec2  uResolution;
// Smoothed pointer in [-1,1]² (centre = 0). Drives a subtle background parallax.
uniform vec2  uMouse;

// ── Noise utilities ────────────────────────────────────────────────────────
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

// Cheap per-pixel hash for fine film grain.
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

// ── Shared dark backdrop ─────────────────────────────────────────────────────
// A dark radial gradient + slow drift + film grain, reproducing the awards
// section's former CSS backdrop:
//   radial-gradient(72% 90% at 78% 0%, #1d1d1d 0%, #0b0b0b 58%)
// Used as the base field across hero / build (cell + prism layer over it) and
// the awards + clients sections, so every dark section shares one textured base.
// uv is screen-space [0,1]²; CSS 0% (top) maps to uv.y = 1.0 (gl is bottom-up).
vec3 awardsBackdrop(vec2 uv, float aspect) {
  vec2  gd = (uv - vec2(0.78, 1.0)) / vec2(0.72, 0.90);
  float t  = clamp(length(gd) / 0.58, 0.0, 1.0);
  // Lifted from the original near-black gradient (#1d1d1d → #0b0b0b) to a
  // softer charcoal so the dark sections (hero / build / clients) read with
  // more depth instead of swallowing the cell, cards, and titles.
  vec3  col = mix(vec3(0.215), vec3(0.085), t);

  // Slow low-frequency drift so the dark field breathes instead of banding.
  float field = snoise(uv * vec2(aspect, 1.0) * 2.2
                       + vec2(uTime * 0.02, -uTime * 0.015));
  col += field * 0.018;

  // Fine film grain — animated per pixel.
  float g = hash21(gl_FragCoord.xy + fract(uTime) * 137.0);
  col += (g - 0.5) * 0.024;

  return col;
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
// All features grow together by scaling the input coords inversely with
// `growth`: at growth=0 the cell collapses to an invisible point, at growth=1
// it sits at default size, and beyond that it balloons past full size for the
// "walk-through" effect. A soft fade-in on growth keeps the rings from
// painting themselves before there's anything in the centre to anchor them.
//
// cUv:      aspect-corrected coords centred on screen (centre = vec2(0,0))
// growth:   [0,∞) — 0 hides the cell, 1 = default size, >1 over-grown
// energize: [0,1] — extra glow + bright pulse when bolt impacts the cell
vec3 drawCell(vec2 cUv, float growth, float energize) {
  if (growth <= 0.0) return vec3(0.0);

  // Inverse scale — coords compressed as growth rises, so the same CELL_R etc.
  // map to a larger on-screen radius. All features (rings, body, nucleolus)
  // scale together, so nothing reads as floating in space ahead of the rest.
  float scale = 1.0 / max(growth, 0.001);
  cUv *= scale;
  float dc = length(cUv);

  // Outer faint field — large dim disk that reads as cell territory.
  float outerField = softDisk(dc, 0.0, CELL_FIELD_R) * 0.06;
  // Crisp soft ring at the field boundary.
  float outerRing  = smoothstep(0.012, 0.0, abs(dc - CELL_FIELD_R)) * 0.10;

  // Inner atmospheric glow — brighter zone around the cell body.
  float glow       = softDisk(dc, 0.0, CELL_GLOW_R) * 0.16;
  float glowRing   = smoothstep(0.006, 0.0, abs(dc - CELL_GLOW_R)) * 0.16;

  // Exponential bloom — soft diffraction-style light falloff from the core.
  // A tight inner kernel plus a wide low halo give the cell a luminous, lit feel.
  float bloom = exp(-dc * 9.0) * 0.45 + exp(-dc * 3.4) * 0.16;

  // Diffraction rings — faint concentric interference in the halo, slowly
  // breathing via uTime so the light reads as alive rather than static.
  float ringWave = max(sin(dc * 115.0 - uTime * 0.5), 0.0);
  float rings    = ringWave
                 * smoothstep(CELL_FIELD_R, CELL_GLOW_R * 0.8, dc)
                 * smoothstep(CELL_R * 0.8, CELL_GLOW_R,        dc) * 0.045;

  // Cell body — bright crisp disk with a soft outer falloff.
  float body       = softDisk(dc, CELL_R * 0.92, CELL_R * 1.04) * 0.78;
  float bodySoft   = softDisk(dc, CELL_R, CELL_R * 1.65) * 0.18;

  // Nucleolus — tiny bright core dot at centre.
  float nucleolus  = softDisk(dc, NUCLEOLUS_R * 0.6, NUCLEOLUS_R * 1.15) * 1.00;

  // Hold the cell dim while it's still a sub-point so the outer ring doesn't
  // paint a line on a black field; once growth crosses ~0.5 the cell reads
  // fully as a luminous object.
  float fadeIn = smoothstep(0.05, 0.55, growth);

  float intensity = (bloom + outerField + outerRing + glow + glowRing
                   + rings + bodySoft + body + nucleolus) * fadeIn;

  vec3 col = vec3(intensity);

  // Energize — bolt impact lights the cell from the centre outward.
  col += vec3(1.0) * exp(-dc * dc * 50.0) * energize * 1.4;
  col += vec3(1.0) * softDisk(dc, 0.0, CELL_R * 1.2) * energize * 0.35;

  return col;
}

// ── Cinematic vignette — darken edges, leave cell untouched ───────────────
float vignette(float dc) {
  float v = 1.0 - smoothstep(0.40, 1.15, dc * 1.7);
  return mix(1.0, v, 0.55);
}
