// Face Pack — three.js textured planes that mirror Figma node 300:1523
// (file `SITE-AGENCE`) one-to-one: layer order, positions, sizes,
// and the centred `object-cover` crop that Figma applies to each photo.
//
// On scroll the pack dives toward the camera — each fragment rushes forward
// (+z) staggered by its layer depth, so the front planes blow past first and
// the viewer punches through the stack layer by layer; a faint lateral drift
// keeps it organic. On mouse move the pack receives a soft, per-fragment
// parallax that fades as the pack flies away.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ease, prefersReducedMotion } from '@modules/motion.js';
import { SHADER_PRESETS } from '@shaders/index.js';
import { asset } from '@/lib/asset.js';

const PACK_W  = 1484;
const PACK_H  = 1051;
const FOV     = 45;
const FOV_RAD = (FOV * Math.PI) / 180;

// Uniform scale on the resting pack — lets the composition breathe at the
// viewport edges without rewriting Figma-native pixel coords.
const SCALE   = 0.68;

// `left/top/w/h` are pack-local pixel coords (PACK_W×PACK_H space).
// `srcW/srcH`    are the real pixel dimensions of the source PNG — used to
//                reproduce Figma's `object-cover` centred crop in UV space.
// `vx/vy/speed`  scroll-driven radial drift vector + magnitude.
// `px/py`        mouse-parallax amplitudes in pixels (varied per fragment).
// `z`            back-to-front render order only; resting planes stay at z=0
//                so Figma x/y/w/h values are not perspective-shifted.
const FRAGS = [
  { id: 'bg-bottom-right',  src: '/hero/bg-bottom-right.webp',
    srcW: 465, srcH: 433,
    left: 1005, top: 501, w: 479, h: 446,
    vx:  0.93, vy:  0.37, speed: 0.85, px:  8, py: 10, z:  0 },

  { id: 'bg-top',           src: '/hero/bg-top.webp',
    srcW: 957, srcH: 391,
    left: 470, top:   0, w: 989, h: 404,
    // vy flipped to positive so the explosion drifts this slab UP rather than
    // down — otherwise it sweeps through the cell glow at mid-progress.
    vx:  0.40, vy:  0.92, speed: 0.85, px: 10, py: 14, z: 10 },

  { id: 'forehead-left-bg', src: '/hero/forehead-left-bg.webp',
    srcW: 469, srcH: 796,
    left: 239, top:  24, w: 484, h: 821,
    vx: -0.94, vy: -0.33, speed: 0.90, px: 12, py: 12, z: 20 },

  { id: 'forehead-bg-right', src: '/hero/forehead-bg-right.webp',
    srcW: 398, srcH: 240,
    left: 747, top: 142, w: 408, h: 246,
    vx:  0.63, vy: -0.78, speed: 0.95, px: 14, py: 16, z: 30 },

  { id: 'bg-bottom',        src: '/hero/bg-bottom.webp',
    srcW: 1142, srcH: 300,
    left:   0, top: 741, w: 1180, h: 310,
    vx: -0.38, vy:  0.93, speed: 0.90, px: 10, py: 14, z: 40 },

  { id: 'mouth-left',       src: '/hero/mouth-left.webp',
    srcW: 322, srcH: 243,
    // Nudged right again (520 → 630) so it sits flush against the centre face.
    left: 630, top: 585, w: 322, h: 243,
    vx: -0.45, vy: -0.89, speed: 1.20, px: 20, py: 26, z: 50 },

  { id: 'mouth-right',      src: '/hero/mouth-right.webp',
    srcW: 325, srcH: 323,
    left: 725, top: 585, w: 336, h: 334,
    vx:  0.55, vy:  0.83, speed: 1.25, px: 22, py: 26, z: 60 },

  { id: 'eye-left',         src: '/hero/eye-left.webp',
    srcW: 411, srcH: 340,
    left: 384, top: 307, w: 426, h: 352,
    vx: -0.96, vy: -0.28, speed: 1.10, px: 24, py: 18, z: 70 },

  { id: 'ear-right',        src: '/hero/ear-right.webp',
    srcW: 412, srcH: 299,
    left: 785, top: 334, w: 426, h: 309,
    vx:  0.99, vy: -0.14, speed: 1.10, px: 26, py: 16, z: 80 },

  { id: 'bottom-ear-right', src: '/hero/bottom-ear-right.webp',
    srcW: 446, srcH: 415,
    left: 853, top: 478, w: 459, h: 427,
    vx:  0.90, vy:  0.44, speed: 1.30, px: 24, py: 22, z: 90 },

  { id: 'ear-left',         src: '/hero/ear-left.webp',
    srcW: 190, srcH: 245,
    left: 338, top: 371, w: 196, h: 253,
    vx: -1.00, vy: -0.09, speed: 1.35, px: 28, py: 18, z: 100 },

  { id: 'eye-right',        src: '/hero/eye-right.webp',
    srcW: 197, srcH: 166,
    left: 755, top: 346, w: 203, h: 171,
    vx:  0.77, vy: -0.63, speed: 1.45, px: 26, py: 22, z: 110 },
];

