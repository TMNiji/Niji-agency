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
import { asset } from '@/lib/asset.js';
import { gsap }   from 'gsap';
import { prefersReducedMotion } from '@modules/motion.js';
import { createTitle } from '../hero/title.js';

// Per-slot GLB URLs. null entries keep the placeholder primitive for that slot.
// Order matches DEFAULT_AWARDS so each tooltip lands on the right trophy.
const TROPHY_GLB_URLS = [
  '/awards/strat_square.glb', // Grand Prix Stratégies
  '/awards/lovie.glb',        // Lovie Awards
  '/awards/webby.glb',        // Webby Awards
];

// Per-slot resting orientation (radians). The idle sway in update() oscillates
// around these, so each model shows its intended face instead of the raw GLB
// default. Order matches TROPHY_GLB_URLS.
const TROPHY_BASE_ROTATION = [
  { x: Math.PI / 2,   y: 0, z: 0 }, // strat square — top (S) face tipped forward to vertical/front, S upright
  { x: Math.PI / 4,   y: Math.PI,               z: 0 }, // lovie — 45° forward + 180°
  { x: 0,             y: 0,           z: 0 }, // webby
];
// Target on-screen radius for the loaded GLBs, in scene units. Matches the
// placeholder shapes (~0.36 radius) so the cloud stays visually balanced.
const TROPHY_GLB_RADIUS = 0.45;

const DEFAULT_HEADING_TOP    = 'On ne les cherchait pas.';
const DEFAULT_HEADING_BOTTOM = 'Ils sont là.';

// Three trophies — title + detail lines (two per award). Order MUST match
// TROPHY_GLB_URLS above so the right tooltip lands on each model.
const DEFAULT_AWARDS = [
  {
    title: '25 Grand Prix Stratégies',
    details: ['1 Grand Prix | 13 Golds', '7 Silvers | 4 Bronzes'],
  },
  {
    title: '11 Lovie Awards',
    details: ['2 Golds | 4 Silvers | 2 Bronzes', '2 Shortlist | Top 4 worldwide'],
  },
  {
    title: '7 Webby Awards',
    details: ['3 Nominee | 4 Honoree', 'Top 4 Agency worldwide'],
  },
];

// Cloud layout — three points tightly clustered so the trio reads as one
// constellation centred under the heading.
const CLOUD_POSITIONS = [
  { x: -1.10, y:  0.30, z: -0.1 },
  { x:  1.05, y:  0.20, z:  0.4 },
  { x:  0.00, y: -0.70, z:  0.2 },
];

// Phone layout — the horizontal spread above runs the outer trophies off a
// narrow screen, so stack the trio down the centre instead. Small alternating
// x offsets keep the three off a single perfect vertical line (reads as a loose
// constellation rather than a rigid column) without pushing them off-screen.
const CLOUD_POSITIONS_MOBILE = [
  { x: -0.28, y:  1.00, z:  0.0 },
  { x:  0.30, y: -0.20, z:  0.25 },
  { x: -0.16, y: -1.40, z:  0.0 },
];

// Matches the CSS phone breakpoint (600px) so the 3D layout flips in step with
// the title/gutter mobile rules.
const isMobileLayout = () => window.innerWidth <= 600;
const cloudPositions = () => (isMobileLayout() ? CLOUD_POSITIONS_MOBILE : CLOUD_POSITIONS);

// Touch devices have no hover, so the per-frame hover raycast is replaced by a
// tap: the tooltip appears when a trophy is tapped and clears on tapping away.
// `(hover: none)` alone is not enough: some Android setups report `(hover: hover)`
// — S-Pen styluses that can hover, or Chrome's "Desktop site" mode — which would
// otherwise route them through the desktop hover raycast and fight the tap (the
// centre trophy would sit "hovered" at rest and snap back after every tap). Fall
// back to a coarse pointer or real touch points so those devices tap correctly.
const isTouchDevice = () =>
  window.matchMedia('(hover: none)').matches ||
  window.matchMedia('(any-pointer: coarse)').matches ||
  (navigator.maxTouchPoints ?? 0) > 0;
