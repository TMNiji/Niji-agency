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
    // Shifted left (was left=609) and vy flipped to negative so the fragment
    // sits + drifts to the lower-left, clearing the cell instead of sweeping
    // through it as it balloons forward.
    left: 380, top: 585, w: 322, h: 243,
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

  const meshes = FRAGS.map((f) => {
    const w = f.w * SCALE;
    const h = f.h * SCALE;
    const geo = new THREE.PlaneGeometry(w, h);
    const tex = loader.load(imageSrcs[f.id] ?? f.src);
    tex.colorSpace = THREE.SRGBColorSpace;
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
    mesh.renderOrder = f.z;
    if (f.flipX) mesh.scale.x = -1;
    mesh.rotation.z = initRz;

    mesh.userData = {
      ox, oy, oz,
      initRz,
      vx: f.vx, vy: f.vy, speed: f.speed,
      px: f.px, py: f.py,
      depth: maxZ ? f.z / maxZ : 0,
    };
    return mesh;
  });

  // Sort back-to-front so alpha blending follows the Figma layer stack.
  meshes.sort((a, b) => a.renderOrder - b.renderOrder);
  meshes.forEach((m) => { scene.add(m); });

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
    // Fragments hold full opacity through the early/mid dive, then dissolve
    // late (clear by p≈0.95) so the "punch through" reads while they balloon
    // past the camera — the resolving cell shows through the fading planes.
    // The shader cell finishes revealing ~0.90, so they overlap briefly by design.
    const fade = ease.smoothstep(Math.max(0, Math.min(1, (p - 0.40) / 0.55)));

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

      // Depth-staggered rush toward the camera: front planes (depth→1) reach
      // ~0.9·camZ and balloon past the viewer first, back planes lag at ~0.45,
      // selling the "navigating through layers" dive.
      const forward = dive * (0.45 + 0.45 * d.depth);
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

      const opacity = Math.max(0, 1 - fade);
      mesh.material.opacity = opacity;
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
    if (on) gsap.ticker.add(frame);
    else    gsap.ticker.remove(frame);
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
