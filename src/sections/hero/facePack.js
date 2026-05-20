// Face Pack — three.js textured planes that mirror Figma node 164:2066
// (file `SITE-AGENCE`) one-to-one: layer order, positions, sizes, rotations,
// and the centred `object-cover` crop that Figma applies to each photo.
//
// On scroll the pack explodes radially with per-fragment direction; on mouse
// move the pack receives a soft, per-fragment parallax that fades as the
// pack flies away.
import * as THREE from 'three';

const PACK_W  = 500;
const PACK_H  = 560;
const FOV     = 45;
const FOV_RAD = (FOV * Math.PI) / 180;

// Only the 5 Figma layers whose photo PNGs have real content are rendered.
// The other 5 layers in node 164:2066 (`neck`, `side-right`, `forehead-right`,
// `bg-eye-left`, `eye-left`) export from MCP as 100%-transparent placeholder
// PNGs and are intentionally skipped — they'd be invisible anyway. They can
// be reintroduced once proper exports are dropped into /public/hero.
//
// `left/top/w/h` are pack-local pixel coords lifted from Figma node 164:2066.
// `srcW/srcH`    are the real pixel dimensions of the source PNG — used to
//                reproduce Figma's `object-cover` centred crop in UV space.
// `rz`           CSS rotation in degrees (negated to three.js' CCW-Y-up).
// `vx/vy/speed`  scroll-driven radial explosion vector + magnitude.
// `px/py`        mouse-parallax amplitudes in pixels (varied per fragment).
// `z`            back-to-front render order tiebreaker.
const FRAGS = [
  { id: 'nose',          src: '/hero/face-right-side.png',
    srcW: 1802, srcH: 2395,
    left: 185.27, top: 285.71, w: 325.978, h: 183,
    rz: 0,
    vx:  0.50, vy: -0.65, speed: 1.10, px: 18, py: 22, z: -30 },

  { id: 'eye-right',     src: '/hero/face-eye-band.png',
    srcW:  292, srcH:  262,
    left: 213.01, top: 243.14, w: 196.095, h: 110,
    rz: 0,
    vx:  0.15, vy:  0.95, speed: 1.40, px: 28, py: 18, z: -10 },

  { id: 'side-left',     src: '/hero/face-left-vertical.png',
    srcW: 1627, srcH: 2324,
    left: 120.35, top: 243.14, w: 139.17,  h: 278,
    rz: 0,
    vx: -1.00, vy:  0.10, speed: 1.00, px: 26, py: 14, z:   0 },

  { id: 'mouth',         src: '/hero/face-mouth-strip.png',
    srcW: 2048, srcH: 2048,
    left: 187.11, top: 312.52, w: 198.955, h: 112,
    rz: 0,
    vx: -0.05, vy: -0.90, speed: 1.45, px: 14, py: 28, z:  10 },

  { id: 'forehead-left', src: '/hero/face-vector.png',
    srcW:  494, srcH:  398,
    left: 162.08, top: 140.09, w: 238.866, h: 191,
    rz: -1.56,
    vx: -0.55, vy:  0.85, speed: 1.30, px: 20, py: 26, z:  30 },
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

export function createFacePack({ webgl } = {}) {
  const scene  = new THREE.Scene();
  const loader = new THREE.TextureLoader();

  // Camera at distance such that 1 world-unit = 1 viewport-pixel at z=0
  let H = window.innerHeight;
  let camZ = H / (2 * Math.tan(FOV_RAD / 2));

  const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / H, 1, camZ * 20);
  camera.position.z = camZ;

  const meshes = FRAGS.map((f) => {
    const geo = new THREE.PlaneGeometry(f.w, f.h);
    const tex = loader.load(f.src);
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
    const oz = f.z;

    mesh.position.set(ox, oy, oz);
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

  // Sort back-to-front so alpha blending works without depth fighting
  meshes.sort((a, b) => a.userData.oz - b.userData.oz);
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
    // Ease-out quartic: fast initial blast, gradual deceleration
    const e = 1 - Math.pow(1 - p, 4);
    const reach = Math.max(window.innerWidth, window.innerHeight) * 1.6;
    // Parallax fades out as the pack explodes away
    const parallaxFade = 1 - e;

    meshes.forEach((mesh) => {
      const d = mesh.userData;
      const tx = d.vx * reach * e * d.speed;
      const ty = d.vy * reach * e * d.speed;

      const mpx =  d.px * mouse.x * parallaxFade;
      const mpy = -d.py * mouse.y * parallaxFade;

      mesh.position.set(d.ox + tx + mpx, d.oy + ty + mpy, d.oz);

      // Y-axis card-flip proportional to horizontal travel (key 3D feel)
      const rotY = d.vx * Math.PI * 0.9 * e;
      // X-axis tilt proportional to vertical travel
      const rotX = d.vy * Math.PI * 0.4 * e;
      mesh.rotation.set(rotX, rotY, d.initRz + d.vx * 0.5 * e);

      mesh.material.opacity = Math.max(0, 1 - e * 1.15);
    });
  }

  let rafId = 0;
  const tick = () => {
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    applyTransforms();
    rafId = requestAnimationFrame(tick);
  };
  tick();

  function setProgress(p) {
    progress = p;
  }

  return {
    setProgress,
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      meshes.forEach((m) => { m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); });
      webgl.removeOverlay(scene);
    },
  };
}
