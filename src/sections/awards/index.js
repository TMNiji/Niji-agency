// Awards section — a centred title above a 3D "cloud" of award trophies.
//
// The trophies are placeholder primitive geometries for now (icosahedron,
// octahedron, torus, dodecahedron, cone, torus-knot) rendered in a gold
// material — swap each for a real GLB asset later by replacing the geometry
// returned from makePlaceholderGeometry(). The cloud sits in a Three.js
// overlay registered on the shared WebGL renderer, so it composites cleanly
// over the goldish-noise shader backdrop.
//
// Mouse-driven parallax tilts the whole cloud; a raycaster lights up the
// hovered trophy and pops a tooltip carrying its name + date. The backdrop
// shader also receives the (smoothed) pointer via uMouse, so the warm halo
// in the background and the trophy hover state share one input.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap }   from 'gsap';
import { prefersReducedMotion } from '@modules/motion.js';

// Per-slot GLB URLs. null entries keep the placeholder primitive for that slot.
const TROPHY_GLB_URLS = [
  '/awards/strat.glb',         // Red box — Grand Prix Stratégies du Design
  '/awards/plaque-strat.glb',  // Plaque — Grand Prix Stratégies du Digital
  '/awards/lovie.glb',         // Gold bar — Lovie Awards
];
// Target on-screen radius for the loaded GLBs, in scene units. Matches the
// placeholder shapes (~0.36 radius) so the cloud stays visually balanced.
const TROPHY_GLB_RADIUS = 0.45;

const DEFAULT_HEADING_TOP    = 'On ne les cherchait pas.';
const DEFAULT_HEADING_BOTTOM = 'Ils sont là.';

// Three trophies — name + how many of each Niji has won. Order MUST match
// TROPHY_GLB_URLS above so the right tooltip lands on each model.
const DEFAULT_AWARDS = [
  { count: '12', title: 'Grand Prix Stratégies du Design'  }, // red box
  { count: '8',  title: 'Grand Prix Stratégies du Digital' }, // plaque
  { count: '5',  title: 'Lovie Awards'                     }, // gold bar
];

// Cloud layout — three points tightly clustered so the trio reads as one
// constellation centred under the heading.
const CLOUD_POSITIONS = [
  { x: -1.10, y:  0.30, z: -0.1 },
  { x:  1.05, y:  0.20, z:  0.4 },
  { x:  0.00, y: -0.70, z:  0.2 },
];

// Placeholder geometries — one shape per award slot. Real trophy GLBs replace
// these one-for-one once the assets are available.
function makePlaceholderGeometry(i) {
  switch (i % 6) {
    case 0: return new THREE.IcosahedronGeometry(0.36, 0);
    case 1: return new THREE.OctahedronGeometry(0.40, 0);
    case 2: return new THREE.TorusGeometry(0.30, 0.10, 18, 56);
    case 3: return new THREE.DodecahedronGeometry(0.36, 0);
    case 4: return new THREE.ConeGeometry(0.28, 0.62, 28);
    default: return new THREE.TorusKnotGeometry(0.22, 0.075, 96, 12);
  }
}

const FOV   = 45;
const CAM_Z = 4.6;

// Parallax — smoothed pointer drives a small translation + rotation of the
// whole cloud. Keep the motion subtle so the trophies stay where the eye expects.
const MOUSE_LERP   = 0.06;
const PARALLAX_X   = 0.32;
const PARALLAX_Y   = 0.18;
const PARALLAX_ROT = 0.14;

// Per-trophy hover response.
const HOVER_SCALE       = 1.18;
const HOVER_LERP        = 0.14;
const HOVER_EMISSIVE_R  = 0.45;
const HOVER_EMISSIVE_G  = 0.32;
const HOVER_EMISSIVE_B  = 0.10;