// Desktop only — used to gate the hover constellation off tablet/mobile: a true
// pointer (hover) AND a desktop-width viewport (≥1024px excludes tablets).
const isDesktop = () =>
  window.innerWidth >= 1024 && window.matchMedia('(hover: hover)').matches;

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

// Free every GPU resource an object subtree holds: geometries, materials, and
// any textures the materials reference (material.dispose() does NOT free its
// own textures). Used both when swapping placeholders for GLBs and on teardown.
function disposeObject(root) {
  root.traverse((n) => {
    if (!n.isMesh) return;
    n.geometry?.dispose();
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    mats.forEach((m) => {
      if (!m) return;
      for (const key in m) {
        const val = m[key];
        if (val && val.isTexture) val.dispose();
      }
      m.dispose();
    });
  });
}

const FOV   = 45;
const CAM_Z = 4.6;

// Parallax — smoothed pointer drives a small translation + rotation of the
// whole cloud. Keep the motion subtle so the trophies stay where the eye expects.
const MOUSE_LERP   = 0.06;
const PARALLAX_X   = 0.32;
const PARALLAX_Y   = 0.18;
const PARALLAX_ROT = 0.14;

// Scroll-driven approach — the cloud travels at a CONSTANT rate from FAR_Z
// (progress 0) straight through its resting depth and on to NEAR_Z (progress 1),
// so the trophies are always gliding while the user scrolls. There is no
// mid-section easing plateau (which previously read as the scroll "stopping"
// halfway through the section).
const FAR_Z        = -6;
// Deeper still — where the cloud parks as a faint, distant background preview
// while the clients section is on screen. Pushing past FAR_Z keeps it reading
// as far-off specks; on awards entry the scroll trajectory pulls it smoothly
// forward through FAR_Z, so the handoff stays continuous (no snap).
const PREVIEW_Z    = -13;
// Pushed PAST the camera (CAM_Z = 4.6) so by the end of the section the cloud
// has actually flown behind the camera and self-culls from the frustum —
// otherwise the trophies hang in front at z=3 and pop out the instant the
// section's leave hides them (reads as "disappearing before they exit").
const NEAR_Z       =  7;     // positive z = closer to camera (cam at z = CAM_Z = 4.6)

// Per-trophy hover response.
const HOVER_SCALE       = 1.18;
const HOVER_LERP        = 0.14;
const HOVER_EMISSIVE_R  = 0.45;
const HOVER_EMISSIVE_G  = 0.32;
const HOVER_EMISSIVE_B  = 0.10;

// Constellation — on desktop hover, faint blurry copies of the trophy scatter
// around the main one like a constellation. Each node is a small, low-opacity
// clone; a few jittered overlapping copies per node fake a soft-focus blur (no
// postprocessing). Clones SHARE the source geometry/textures (Mesh.clone copies
// them by reference), so this adds no download weight — only a handful of
// translucent draw calls while a single trophy is hovered.
const GOLDEN_ANGLE              = Math.PI * (3 - Math.sqrt(5)); // ≈137.5° — even phyllotaxis spread
const CONSTELLATION_COUNT       = 7;     // scattered award nodes around the main one
const CONSTELLATION_BLUR        = 3;     // jittered copies per node → soft-focus blur
const CONSTELLATION_JITTER      = 0.022; // blur spread (cloud units) between a node's copies
const CONSTELLATION_MIN_DIST    = 0.38;  // nearest node distance from the trophy centre
const CONSTELLATION_MAX_DIST    = 0.92;  // farthest node distance
const CONSTELLATION_MIN_SCALE   = 0.22;  // node size relative to the main trophy
const CONSTELLATION_MAX_SCALE   = 0.42;
const CONSTELLATION_MIN_OPACITY = 0.10;  // per-copy resting opacity (faint)
const CONSTELLATION_MAX_OPACITY = 0.20;
const CONSTELLATION_BACK_BIAS   = 0.5;   // push nodes this far behind the trophy (z) so it stays foremost

