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
import { createTitle } from '../hero/title.js';

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

// Scroll-driven approach — the cloud starts FAR_Z behind its resting position,
// zooms in toward the camera as progress 0 → NEAR_REACHED (trophies materialise
// and approach), then continues pushing past the resting depth toward NEAR_Z
// across the rest of the section so the awards → contact transition reads as
// the trophies passing close to the user before disappearing.
const FAR_Z        = -6;
const NEAR_Z       =  3;     // positive z = closer to camera (cam at z = CAM_Z = 4.6)
const NEAR_REACHED = 0.45;   // fraction of progress where the cloud reaches z=0

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

  // ── Centred heading — built via createTitle so it glitches in/out on
  //          section enter/leave, matching the hero title's shatter rhythm.
  const titleHandle = createTitle({
    baseClass: 'awards-title',
    tag: 'div',
    lines: [
      { text: headingTop,    cls: 'awards-title__line--small' },
      { text: headingBottom, cls: 'awards-title__line--large' },
    ],
    glitchFontClasses: [],
    glitchDuration: 0,
  });
  titleHandle.el.classList.add('awards__head');
  stage.appendChild(titleHandle.el);

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

  // Stage-light rig — brighter ambient + a focused warm spot from above-front,
  // a warm side-fill, and a cool rim from behind so the trophies read as if
  // pinned by theatre lighting. The spot needs a target placed in the scene
  // (not just .position) for its direction vector to update each frame;
  // targeting the cloud's centre means the cone follows the cloud as it
  // parallax-drifts with the cursor.
  scene.add(new THREE.AmbientLight(0x4a3a20, 1.0));

  const spot = new THREE.SpotLight(0xfff1c8, 12.0, 18, Math.PI / 5, 0.45, 1.0);
  spot.position.set(0.4, 3.6, 3.4);
  scene.add(spot);
  scene.add(spot.target);

  // Wider warm fill so the side facing away from the spot still reads as gold
  // metal, not silhouette.
  const fill = new THREE.DirectionalLight(0xffd590, 1.4);
  fill.position.set(-2.5, 0.5, 2.2);
  scene.add(fill);

  // Cool rim from behind/above for separation against the dark backdrop —
  // gives the trophies a thin highlight edge typical of stage lighting.
  const rim = new THREE.DirectionalLight(0x9ab8ff, 2.4);
  rim.position.set(-0.5, 2.5, -3.2);
  scene.add(rim);

  // Bottom uplight — soft warm wash so the underside catches a hint of light
  // (real stage lighting is rarely just top-down; a low fill keeps the
  // trophies from feeling pasted on the backdrop).
  const uplight = new THREE.DirectionalLight(0xffb066, 0.5);
  uplight.position.set(0.0, -2.5, 2.0);
  scene.add(uplight);

  const cloud = new THREE.Group();
  cloud.visible = false;   // hidden until the section reveals (setActive)
  scene.add(cloud);
  // Aim the stage spot at the cloud so the cone tracks the cloud as it
  // parallax-drifts (cloud.position updates per frame in update()).
  spot.target = cloud;

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

  // Scroll-driven Z target — two phases. Phase 1 (p < NEAR_REACHED): trophies
  // ease in from FAR_Z to z=0 (resting). Phase 2 (p > NEAR_REACHED): trophies
  // continue accelerating toward NEAR_Z so they pass close to the user across
  // the awards → contact handoff.
  let scrollZTarget = FAR_Z;
  let scrollZ       = FAR_Z;
  function setScrollProgress(p) {
    const cp = Math.max(0, Math.min(1, p));
    if (cp < NEAR_REACHED) {
      // Approach: FAR_Z → 0, eased so the deceleration reads as "settling in".
      const t = cp / NEAR_REACHED;
      const eased = 1 - Math.pow(1 - t, 3);
      scrollZTarget = FAR_Z * (1 - eased);
    } else {
      // Dive past: 0 → NEAR_Z, accelerated so the closing distance reads as
      // the cloud rushing toward the camera before the section ends.
      const t = (cp - NEAR_REACHED) / (1 - NEAR_REACHED);
      const eased = t * t;
      scrollZTarget = NEAR_Z * eased;
    }
  }

  // ── Gold-dust particles — soft bokeh trail that follows the cursor ────────
  const dustLayer = document.createElement('div');
  dustLayer.className = 'awards__dust';
  stage.appendChild(dustLayer);

  let lastDustSpawn = 0;
  const DUST_THROTTLE_MS = 36; // cap spawn rate so even fast moves stay light
  function spawnDust(cx, cy) {
    // 1–2 particles per spawn so a slow move still gets the dusty cluster feel
    const count = 1 + (Math.random() < 0.55 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'awards__dust-particle';
      const size = 2 + Math.random() * 8;
      // Spawn radius around the cursor — widened so the cluster reads as a
      // larger field of dust rather than a tight cloud hugging the pointer.
      const ox = cx + (Math.random() - 0.5) * 90;
      const oy = cy + (Math.random() - 0.5) * 90;
      // Drift target — biased upward + wider horizontal scatter to read as
      // dust spreading outward as it rises.
      const dx = (Math.random() - 0.5) * 160;
      const dy = -60 - Math.random() * 120;
      p.style.left   = `${ox.toFixed(1)}px`;
      p.style.top    = `${oy.toFixed(1)}px`;
      p.style.width  = `${size.toFixed(1)}px`;
      p.style.height = `${size.toFixed(1)}px`;
      p.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      p.style.setProperty('--dy', `${dy.toFixed(1)}px`);
      dustLayer.appendChild(p);
      // Self-remove past the keyframe duration so the layer doesn't accumulate.
      setTimeout(() => p.remove(), 1800);
    }
  }

  function onPointerMove(e) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    targetX =  (e.clientX / w) * 2 - 1;
    targetY = -((e.clientY / h) * 2 - 1);
    // Drive the backdrop shader's mouse halo from the same input — keeps the
    // background and the cloud sharing one coordinate frame.
    webgl?.shaderPlane?.setMouseTarget(targetX, targetY);

    if (active && !prefersReducedMotion()) {
      const now = performance.now();
      if (now - lastDustSpawn >= DUST_THROTTLE_MS) {
        lastDustSpawn = now;
        spawnDust(e.clientX, e.clientY);
      }
    }
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

    // Smooth the scroll-driven depth so it doesn't snap on Lenis ticks.
    scrollZ += (scrollZTarget - scrollZ) * 0.10;

    // Cloud parallax — small translate + rotate following the cursor; z is
    // driven by scroll so the trophies float in from far depth as the user
    // enters the section.
    cloud.position.x = curX * PARALLAX_X * tiltScale;
    cloud.position.y = curY * PARALLAX_Y * tiltScale;
    cloud.position.z = scrollZ;
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

  // Trophy materialise — flatten every material under the cloud so we can
  // pump them through a single stepped opacity tween on section enter. The
  // GLB loads are async, so we collect on demand (cheap — a handful of
  // meshes per slot).
  function collectMaterials() {
    const mats = [];
    cloud.traverse((n) => {
      if (n.isMesh) {
        const arr = Array.isArray(n.material) ? n.material : [n.material];
        arr.forEach((m) => { if (m) mats.push(m); });
      }
    });
    return mats;
  }
  const materialAlpha = { v: 1 };
  function setMaterialOpacity(v) {
    const mats = collectMaterials();
    mats.forEach((m) => { m.transparent = true; m.opacity = v; });
  }
  function glitchInTrophies(duration = 0.55) {
    gsap.killTweensOf(materialAlpha);
    if (prefersReducedMotion()) { materialAlpha.v = 1; setMaterialOpacity(1); return; }
    materialAlpha.v = 0;
    setMaterialOpacity(0);
    gsap.to(materialAlpha, {
      v: 1,
      duration,
      ease: 'steps(5)',
      overwrite: true,
      onUpdate: () => setMaterialOpacity(materialAlpha.v),
    });
  }

  let active = false;
  function setActive(on) {
    if (on === active) return;
    active = on;
    stage.classList.toggle('is-visible', on);
    cloud.visible = on;
    if (on) {
      // Snap depth back to FAR so the cloud always reads as approaching from
      // far away on re-entry (without this, scrolling back up into awards
      // would skip the zoom-in because scrollZ holds its last value).
      scrollZ = FAR_Z;
      gsap.ticker.add(update);
      titleHandle.glitchIn(0.7);
      // Stepped opacity stutter on every trophy material — reads as the
      // trophies materialising into existence rather than popping in.
      glitchInTrophies(0.55);
    } else {
      gsap.ticker.remove(update);
      titleHandle.glitchOut(0.4);
      setHovered(null);
    }
  }

  return {
    section,
    setActive,
    setScrollProgress,
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