export function mountAwards({
  container,
  webgl,
  headingTop    = DEFAULT_HEADING_TOP,
  headingBottom = DEFAULT_HEADING_BOTTOM,
  awards        = DEFAULT_AWARDS,
} = {}) {
  const section = container.querySelector('[data-section="awards"]');
  if (!section) return null;
  section.classList.add('awards');

  // Body-level stage so its z-index:9995 sits above the #noise overlay (9990).
  const stage = document.createElement('div');
  stage.className = 'awards__stage';
  document.body.appendChild(stage);

  // ── Centred heading at the top of the viewport ───────────────────────────
  const head = document.createElement('div');
  head.className = 'awards__head';
  head.innerHTML = `
    <h2 class="awards__heading">
      <span class="awards__heading-muted">${headingTop}</span>
      <span class="awards__heading-strong">${headingBottom}</span>
    </h2>
  `;
  stage.appendChild(head);

  // ── Hover tooltip — single element repositioned over the focused trophy ──
  const tooltip = document.createElement('div');
  tooltip.className = 'awards__tooltip';
  tooltip.innerHTML = `
    <span class="awards__tooltip-title"></span>
    <span class="awards__tooltip-count"></span>
  `;
  stage.appendChild(tooltip);
  const tooltipTitle = tooltip.querySelector('.awards__tooltip-title');
  const tooltipCount = tooltip.querySelector('.awards__tooltip-count');

  // ── 3D scene — placeholder trophy cloud ──────────────────────────────────
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = CAM_Z;

  // Warm key + cool fill so the gold reads dimensional rather than flat.
  scene.add(new THREE.AmbientLight(0x3a2a14, 0.65));
  const key = new THREE.DirectionalLight(0xffd590, 2.2);
  key.position.set(3, 4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88a0ff, 0.55);
  fill.position.set(-3, -1, 2);
  scene.add(fill);

  const cloud = new THREE.Group();
  cloud.visible = false;   // hidden until the section reveals (setActive)
  scene.add(cloud);

  // Each item is a wrapper Group so the GLB-backed slot 0 (which contains a
  // sub-tree of meshes with their own materials) animates exactly like the
  // single-mesh placeholder slots.
  const items = awards.map((award, i) => {
    const pos = CLOUD_POSITIONS[i % CLOUD_POSITIONS.length];
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);
    group.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    group.userData = {
      basePos:  new THREE.Vector3(pos.x, pos.y, pos.z),
      spinX:    0.10 + Math.random() * 0.18,
      spinY:    0.12 + Math.random() * 0.22,
      bobAmp:   0.05 + Math.random() * 0.07,
      bobPhase: Math.random() * Math.PI * 2,
      award,
      // hasEmissive controls whether hover lights up the material — only the
      // shared gold material supports it; the GLB keeps its authored look.
      hasEmissive: true,
      material:    null,
    };
    const mat = new THREE.MeshStandardMaterial({
      color:    0xc9a04d,
      metalness: 0.85,
      roughness: 0.30,
      emissive:  new THREE.Color(0, 0, 0),
    });
    const mesh = new THREE.Mesh(makePlaceholderGeometry(i), mat);
    group.add(mesh);
    group.userData.material = mat;
    cloud.add(group);
    return group;
  });

  // Async-swap each slot's placeholder with its real GLB once it loads. The
  // wrapper group stays so positions/animations are unaffected; we just
  // replace its children and drop the emissive-hover effect for that slot.
  const gltfLoader = new GLTFLoader();
  TROPHY_GLB_URLS.forEach((url, i) => {
    if (!url) return;
    const slot = items[i];
    if (!slot) return;
    gltfLoader.load(
      url,
      (gltf) => {
        slot.userData.material?.dispose();
        slot.clear();
        slot.userData.hasEmissive = false;
        slot.userData.material    = null;

        const model = gltf.scene;
        // Normalize so the model fits the cloud's expected per-item radius.
        const box    = new THREE.Box3().setFromObject(model);
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        if (sphere.radius > 0) {
          const s = TROPHY_GLB_RADIUS / sphere.radius;
          model.scale.setScalar(s);
          // Re-center on the wrapper's origin so the slot's basePos is honored.
          model.position.sub(sphere.center.multiplyScalar(s));
        }
        slot.add(model);
      },
      undefined,
      (err) => {
        console.warn(`[awards] failed to load GLB ${url}`, err);
      },
    );
  });

  const onResize = (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  webgl.addOverlay(scene, camera, onResize);

  // ── Pointer state ────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const ndc       = new THREE.Vector2();
  let targetX = 0, targetY = 0;
  let curX    = 0, curY    = 0;
  let hovered = null;

  function onPointerMove(e) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    targetX =  (e.clientX / w) * 2 - 1;
    targetY = -((e.clientY / h) * 2 - 1);
    // Drive the backdrop shader's mouse halo from the same input — keeps the
    // background and the cloud sharing one coordinate frame.
    webgl?.shaderPlane?.setMouseTarget(targetX, targetY);
  }
  function onPointerLeave() {
    targetX = 0;
    targetY = 0;
    webgl?.shaderPlane?.setMouseTarget(0, 0);
    setHovered(null);
  }
  stage.addEventListener('pointermove',  onPointerMove);
  stage.addEventListener('pointerleave', onPointerLeave);

  function setHovered(mesh) {
    if (hovered === mesh) return;
    hovered = mesh;
    if (mesh) {
      const a = mesh.userData.award;
      tooltipTitle.textContent = a.title;
      tooltipCount.textContent = `${a.count} récompenses`;
      tooltip.classList.add('is-visible');
    } else {
      tooltip.classList.remove('is-visible');
    }
  }

  const worldPos = new THREE.Vector3();   // reused scratch for tooltip projection

  function update() {
    const reduced   = prefersReducedMotion();
    const tiltScale = reduced ? 0 : 1;

    curX += (targetX - curX) * MOUSE_LERP;
    curY += (targetY - curY) * MOUSE_LERP;

    // Cloud parallax — small translate + rotate following the cursor.
    cloud.position.x = curX * PARALLAX_X * tiltScale;
    cloud.position.y = curY * PARALLAX_Y * tiltScale;
    cloud.rotation.y =  curX * PARALLAX_ROT       * tiltScale;
    cloud.rotation.x = -curY * PARALLAX_ROT * 0.6 * tiltScale;

    // Per-trophy idle motion + hover tween.
    const t = performance.now() * 0.001;
    items.forEach((item) => {
      const ud = item.userData;
      item.rotation.x += ud.spinX * 0.005;
      item.rotation.y += ud.spinY * 0.005;
      item.position.y = ud.basePos.y + Math.sin(t * 0.7 + ud.bobPhase) * ud.bobAmp;

      const targetScale = hovered === item ? HOVER_SCALE : 1;
      const nextScale   = item.scale.x + (targetScale - item.scale.x) * HOVER_LERP;
      item.scale.setScalar(nextScale);

      if (ud.hasEmissive && ud.material) {
        const k = (nextScale - 1) / (HOVER_SCALE - 1);   // 0 at rest, 1 at hover
        ud.material.emissive.setRGB(
          HOVER_EMISSIVE_R * k,
          HOVER_EMISSIVE_G * k,
          HOVER_EMISSIVE_B * k,
        );
      }
    });

    // Raycast against the latest (un-smoothed) pointer so hover tracks 1:1.
    // Recursive so the GLB's sub-meshes are picked; resolve the hit back to
    // its owning top-level item group.
    ndc.set(targetX, targetY);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(items, true);
    let hit = null;
    if (hits.length) {
      let n = hits[0].object;
      while (n && !items.includes(n)) n = n.parent;
      hit = n || null;
    }
    setHovered(hit);

    // Tooltip follows the hovered trophy's projected screen position.
    if (hovered) {
      hovered.getWorldPosition(worldPos);
      worldPos.project(camera);
      const sx = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-worldPos.y * 0.5 + 0.5) * window.innerHeight;
      tooltip.style.transform =
        `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -120%)`;
    }
  }

  let active = false;
  function setActive(on) {
    if (on === active) return;
    active = on;
    stage.classList.toggle('is-visible', on);
    cloud.visible = on;
    if (on) {
      gsap.ticker.add(update);
    } else {
      gsap.ticker.remove(update);
      setHovered(null);
    }
  }

  return {
    section,
    setActive,
    destroy() {
      setActive(false);
      stage.removeEventListener('pointermove',  onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
      webgl.removeOverlay(scene);
      items.forEach((item) => {
        item.traverse((n) => {
          if (n.isMesh) {
            n.geometry?.dispose();
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((mat) => mat?.dispose());
          }
        });
      });
      stage.remove();
    },
  };
}
