// Face Pack — three.js textured planes that mirror Figma node 164:2066
// (file `SITE-AGENCE`) one-to-one: layer order, positions, sizes, rotations,
// and the centred `object-cover` crop that Figma applies to each photo.
//
// On scroll the pack explodes radially with per-fragment direction; on mouse
// move the pack receives a soft, per-fragment parallax that fades as the
// pack flies away.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ease, prefersReducedMotion } from '@modules/motion.js';

const PACK_W  = 504;
const PACK_H  = 561;
const FOV     = 45;
const FOV_RAD = (FOV * Math.PI) / 180;

// `left/top/w/h` are pack-local pixel coords (PACK_W×PACK_H space).
// `srcW/srcH`    are the real pixel dimensions of the source PNG — used to
//                reproduce Figma's `object-cover` centred crop in UV space.
// `rz`           CSS rotation in degrees (negated to three.js' CCW-Y-up).
// `vx/vy/speed`  scroll-driven radial explosion vector + magnitude.
// `px/py`        mouse-parallax amplitudes in pixels (varied per fragment).
// `z`            back-to-front render order only; resting planes stay at z=0
//                so Figma x/y/w/h values are not perspective-shifted.
const FRAGS = [
  { id: 'neck',           src: '/hero/neck.png',
    srcW: 488, srcH: 325,
    left: 48.00, top: 257.05, w: 487.50, h: 325.22,
    rz: 0, flipX: true,
    vx:  0.00, vy: -0.80, speed: 0.90, px: 10, py: 24, z: 0 },

  { id: 'center-head',    src: '/hero/center-head.png',
    srcW: 326, srcH: 183,
    left: 39.04, top: 244.97, w: 326.22, h: 183.14,
    rz: 0,
    vx:  0.50, vy: -0.65, speed: 1.10, px: 18, py: 22, z: 10 },

  { id: 'cheek-left',     src: '/hero/cheek-left.png',
    srcW: 148, srcH: 286,
    left: 0.00, top: 183.75, w: 139.27, h: 278.21,
    rz: 0,
    vx: -1.00, vy:  0.10, speed: 1.00, px: 26, py: 14, z: 20 },

  { id: 'cheek-right',    src: '/hero/cheek-right.png',
    srcW: 151, srcH: 294,
    left: 361.05, top: 150.73, w: 142.95, h: 286.22,
    rz: 0,
    vx:  1.00, vy:  0.10, speed: 1.00, px: 26, py: 14, z: 21 },

  { id: 'bg-eye-left',    src: '/hero/bg-eye-left.png',
    srcW: 210, srcH: 168,
    left: 77.25, top: 150.73, w: 209.42, h: 167.13,
    rz: 0,
    vx: -0.35, vy:  0.55, speed: 1.05, px: 18, py: 18, z: 70 },

  { id: 'eye-left',       src: '/hero/eye-left.png',
    srcW: 105, srcH:  62,
    left: 123.75, top: 208.76, w: 96.87, h: 54.04,
    rz: 0,
    vx: -0.15, vy:  0.95, speed: 1.35, px: 22, py: 18, z: 80 },

  { id: 'eye-right',      src: '/hero/eye-right.png',
    srcW: 205, srcH: 118,
    left: 249.57, top: 183.76, w: 196.24, h: 110.08,
    rz: 0,
    vx:  0.15, vy:  0.95, speed: 1.40, px: 28, py: 18, z: 60 },

  { id: 'mouth',          src: '/hero/mouth.png',
    srcW: 207, srcH: 120,
    left: 146.13, top: 379.06, w: 208.58, h: 117.42,
    rz: 0,
    vx: -0.05, vy: -0.90, speed: 1.45, px: 14, py: 28, z: 81 },

  { id: 'forehead-left',  src: '/hero/forehead-left.png',
    srcW: 252, srcH: 202,
    left: 126.00, top: 58.00, w: 239.06, h: 191.13,
    rz: -1.56,
    vx: -0.55, vy:  0.85, speed: 1.30, px: 20, py: 26, z: 50 },

  { id: 'forehead-right', src: '/hero/forehead-right.png',
    srcW: 275, srcH: 236,
    left: 220.00, top: 46.00, w: 237.80, h: 190.14,
    rz: -9.90,
    vx:  0.55, vy:  0.80, speed: 1.25, px: 20, py: 24, z: 40 },
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

  // Camera at distance such that 1 world-unit = 1 viewport-pixel at z=0
  let H = window.innerHeight;
  let camZ = H / (2 * Math.tan(FOV_RAD / 2));

  const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / H, 1, camZ * 20);
  camera.position.z = camZ;

  const meshes = FRAGS.map((f) => {
    const geo = new THREE.PlaneGeometry(f.w, f.h);
    const tex = loader.load(imageSrcs[f.id] ?? f.src);
    tex.colorSpace = THREE.SRGBColorSpace;
    applyObjectCover(tex, f.srcW, f.srcH, f.w, f.h);

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      // DoubleSide so the card-flip rotation can spin past 90° without the
      // plane becoming invisible (matters most for the horizontally-mirrored
      // neck, whose effective front face is the mesh's back face).
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Pack-local top-left coords → world coords centred at viewport centre
    // (y is flipped because Figma's y grows downward, three.js' grows up).
    const ox = -PACK_W / 2 + f.left + f.w / 2;
    const oy =  PACK_H / 2 - f.top  - f.h / 2;
    const oz = 0;

    mesh.position.set(ox, oy, oz);
    mesh.renderOrder = f.z;
    if (f.flipX) mesh.scale.x = -1;
    mesh.rotation.z = (f.rz * Math.PI) / 180;

    mesh.userData = {
      ox, oy, oz,
      initRz: (f.rz * Math.PI) / 180,
      vx: f.vx, vy: f.vy, speed: f.speed,
      px: f.px, py: f.py,
    };
    return mesh;
  });

  // Sort back-to-front so alpha blending follows the Figma layer stack.
  meshes.sort((a, b) => a.renderOrder - b.renderOrder);
  meshes.forEach((m) => scene.add(m));

  const onResize = (w, h) => {
    H = h;
    camZ = h / (2 * Math.tan(FOV_RAD / 2));
    camera.aspect = w / h;
    camera.position.z = camZ;
    camera.far = camZ * 20;
    camera.updateProjectionMatrix();
  };

  webgl.addOverlay(scene, camera, onResize);

  // Mouse parallax — tracked target + damped current value, applied each
  // frame. Normalised to [-1, 1] from the viewport centre.
  const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
  const onPointerMove = (e) => {
    mouse.tx = (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  let progress = 0;

  function applyTransforms() {
    const p = Math.max(0, Math.min(1, progress));
    const reduced = prefersReducedMotion();

    // Travel/rotation spread across the WHOLE section with a smoothstep curve —
    // soft anticipation at the top, gentle settle at the bottom. Near-linear in
    // the middle so the motion tracks the scroll (scrubbed, not front-loaded).
    // Reduced motion: fragments stay put and only cross-fade into the cell.
    const move = reduced ? 0 : ease.smoothstep(p);
    // Opacity drive reaches 1 by p≈0.82 so the fragments have cleared as the
    // cell finishes revealing (shader reveal completes ~0.9), no visible gap.
    const fade = ease.smoothstep(Math.min(1, p / 0.82));

    const reach   = Math.max(window.innerWidth, window.innerHeight);
    const forward = camZ * 0.78 * move;
    // Parallax fades out as the pack explodes away.
    const parallaxFade = 1 - move;

    meshes.forEach((mesh) => {
      const d = mesh.userData;
      const tx = d.vx * reach * move * d.speed * 0.62;
      const ty = d.vy * reach * move * d.speed * 0.44;

      const mpx =  d.px * mouse.x * parallaxFade;
      const mpy = -d.py * mouse.y * parallaxFade;

      mesh.position.set(d.ox + tx + mpx, d.oy + ty + mpy, d.oz + forward * d.speed);

      // Y-axis card-flip proportional to horizontal travel (key 3D feel)
      const rotY = d.vx * Math.PI * 0.52 * move;
      // X-axis tilt proportional to vertical travel
      const rotX = d.vy * Math.PI * 0.25 * move;
      mesh.rotation.set(rotX, rotY, d.initRz + d.vx * 0.32 * move);

      mesh.material.opacity = Math.max(0, 1 - fade);
    });
  }

  const frame = () => {
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    applyTransforms();
  };

  // Only run while hero is the active section — main.js toggles this on
  // hero enter/leave so the pack stops costing frames after it has exploded
  // off-screen. Starts active because hero is the landing section.
  let active = false;
  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) gsap.ticker.add(frame);
    else    gsap.ticker.remove(frame);
  }
  setActive(true);

  function setProgress(p) {
    progress = p;
  }

  return {
    setProgress,
    setActive,
    destroy() {
      setActive(false);
      window.removeEventListener('pointermove', onPointerMove);
      meshes.forEach((m) => { m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); });
      webgl.removeOverlay(scene);
    },
  };
}
