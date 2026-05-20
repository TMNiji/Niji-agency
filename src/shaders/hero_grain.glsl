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

  // Light source descends from far above the top edge to screen centre.
  // srcY = 1.60 means the hotspot is 160% up the screen (well above the top);
  // srcY = 0.50 places it exactly at vertical centre when progress = 1.
  float srcY = mix(1.60, 0.50, uProgress);

  // Aspect-corrected coords relative to the moving light source.
  // X is squashed (×0.55) so the halo reads as a wide, horizontally-stretched
  // oval that fills the top of the viewport rather than a tight circular spot.
  vec2 p;
  p.x = (uv.x - 0.5) * aspect * 0.55;
  p.y = srcY - uv.y;

  float d = length(p);

  // Perfectly-circular distance from screen centre — used for the cell ring
  // so the membrane is always a true circle regardless of the X squash above.
  vec2 cUv = uv - vec2(0.5);
  cUv.x *= aspect;
  float dc = length(cUv);

  // Background halo — gets tighter and more focused as the light descends.
  float fallSharpness = mix(1.30, 5.50, uProgress);
  float fall = exp(-d * fallSharpness);
  float core = smoothstep(
    mix(1.30, 0.30, uProgress),
    mix(0.20, 0.02, uProgress),
    d
  );

  // Cell membrane ring — perfectly circular, radius ~19% of screen height.
  // Fades in only after the halo has descended to mid-screen (progress > 0.45).
  float cellR    = 0.19;
  float ringW    = 0.028;
  float ringProg = smoothstep(0.45, 1.0, uProgress);
  float ring     = smoothstep(ringW, 0.0, abs(dc - cellR)) * ringProg;
  ring = ring * ring; // square to sharpen the membrane edge

  // Thin secondary ring slightly inside — gives depth like a cell nucleus wall
  float ring2 = smoothstep(0.018, 0.0, abs(dc - cellR * 0.62)) * ringProg * 0.4;

  // Radial-only noise: rigorously left/right symmetric, evolves over time.
  float n = snoise(vec2(d * 1.7, uTime * 0.08));
  float wobble = 1.0 + 0.05 * n * smoothstep(0.35, 1.50, d);
  float breathe = 0.96 + 0.04 * sin(uTime * 0.22);

  // Halo and core intensity both fade as the light condenses into the ring.
  float haloStr = mix(0.78, 0.12, uProgress);
  float coreStr = mix(0.42, 0.06, uProgress);
  float lightMix =
    (fall * haloStr + core * coreStr + ring * 0.85 + ring2 * 0.3)
    * breathe * wobble;

  vec3 deep = vec3(0.016, 0.016, 0.020);
  vec3 col = mix(deep, vec3(lightMix * 0.5), lightMix);

  // Single-layer per-pixel film grain.
  // mod() on a fast counter avoids the 1-second seed wrap that produced a
  // visible "refresh" pulse; full-res sampling keeps grain at 1-pixel size.
  float grain = hash(gl_FragCoord.xy + mod(uTime * 60.0, 997.0));
  col += (grain - 0.5) * 0.05;

  gl_FragColor = vec4(col, 1.0);
}