export function mountAwards({ container, webgl, content = null } = {}) {
  const headingTop    = content?.headingTop    ?? DEFAULT_HEADING_TOP;
  const headingBottom = content?.headingBottom ?? DEFAULT_HEADING_BOTTOM;
  const awards        = content?.list?.length ? content.list : DEFAULT_AWARDS;
  // Per-slot GLB URL — CMS trophy asset wins, else the static fallback path.
  const glbUrls = awards.map((a, i) => a.trophy?.asset?.url ?? TROPHY_GLB_URLS[i] ?? null);
  const section = container.querySelector('[data-section="awards"]');
  if (!section) return null;
  section.classList.add('awards');

  // The trophies and their stats render only in WebGL/canvas, invisible to
  // assistive tech. Mirror the same content as a visually-hidden list so screen
  // readers get the headings and each award's tally.
  const srSummary = document.createElement('div');
  srSummary.className = 'sr-only';
  srSummary.innerHTML = `
    <h2>${headingBottom} ${headingTop}</h2>
    <ul>
      ${awards.map((a) => `
        <li>${a.title}${(a.details ?? []).map((d) => ` — ${d}`).join('')}</li>
      `).join('')}
    </ul>
  `;
  section.appendChild(srSummary);

  // Body-level stage so its z-index:9995 sits above the #noise overlay (9990).
  const stage = document.createElement('div');
  stage.className = 'awards__stage';
  document.body.appendChild(stage);

  // ── Centred heading — built via createTitle so it glitches in/out on
  //          section enter/leave, matching the hero title's shatter rhythm.
  const titleHandle = createTitle({
    baseClass: 'awards-title',
    tag: 'div',
    // Large/bold line on top, small/muted line below — same logic as the
    // clients and video (DESIGN/CODE) headings. headingBottom is the punchy
    // emphasis line, so it takes the large top slot.
    lines: [
      { text: headingBottom, cls: 'awards-title__line--large' },
      { text: headingTop,    cls: 'awards-title__line--small' },
    ],
    glitchFontClasses: [],
    glitchDuration: 0,
  });
  titleHandle.el.classList.add('awards__head');
  stage.appendChild(titleHandle.el);

  // ── Hover tooltip — single element repositioned over the focused trophy.
  // The title sits above two detail lines (e.g. "1 Grand Prix | 14 Golds").
  // setHovered() fills these from the focused award's data.
  const tooltip = document.createElement('div');
  tooltip.className = 'awards__tooltip';
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.innerHTML = `
    <span class="awards__tooltip-title"></span>
    <span class="awards__tooltip-detail awards__tooltip-detail--1"></span>
    <span class="awards__tooltip-detail awards__tooltip-detail--2"></span>
  `;
  stage.appendChild(tooltip);
  const tooltipTitle    = tooltip.querySelector('.awards__tooltip-title');
  const tooltipDetail1  = tooltip.querySelector('.awards__tooltip-detail--1');
  const tooltipDetail2  = tooltip.querySelector('.awards__tooltip-detail--2');

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

  // ── Constellation ──────────────────────────────────────────────────────────
  // A single reusable group, parented to the cloud, that holds the scattered
  // blurry clones of whichever trophy is hovered. Empty + hidden at rest; rebuilt
  // by buildConstellation() on hover and torn down by clearConstellation() on
  // leave. constellationFade ramps the whole cluster in/out; constellationMats
  // caches each clone's material so the per-frame opacity multiply is cheap.
  const constellationGroup = new THREE.Group();
  constellationGroup.visible = false;
  cloud.add(constellationGroup);
  const constellationMats = [];        // { mat, base } — base = resting opacity for that copy
  const constellationFade = { v: 0 };  // 0 → hidden, 1 → fully shown (GSAP-tweened)

  // ── Hover hitboxes ─────────────────────────────────────────────────────────
  // Each trophy gets an invisible, solid box sized to the displayed model's
  // extent, and hover raycasts ONLY these. Picking the real GLB mesh directly
  // is both finicky (it's a concave ~90k-tri shape, so the pointer falls through
  // interior gaps and flickers as the trophy sways) and expensive. A snug box
  // tracks the trophy (it's parented to the same group, so it sways/scales with
  // it) and matches its silhouette per-axis. Re-fit from placeholder to GLB on load.
  const hitProxies = [];
  const _proxyBox    = new THREE.Box3();
  const _proxySize   = new THREE.Vector3();
  const _proxyCenter = new THREE.Vector3();
  function fitHitProxy(proxy, box) {
    box.getSize(_proxySize);
    box.getCenter(_proxyCenter);
    proxy.scale.set(
      Math.max(_proxySize.x, 1e-3),
      Math.max(_proxySize.y, 1e-3),
      Math.max(_proxySize.z, 1e-3),
    );
    proxy.position.copy(_proxyCenter);
  }

  // Each item is a wrapper Group so the GLB-backed slot 0 (which contains a
  // sub-tree of meshes with their own materials) animates exactly like the
  // single-mesh placeholder slots.
  const items = awards.map((award, i) => {
    const pos = cloudPositions()[i % cloudPositions().length];
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);
    // Fixed resting angle (per-slot) so every award always shows the same face.
    const baseRot = TROPHY_BASE_ROTATION[i % TROPHY_BASE_ROTATION.length];
    group.rotation.set(baseRot.x, baseRot.y, baseRot.z);
    group.userData = {
      basePos:   new THREE.Vector3(pos.x, pos.y, pos.z),
      baseRot,
      swayPhase: Math.random() * Math.PI * 2,
      bobAmp:    0.05 + Math.random() * 0.07,
      bobPhase:  Math.random() * Math.PI * 2,
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
    group.userData.material    = mat;
    group.userData.placeholder = mesh;

    // Invisible hover hitbox, fitted to the placeholder for now (see hitProxies).
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    proxy.visible = false;          // never rendered; Raycaster still picks it
    proxy.userData.item = group;
    mesh.geometry.computeBoundingBox();
    fitHitProxy(proxy, mesh.geometry.boundingBox);
    group.add(proxy);
    group.userData.proxy = proxy;
    hitProxies.push(proxy);

    cloud.add(group);
    return group;
  });

  // Async-swap each slot's placeholder with its real GLB once it loads. The
  // wrapper group stays so positions/animations are unaffected; we just
  // replace its children and drop the emissive-hover effect for that slot.
  let destroyed = false;
  const loadedModels = []; // GLB scenes — tracked so destroy() can free their textures
  const gltfLoader = new GLTFLoader();
  glbUrls.forEach((url, i) => {
    if (!url) return;
    const slot = items[i];
    if (!slot) return;
    gltfLoader.load(
      asset(url),
      (gltf) => {
        // The section may have been torn down before this async load resolved.
        if (destroyed) { disposeObject(gltf.scene); return; }
        // Drop just the placeholder primitive (geometry + material), leaving the
        // hover proxy in place — slot.clear() would also strip the proxy.
        const placeholder = slot.userData.placeholder;
        if (placeholder) {
          disposeObject(placeholder);
          slot.remove(placeholder);
          slot.userData.placeholder = null;
        }
        slot.userData.hasEmissive = false;
        slot.userData.material    = null;

        const model = gltf.scene;
        loadedModels.push(model);
        // Normalize so the model fits the cloud's expected per-item radius.
        const box    = new THREE.Box3().setFromObject(model);
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        if (sphere.radius > 0) {
          const s = TROPHY_GLB_RADIUS / sphere.radius;
          model.scale.setScalar(s);
          // Re-center on the wrapper's origin so the slot's basePos is honored.
          model.position.sub(sphere.center.multiplyScalar(s));
        }

        // Re-fit the hover hitbox to the loaded trophy BEFORE parenting: while
        // the model is still unparented its world matrix equals its slot-local
        // transform, so setFromObject yields a snug, group-local box with no
        // group-rotation skew.
        fitHitProxy(slot.userData.proxy, _proxyBox.setFromObject(model));
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
    // Re-apply the layout so crossing the phone breakpoint (or rotating the
    // device) swaps between the horizontal cluster and the vertical stack. Only
    // basePos + x/z are set here; y is driven per-frame from basePos.y by the
    // bob in the render loop.
    const layout = cloudPositions();
    items.forEach((item, i) => {
      const pos = layout[i % layout.length];
      item.userData.basePos.set(pos.x, pos.y, pos.z);
      item.position.x = pos.x;
      item.position.z = pos.z;
    });
  };
  // Top overlay → renders on the canvas above the #noise layer so the trophies
  // stay crisp (ungrained) while the shader backdrop keeps the same film grain.
  webgl.addTopOverlay(scene, camera, onResize);

  // ── Pointer state ────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const ndc       = new THREE.Vector2();
  let targetX = 0, targetY = 0;
  let curX    = 0, curY    = 0;
  let hovered = null;
  // Which side the tooltip sits on, latched once when the hover begins (see
  // setHovered). The cloud parallax-drifts with the cursor, so a centred trophy
  // would otherwise straddle the viewport midline and flip the tooltip every
  // frame; latching keeps it on one side for the whole hover.
  let hoveredOnLeft = false;

  // Scroll-driven Z target — a single linear map from FAR_Z (progress 0) to
  // NEAR_Z (progress 1). Constant rate means the cloud is always moving while
  // the user scrolls, so the depth never plateaus mid-section. It naturally
  // passes through its resting depth (~progress 0.46) without a deceleration.
  let scrollZTarget = FAR_Z;
  let scrollZ       = FAR_Z;
  function setScrollProgress(p) {
    const cp = Math.max(0, Math.min(1, p));
    scrollZTarget = FAR_Z + (NEAR_Z - FAR_Z) * cp;
  }

  // ── Gold-dust particles — soft bokeh trail that follows the cursor ────────
  const dustLayer = document.createElement('div');
  dustLayer.className = 'awards__dust';
  stage.appendChild(dustLayer);

  let lastDustSpawn = 0;
  const DUST_THROTTLE_MS = 36; // cap spawn rate so even fast moves stay light
  const dustTimers = new Set(); // pending self-remove timers, cleared on destroy
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
      const t = setTimeout(() => { p.remove(); dustTimers.delete(t); }, 1800);
      dustTimers.add(t);
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
  function onPointerLeave(e) {
    targetX = 0;
    targetY = 0;
    webgl?.shaderPlane?.setMouseTarget(0, 0);
    // A touch pointer fires pointerleave the instant the finger lifts. Clearing
    // the selection here would dismiss a just-tapped tooltip and let the resting
    // state snap back, so on touch we recentre the parallax but keep the tap
    // selection — touch dismissal is handled by tapping empty space (onTap).
    if (e?.pointerType === 'touch') return;
    setHovered(null);
  }
  // Tap-to-reveal on touch devices: raycast at the tapped point and toggle the
  // hit trophy's tooltip (tapping empty space dismisses it). No-op on
  // hover-capable devices, where the per-frame hover raycast already runs.
  function onTap(e) {
    if (!active || !isTouchDevice()) return;
    const nx =  (e.clientX / window.innerWidth)  * 2 - 1;
    const ny = -((e.clientY / window.innerHeight) * 2 - 1);
    ndc.set(nx, ny);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(hitProxies, false);
    const item = hits.length ? hits[0].object.userData.item : null;
    setHovered(hovered === item ? null : item);
  }
  stage.addEventListener('pointermove',  onPointerMove);
  stage.addEventListener('pointerleave', onPointerLeave);
  stage.addEventListener('click',        onTap);

  // Scatter a constellation of faint, blurry clones around a hovered slot. Each
  // node is a small, randomly-oriented copy of the slot's visible trophy
  // (placeholder primitive OR loaded GLB) placed on a sphere around the trophy
  // centre and pushed slightly back so the real trophy stays foremost. Within a
  // node, a few jittered overlapping copies fake a soft-focus blur. Clones reuse
  // the source geometry/textures by reference; only the MATERIALS are cloned so
  // each copy can fade independently.
  function buildConstellation(slot) {
    clearConstellation();
    // The visible trophy: the placeholder while loading, else the GLB model
    // (the only child that isn't the invisible hit proxy).
    const source = slot.userData.placeholder
      ?? slot.children.find((c) => c !== slot.userData.proxy);
    if (!source) return;

    const rand = (a, b) => a + Math.random() * (b - a);
    const lerp = (a, b, t) => a + (b - a) * t;
    for (let n = 0; n < CONSTELLATION_COUNT; n++) {
      // Phyllotaxis (sunflower) layout: stepping the angle by the golden angle
      // and growing the radius as sqrt fills the disc EVENLY around the trophy,
      // so nodes never clump on one side. A touch of jitter keeps it organic.
      // Outer nodes sit deeper, smaller and fainter; inner ones read closer and
      // brighter — depth, size and opacity all keyed to the same radius ramp.
      const angle  = n * GOLDEN_ANGLE + rand(-0.25, 0.25);
      const t      = Math.sqrt((n + 0.5) / CONSTELLATION_COUNT);     // 0 (inner) → ~1 (outer)
      const radius = lerp(CONSTELLATION_MIN_DIST, CONSTELLATION_MAX_DIST, t) * rand(0.92, 1.08);
      const node = new THREE.Group();
      node.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.82,                              // vertical squash → wide halo
        -CONSTELLATION_BACK_BIAS * (0.4 + 0.6 * t) + rand(-0.12, 0.12), // farther out = deeper
      );
      node.rotation.set(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2));
      node.scale.setScalar(lerp(CONSTELLATION_MAX_SCALE, CONSTELLATION_MIN_SCALE, t));
      const base = lerp(CONSTELLATION_MAX_OPACITY, CONSTELLATION_MIN_OPACITY, t);

      for (let b = 0; b < CONSTELLATION_BLUR; b++) {
        const echo = source.clone(true);
        echo.traverse((m) => {
          if (!m.isMesh) return;
          const src = Array.isArray(m.material) ? m.material : [m.material];
          const cloned = src.map((mat) => {
            const c = mat.clone();         // shares textures; frees cheap on dispose
            c.transparent = true;
            c.depthWrite  = false;         // so overlapping blur copies blend, not z-fight
            c.opacity     = 0;
            constellationMats.push({ mat: c, base });
            return c;
          });
          m.material = Array.isArray(m.material) ? cloned : cloned[0];
        });
        // Wrap each copy in a jitter holder so the GLB's own centring transform
        // on `echo` is preserved (setting echo.position would clobber it).
        const jitter = new THREE.Group();
        jitter.position.set(
          rand(-CONSTELLATION_JITTER, CONSTELLATION_JITTER),
          rand(-CONSTELLATION_JITTER, CONSTELLATION_JITTER),
          rand(-CONSTELLATION_JITTER, CONSTELLATION_JITTER),
        );
        jitter.add(echo);
        node.add(jitter);
      }
      constellationGroup.add(node);
    }
    constellationGroup.visible = true;
    gsap.fromTo(constellationFade, { v: 0 }, { v: 1, duration: 0.45, overwrite: true });
  }

  // Free the clone materials (geometry/textures are shared with the live trophy
  // — never dispose those) and empty the group.
  function clearConstellation() {
    gsap.killTweensOf(constellationFade);
    constellationMats.forEach(({ mat }) => mat.dispose());
    constellationMats.length = 0;
    constellationGroup.clear();
    constellationGroup.visible = false;
  }

  // Fade the cluster out, then drop it once it's gone (unless a new trophy
  // grabbed the hover in the meantime).
  function hideConstellation() {
    if (!constellationGroup.visible) return;
    gsap.to(constellationFade, {
      v: 0,
      duration: 0.3,
      overwrite: true,
      onComplete: () => { if (!hovered) clearConstellation(); },
    });
  }

  function setHovered(mesh) {
    if (hovered === mesh) return;
    hovered = mesh;
    if (mesh) {
      // Latch the tooltip side from the trophy's current screen position so it
      // can't flip mid-hover as the cloud drifts with the cursor.
      mesh.getWorldPosition(worldPos);
      worldPos.project(camera);
      hoveredOnLeft = (worldPos.x * 0.5 + 0.5) * window.innerWidth < window.innerWidth / 2;
      const a = mesh.userData.award;
      tooltipTitle.textContent   = a.title;
      tooltipDetail1.textContent = a.details?.[0] ?? '';
      tooltipDetail2.textContent = a.details?.[1] ?? '';
      tooltip.classList.add('is-visible');
      // Desktop only — the constellation is a motion flourish, so skip it on
      // tablet/mobile (no hover or sub-desktop width) and for reduced motion.
      if (isDesktop() && !prefersReducedMotion()) buildConstellation(mesh);
    } else {
      tooltip.classList.remove('is-visible');
      hideConstellation();
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
      // Gentle sway around each slot's resting angle — never a full rotation.
      item.rotation.y = ud.baseRot.y + Math.sin(t * 0.5 + ud.swayPhase) * 0.10;
      item.rotation.x = ud.baseRot.x + Math.sin(t * 0.4 + ud.swayPhase) * 0.05;
      item.rotation.z = ud.baseRot.z;
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

    // Constellation copies ramp opacity with the fade EVERY frame the cluster
    // exists — including the fade-out, when `hovered` is already null (so this
    // must not be gated on hover, or the copies would freeze and pop instead of
    // fading). Position-follow only applies while a trophy is hovered.
    if (constellationGroup.visible) {
      if (hovered) constellationGroup.position.copy(hovered.position);
      for (const { mat, base } of constellationMats) mat.opacity = base * constellationFade.v;
    }

    // Hover/tooltip only while the section is fully active — the far-away
    // background preview (rendered during clients) has no interaction.
    if (active) {
      // On hover-capable devices, raycast against the latest (un-smoothed)
      // pointer so hover tracks 1:1. Touch devices skip this — the selection is
      // driven by tap (onTap) and stays sticky until the next tap.
      if (!isTouchDevice()) {
        ndc.set(targetX, targetY);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(hitProxies, false);
        setHovered(hits.length ? hits[0].object.userData.item : null);
      }

      // Tooltip follows the hovered trophy's projected screen position. It sits
      // OFFSET to the side (right or left depending on which half of the viewport
      // the trophy is in) and slightly BELOW the trophy so the text never sits
      // on top of the 3D mesh and stays readable.
      if (hovered) {
        if (isMobileLayout()) {
          // Phones: pin the label to the horizontal centre of the screen with
          // centred text, just below the trophy, rather than offsetting it to
          // the side (no room for a side label on a narrow, centre-stacked cloud).
          hovered.getWorldPosition(worldPos);
          worldPos.project(camera);
          const sy = (-worldPos.y * 0.5 + 0.5) * window.innerHeight;
          tooltip.classList.remove('is-right', 'is-left');
          tooltip.classList.add('is-center');
          tooltip.style.transform =
            `translate(${(window.innerWidth / 2).toFixed(1)}px, ${(sy + 60).toFixed(1)}px) translate(-50%, 0)`;
        } else {
          hovered.getWorldPosition(worldPos);
          worldPos.project(camera);
          const sx = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-worldPos.y * 0.5 + 0.5) * window.innerHeight;
          const OFFSET_X = 70;  // px from trophy centre to tooltip nearest edge
          const OFFSET_Y = 40;  // px down from trophy centre
          // Side is latched in setHovered (not recomputed here) so it can't flip
          // as the cloud parallax-drifts the trophy across the viewport midline.
          const onLeftHalf = hoveredOnLeft;
          // Trophies on the left half → tooltip to the RIGHT (anchored at its left).
          // Trophies on the right half → tooltip to the LEFT  (anchored at its right).
          const tx = onLeftHalf ? sx + OFFSET_X : sx - OFFSET_X;
          const ty = sy + OFFSET_Y;
          const anchorX = onLeftHalf ? '0%' : '-100%';
          tooltip.classList.remove('is-center');
          tooltip.classList.toggle('is-right', onLeftHalf);
          tooltip.classList.toggle('is-left',  !onLeftHalf);
          tooltip.style.transform =
            `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) translate(${anchorX}, 0)`;
        }
      }
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
    // Once fully opaque, drop transparent back to false so the renderer can use
    // the cheaper opaque path and depth-sorting stays correct.
    const opaque = v >= 1;
    const mats = collectMaterials();
    mats.forEach((m) => {
      m.transparent = !opaque;
      m.opacity = v;
      m.needsUpdate = true;
    });
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
  let previewing = false;
  let ticking = false;
  function startTicker() { if (!ticking) { gsap.ticker.add(update); ticking = true; } }
  function stopTicker()  { if (ticking) { gsap.ticker.remove(update); ticking = false; } }

  // Far-away background preview — park the trophy cloud at FAR_Z and render it
  // (no HTML stage, no hover, no materialise glitch) while a PRIOR section
  // (clients) is still on screen, so the awards reveal reads as the cloud
  // flying in from depth rather than popping into being. No-op once the section
  // is fully active.
  function setFarPreview(on) {
    if (active) return;
    previewing = on;
    cloud.visible = on;
    if (on) {
      scrollZ = scrollZTarget = PREVIEW_Z;
      // Start fully transparent — the trophies stay hidden for most of the
      // clients section and only fade in across its tail (see
      // setPreviewApproach), so they don't sit visible behind the cards the
      // whole time.
      setMaterialOpacity(0);
      startTicker();
    } else {
      stopTicker();
    }
  }

  // Drive the cloud's depth during the PRIOR section's (clients) tail so the
  // trophies glide forward from the deep PREVIEW_Z toward FAR_Z as clients ends
  // — i.e. they're already visibly approaching before awards takes over. t: 0 →
  // parked deep (PREVIEW_Z, faint specks); 1 → at FAR_Z, exactly where the
  // awards scroll-approach (setScrollProgress(0)) begins, so the section
  // boundary is seamless (no jump from a frozen preview into sudden motion).
  function setPreviewApproach(t) {
    if (active || !previewing) return;
    const ct = Math.max(0, Math.min(1, t));
    const eased = ct * ct * (3 - 2 * ct); // smoothstep — gentle in/out
    scrollZTarget = PREVIEW_Z + (FAR_Z - PREVIEW_Z) * eased;
    // Fade the trophies in alongside the depth approach so they materialise
    // only at the very end of the clients section instead of lingering visible
    // behind every card. By t=1 (clients end / awards enter) they're at full
    // opacity, so the handoff into the active section is seamless.
    setMaterialOpacity(eased);
  }

  function setActive(on, direction = 'down') {
    if (on === active) return;
    active = on;
    stage.classList.toggle('is-visible', on);
    cloud.visible = on;
    if (on) {
      // If the cloud was already on screen as a far preview, glide straight
      // into the scroll-driven zoom from there — no FAR_Z snap, no materialise
      // glitch — so the clients → awards handoff stays continuous. Same skip on
      // REVERSE entry (scrolling back UP from contact): scrollZ already holds
      // the depth the trophies exited at, so the scroll progress glides them
      // back onto the page instead of snapping far + re-materialising (bouncy).
      const fromPreview = previewing;
      previewing = false;
      startTicker();
      titleHandle.glitchIn(0.7);
      if (direction === 'down' && !fromPreview) {
        scrollZ = FAR_Z;
        glitchInTrophies(0.55);
      }
    } else {
      previewing = false;
      stopTicker();
      titleHandle.glitchOut(0.4);
      setHovered(null);
    }
  }

  return {
    section,
    setActive,
    setFarPreview,
    setPreviewApproach,
    setScrollProgress,
    destroy() {
      destroyed = true; // any GLB still loading will dispose itself on arrival
      setActive(false);
      clearConstellation();
      stage.removeEventListener('pointermove',  onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.removeEventListener('click',        onTap);
      webgl.removeOverlay(scene);
      dustTimers.forEach((t) => clearTimeout(t));
      dustTimers.clear();
      // Placeholders still in their slots + any GLB models that finished loading.
      items.forEach((item) => disposeObject(item));
      loadedModels.forEach((model) => disposeObject(model));
      stage.remove();
    },
  };
}