// Reproduce CSS `object-fit: cover` by tightening the texture's UV window so
// the plane shows a centred crop of the source PNG with the correct aspect.
function applyObjectCover(tex, sw, sh, dw, dh) {
  const sa = sw / sh;
  const da = dw / dh;
  if (da > sa) {
    const rep = sa / da;
    tex.offset.set(0, (1 - rep) / 2);
    tex.repeat.set(1, rep);
  } else {
    const rep = da / sa;
    tex.offset.set((1 - rep) / 2, 0);
    tex.repeat.set(rep, 1);
  }
}

// imageSrcs: optional map of frag id → URL (from Sanity); falls back to
// the static /hero/*.png paths when a key is absent or undefined.
export function createFacePack({ webgl, imageSrcs = {} } = {}) {
  const scene  = new THREE.Scene();
  const loader = new THREE.TextureLoader();
  // Front-most layer (highest render order) → depth 1; used to stagger the
  // forward dive so closer planes reach the camera sooner.
  const maxZ = Math.max(...FRAGS.map((f) => f.z));

  // Camera at distance such that 1 world-unit = 1 viewport-pixel at z=0
  let H = window.innerHeight;
  let camZ = H / (2 * Math.tan(FOV_RAD / 2));

  const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / H, 1, camZ * 20);
  camera.position.z = camZ;

  // Shadow material — samples the texture's alpha at a coarse mipmap LOD so
  // the silhouette reads softly blurred against the backdrop. One per face;
  // the same plane geometry is reused (just slightly scaled up) and a small
  // (dx, -dy) offset is applied each frame so the shadow looks cast down-
  // right from the face. Requires the texture to have mipmaps generated
  // (default for TextureLoader-loaded images at power-of-two-ish sizes).
  // Three.js auto-prepends `in vec3 position; in vec2 uv; uniform mat4
  // modelViewMatrix; uniform mat4 projectionMatrix;` for GLSL3 ShaderMaterials
  // — declaring them again would error with "redefinition". Just reference
  // them here.
  const SHADOW_VERT = `
    out vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const SHADOW_FRAG = `
    precision highp float;
    uniform sampler2D map;
    uniform vec2 uMapOffset;
    uniform vec2 uMapRepeat;
    uniform float uLod;
    uniform float uOpacity;
    uniform float uBlur;
    uniform float uPad;
    in vec2 vUv;
    out vec4 outColor;

    // luv is texture-local UV: 0..1 spans the silhouette region, which sits in
    // the centre of the oversized quad. Outside that range there is no image —
    // return 0 so the blur fades into transparency at the padded border instead
    // of clamping the rectangle edge (which is what squared the shadow off).
    float sampleAlpha(vec2 luv) {
      if (any(lessThan(luv, vec2(0.0))) || any(greaterThan(luv, vec2(1.0)))) return 0.0;
      return textureLod(map, luv * uMapRepeat + uMapOffset, uLod).a;
    }

    void main() {
      // Expand vUv around the centre so 0..1 of the texture occupies only the
      // inner 1/uPad of the quad, leaving a transparent margin for the blur.
      vec2 luv = (vUv - 0.5) * uPad + 0.5;

      // Two-ring gaussian-weighted blur of the silhouette alpha. textureLod at
      // a moderate LOD pre-softens; the 16 ring taps spread that into a smooth,
      // even falloff so the shadow reads as a genuinely diffuse cast rather
      // than a blocky downscaled mip.
      const float TAU = 6.2831853;
      float a = sampleAlpha(luv);   // centre, weight 1.0
      float total = 1.0;
      for (int i = 0; i < 8; i++) {
        float ang = (float(i) / 8.0) * TAU;
        vec2 dir = vec2(cos(ang), sin(ang));
        a     += sampleAlpha(luv + dir * uBlur)       * 0.60;
        a     += sampleAlpha(luv + dir * uBlur * 2.0) * 0.30;
        total += 0.90;
      }
      a /= total;
      outColor = vec4(0.0, 0.0, 0.0, a * uOpacity);
    }
  `;

  // Drop-shadow geometry tuning — applied as a screen-space (px) offset to
  // each shadow mesh in applyTransforms(). Light source sits top-right, so the
  // cast falls down-left (negative x, negative y in three.js world coords).
  const SHADOW_OFFSET_X = -4;
  const SHADOW_OFFSET_Y = -4;
  const SHADOW_SCALE    = 1.10;
  // Oversized shadow quad: the silhouette occupies the inner 1/SHADOW_PAD, with
  // the surrounding margin left transparent so the blur fades smoothly instead
  // of being clipped at the fragment's rectangular edge.
  const SHADOW_PAD      = 1.4;

  const meshes = FRAGS.map((f) => {
    const w = f.w * SCALE;
    const h = f.h * SCALE;
    const geo = new THREE.PlaneGeometry(w, h);
    const tex = loader.load(asset(imageSrcs[f.id] ?? f.src));
    tex.colorSpace = THREE.SRGBColorSpace;
    // Ensure mipmap chain exists so the shadow shader's textureLod() has a
    // pyramid to sample from. These are the TextureLoader defaults, but we
    // pin them explicitly because the shadow blur breaks without mipmaps.
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    applyObjectCover(tex, f.srcW, f.srcH, w, h);

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      // DoubleSide keeps planes visible when the per-frame Y/X flutter tilts
      // them past 90° as they balloon past the camera.
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Pack-local top-left coords → world coords centred at viewport centre
    // (y is flipped because Figma's y grows downward, three.js' grows up).
    const ox = (-PACK_W / 2 + f.left + f.w / 2) * SCALE;
    const oy = ( PACK_H / 2 - f.top  - f.h / 2) * SCALE;
    const oz = 0;

    const initRz = ((f.rz ?? 0) * Math.PI) / 180;
    mesh.position.set(ox, oy, oz);
    // Reserve renderOrder bands of 2 per fragment so the shadow can sit just
    // BEFORE its main mesh (lower renderOrder = drawn first behind).
    mesh.renderOrder = f.z * 2;
    if (f.flipX) mesh.scale.x = -1;
    mesh.rotation.z = initRz;

    // Shadow plane — mirrors the face's geometry; the shader produces a soft
    // dark silhouette from the texture's alpha (sampled at high mip LOD).
    const shadowMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        map:        { value: tex },
        uMapOffset: { value: new THREE.Vector2(tex.offset.x, tex.offset.y) },
        uMapRepeat: { value: new THREE.Vector2(tex.repeat.x, tex.repeat.y) },
        uLod:       { value: 3.0 },
        uOpacity:   { value: 0.38 },
        uBlur:      { value: 0.018 },
        uPad:       { value: SHADOW_PAD },
      },
      vertexShader:   SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    // Own geometry, padded by SHADOW_PAD so the blur has transparent room to
    // fade into beyond the silhouette (see SHADOW_FRAG / uPad).
    const shadowGeo = new THREE.PlaneGeometry(w * SHADOW_PAD, h * SHADOW_PAD);
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.renderOrder = f.z * 2 - 1; // drawn just before its face
    shadowMesh.scale.set(
      SHADOW_SCALE * (f.flipX ? -1 : 1),
      SHADOW_SCALE,
      1,
    );
    shadowMesh.rotation.z = initRz;

    mesh.userData = {
      ox, oy, oz,
      initRz,
      vx: f.vx, vy: f.vy, speed: f.speed,
      px: f.px, py: f.py,
      depth: maxZ ? f.z / maxZ : 0,
      shadow: shadowMesh,
      flipX: !!f.flipX,
    };
    return mesh;
  });

  // Sort back-to-front so alpha blending follows the Figma layer stack.
  // Shadows interleave because their renderOrder is `face.z * 2 - 1` (the
  // face is at `face.z * 2`), so each shadow draws immediately before its
  // own face and never bleeds onto a different face's silhouette.
  const drawables = [];
  meshes.forEach((m) => { drawables.push(m.userData.shadow, m); });
  drawables.sort((a, b) => a.renderOrder - b.renderOrder);
  drawables.forEach((d) => { scene.add(d); });

  const onResize = (w, h) => {
    H = h;
    camZ = h / (2 * Math.tan(FOV_RAD / 2));
    camera.aspect = w / h;
    camera.position.z = camZ;
    camera.far = camZ * 20;
    camera.updateProjectionMatrix();
  };

  webgl.addOverlay(scene, camera, onResize);

  // ── Cell-on-top pass ──────────────────────────────────────────────────────
  // The shaderPlane (background) draws the cell BEHIND the facepack overlay,
  // so the fragments cover the cell while they balloon past the camera. This
  // second pass draws ONLY the cell with alpha output, registered as an overlay
  // AFTER the facepack so it composites over the fragments — the cell stays
  // visible through the explosion instead of being obscured.
  //
  // It reuses the shaderPlane's uniforms (uProgress, uTime, uMouse, uResolution)
  // so timing/parallax stay locked to the background pass.
  const cellTopScene  = new THREE.Scene();
  const cellTopCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const cellTopMat = new THREE.ShaderMaterial({
    uniforms: webgl.shaderPlane.uniforms,
    vertexShader:   SHADER_PRESETS.cell_top.vertex,
    fragmentShader: SHADER_PRESETS.cell_top.fragment,
    transparent: true,
    depthTest:  false,
    depthWrite: false,
  });
  const cellTopMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cellTopMat);
  cellTopScene.add(cellTopMesh);
  webgl.addOverlay(cellTopScene, cellTopCamera);

  // Mouse parallax — tracked target + damped current value, applied each
  // frame. Normalised to [-1, 1] from the viewport centre. When the cursor
  // leaves the viewport (or the tab loses focus) the target recenters so the
  // pack doesn't stay leaning toward the last-seen position forever.
  const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
  const onPointerMove = (e) => {
    mouse.tx = (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const recenter = () => { mouse.tx = 0; mouse.ty = 0; };
  // `mouseout` on document fires reliably when the cursor exits the viewport
  // (pointerleave on window can miss when the pointer leaves through devtools
  // or quickly past the edge). blur covers the tab-switch case.
  const onDocMouseOut = (e) => { if (!e.relatedTarget && !e.toElement) recenter(); };
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('mouseout', onDocMouseOut, { passive: true });
  window.addEventListener('blur', recenter, { passive: true });

  let progress = 0;

  function applyTransforms() {
    const p = Math.max(0, Math.min(1, progress));
    const reduced = prefersReducedMotion();

    // Travel/rotation spread across the WHOLE section with a smoothstep curve —
    // soft anticipation at the top, gentle settle at the bottom. Near-linear in
    // the middle so the motion tracks the scroll (scrubbed, not front-loaded).
    // Reduced motion: fragments stay put and only cross-fade into the cell.
    const move = reduced ? 0 : ease.smoothstep(p);

    const reach   = Math.max(window.innerWidth, window.innerHeight);
    // Distance the stack travels toward the camera (which sits at z=camZ).
    const dive    = camZ * move;
    // Parallax fades out as the pack flies past.
    const parallaxFade = 1 - move;

    meshes.forEach((mesh) => {
      const d = mesh.userData;
      // Faint outward drift only — the motion is now front-to-back, not radial.
      const tx = d.vx * reach * move * 0.11;
      const ty = d.vy * reach * move * 0.09;

      const mpx =  d.px * mouse.x * parallaxFade;
      const mpy = -d.py * mouse.y * parallaxFade;

      // Depth-staggered rush toward and PAST the camera. Front planes (depth→1)
      // reach ~1.45·camZ and exit the frustum first, back planes lag at ~1.05.
      // Coefficients were tuned to a 0.45-0.9 range when the opacity fade still
      // erased the lingering meshes; with the fade removed (planes stay fully
      // opaque), the dive has to actually push them past the camera so they
      // self-cull instead of frozen-in-frame after the user scrolls out.
      const forward = dive * (1.05 + 0.40 * d.depth);
      const px = d.ox + tx + mpx;
      const py = d.oy + ty + mpy;
      const pz = d.oz + forward;
      mesh.position.set(px, py, pz);

      // Planes stay nearly camera-facing as they pass — just a subtle flutter
      // so they don't read as dead-flat sprites.
      const rotY = d.vx * Math.PI * 0.12 * move;
      const rotX = d.vy * Math.PI * 0.08 * move;
      const rotZ = d.initRz + d.vx * 0.10 * move;
      mesh.rotation.set(rotX, rotY, rotZ);

      // Shadow mirrors the face's position + rotation with a small
      // down-right offset so it reads as a soft drop shadow cast behind the
      // plane. Scale is locked at SHADOW_SCALE (set at creation) so the
      // shadow stays uniformly larger than its face regardless of any
      // flutter from the rotation/dive transforms.
      const s = d.shadow;
      s.position.set(px + SHADOW_OFFSET_X, py + SHADOW_OFFSET_Y, pz - 1);
      s.rotation.set(rotX, rotY, rotZ);
    });
  }

  const frame = () => {
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    applyTransforms();
  };

  // Only run while hero is the active section — main.js toggles this on
  // hero enter/leave so the pack stops costing frames after it has exploded
  // off-screen. The cell-top pass is gated to hero too, otherwise it would
  // keep drawing the cell over sections that don't use the hero_grain shader
  // (prism transition, awards). Starts active because hero is the landing section.
  let active = false;
  function setActive(on) {
    if (on === active) return;
    active = on;
    cellTopMesh.visible = on;
    if (on) {
      gsap.ticker.add(frame);
    } else {
      // Snap the pack to its post-dive position before freezing the ticker.
      // The opacity-fade exit was removed (planes stay fully opaque while they
      // dive forward), so we need the meshes to actually be past the camera
      // before deactivation — otherwise a direct jump past hero (no scrubbed
      // progress between 0 and 1) leaves them frozen at the initial pose,
      // covering whatever section the user landed on.
      progress = 1;
      applyTransforms();
      gsap.ticker.remove(frame);
    }
  }
  setActive(true);

  function setProgress(p) {
    progress = p;
  }

  // Entry tween — animate the fragments back from a mid-explosion state into
  // their resting composition. Used by the seamless loop in main.js so the
  // facepack visibly "reforms" when the page wraps back to the top.
  // Suppressed under reduced motion: applyTransforms() already collapses to
  // the static pack there, and adding extra easing motion would defeat the
  // reduced-motion contract.
  const entryTween = { p: 0 };
  function playEntry({ from = 0.6, duration = 0.9 } = {}) {
    gsap.killTweensOf(entryTween);
    if (prefersReducedMotion()) { progress = 0; return; }
    entryTween.p = from;
    progress = from;
    gsap.to(entryTween, {
      p: 0,
      duration,
      ease: 'power3.out',
      overwrite: true,
      onUpdate: () => { progress = entryTween.p; },
    });
  }

  return {
    setProgress,
    setActive,
    playEntry,
    destroy() {
      setActive(false);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mouseout', onDocMouseOut);
      window.removeEventListener('blur', recenter);
      meshes.forEach((m) => {
        m.userData.shadow?.geometry.dispose();
        m.userData.shadow?.material.dispose();
        m.geometry.dispose();
        m.material.map?.dispose();
        m.material.dispose();
      });
      webgl.removeOverlay(scene);
      webgl.removeOverlay(cellTopScene);
      cellTopMesh.geometry.dispose();
      cellTopMat.dispose();
    },
  };
}
