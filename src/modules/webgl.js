import * as THREE from 'three';
import { gsap } from 'gsap';
import { SHADER_PRESETS } from '@shaders/index.js';
import { prefersReducedMotion } from '@modules/motion.js';

// Phone-only upward lift of the cell, as a fraction of viewport height. MUST
// stay in sync with orbital.js CELL_OFFSET_VH (the orbital DOM is shifted up by
// the same fraction so the rings/dots stay concentric with the lifted cell) and
// with the hero facePack lift in facePack.js.
const CELL_OFFSET_MOBILE = 0.08;
const cellOffsetFor = (w) => (w <= 600 ? CELL_OFFSET_MOBILE : 0);

export class ShaderPlane {
  constructor({ renderer, initialShader = 'hero_grain' } = {}) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.timer = new THREE.Timer();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.uniforms = {
      uTime:       { value: 0 },
      uProgress:   { value: 0 },
      // Cell growth — 0 = invisible, 1 = default size, >1 = over-grown
      // ("walking through" effect). Decoupled from uProgress so the prism
      // handoff can keep the giant cell on screen while uProgress drives the
      // prism's own bolt/rainbow phases independently.
      uCellGrow:   { value: 0 },
      // Vertical lift of the cell centre as a fraction of viewport height
      // (cUv space). Non-zero only on phones, where the cell + orbital are
      // raised to clear the bottom-right dropdown. Seeded below + on resize.
      uCellOffset: { value: 0 },
      // Physical drawing-buffer size — gl_FragCoord uses physical pixels,
      // so uResolution must match to keep uv in the [0,1]² range.
      uResolution: { value: new THREE.Vector2(
        window.innerWidth  * dpr,
        window.innerHeight * dpr,
      ) },
      // Pointer in [-1,1]², eased toward mouseTarget each frame in render().
      uMouse: { value: new THREE.Vector2(0, 0) },
    };
    this.uniforms.uCellOffset.value = cellOffsetFor(window.innerWidth);
    this.mouseTarget = new THREE.Vector2(0, 0);
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.material = null;
    this.mesh = null;
    this.currentShader = null;
    this.setShader(initialShader);
  }

  setShader(name) {
    const preset = SHADER_PRESETS[name];
    if (!preset || name === this.currentShader) return;
    if (this.mesh) this.scene.remove(this.mesh);
    if (this.material) this.material.dispose();
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: preset.vertex,
      fragmentShader: preset.fragment,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
    this.currentShader = name;
  }

  setProgress(v) { this.uniforms.uProgress.value = Math.max(0, Math.min(1, v)); }
  // Continuous cell-growth driver. Clamped to [0, 3]: 0 = invisible,
  // 1 = default size, 2–3 = balloon for the "walk-through" effect.
  setCellGrow(v) { this.uniforms.uCellGrow.value = Math.max(0, Math.min(3, v)); }
  setMouseTarget(x, y) { this.mouseTarget.set(x, y); }
  resize(w, h) {
    // Keep uResolution in physical pixels (matches gl_FragCoord)
    const dpr = this.renderer.getPixelRatio();
    this.uniforms.uResolution.value.set(w * dpr, h * dpr);
    // Re-evaluate the phone cell-lift on resize / orientation change.
    this.uniforms.uCellOffset.value = cellOffsetFor(w);
  }

  render() {
    this.timer.update();
    this.uniforms.uTime.value = this.timer.getElapsed();
    // Soft, weighted follow toward the latest pointer position.
    this.uniforms.uMouse.value.lerp(this.mouseTarget, 0.06);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.geometry.dispose();
    this.material?.dispose();
  }
}

export function initWebGL({ canvas, initialShader = 'hero_grain' } = {}) {
  // Size the drawing buffers from the canvas's CSS display box, NOT the window.
  // The canvas is 100vw/100vh; on mobile `100vh` (large/dynamic viewport) diverges
  // from window.innerHeight (which shrinks with the URL bar). Sizing from the
  // displayed box keeps buffer aspect == display aspect, so the cell + trophies
  // stay round instead of stretching. No-op on desktop (client == inner).
  const sizeOf = () => ({
    w: canvas.clientWidth  || window.innerWidth,
    h: canvas.clientHeight || window.innerHeight,
  });

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  {
    const { w, h } = sizeOf();
    renderer.setSize(w, h, false);
  }
  renderer.autoClear = false;

  const shaderPlane = new ShaderPlane({ renderer, initialShader });

  // Overlay scenes (the awards trophy cloud) render to a SECOND, transparent
  // canvas layered ABOVE the #noise overlay (z-index 9991 vs noise's 9990) —
  // see #webgl-overlay in main.css. The shader background stays on the base
  // canvas UNDER the noise, so the awards backdrop keeps the same film grain as
  // the clients section while the trophies themselves render crisp on top,
  // ungrained — mirroring how the clients cards (DOM, z 9995) sit above noise.
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.id = 'webgl-overlay';
  document.body.appendChild(overlayCanvas);
  const overlayRenderer = new THREE.WebGLRenderer({
    canvas: overlayCanvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
  });
  overlayRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  {
    const { w, h } = sizeOf();
    overlayRenderer.setSize(w, h, false);
  }
  overlayRenderer.autoClear = false;

  // Base overlays (e.g. the hero facepack) render on the BASE canvas, behind the
  // #noise overlay and behind the DOM #app, so the hero title sits in front of
  // them. Top overlays (the awards trophy cloud) render on the overlay canvas
  // ABOVE the noise — see addOverlay vs addTopOverlay.
  const overlays = [];
  const topOverlays = [];

  // One render pass per frame. Driven by gsap.ticker (the single frame loop) —
  // main.js registers this LAST, after every section's transform callback, so
  // the meshes overlays write to are up to date when we render them.
  const renderTick = () => {
    renderer.clear();
    shaderPlane.render();
    for (const o of overlays) {
      renderer.clearDepth();
      renderer.render(o.scene, o.camera);
    }
    if (topOverlays.length) {
      overlayRenderer.clear();
      for (const o of topOverlays) {
        overlayRenderer.clearDepth();
        overlayRenderer.render(o.scene, o.camera);
      }
    }
  };

  const handleResize = () => {
    const { w, h } = sizeOf();
    renderer.setSize(w, h, false);
    overlayRenderer.setSize(w, h, false);
    shaderPlane.resize(w, h);
    for (const o of overlays)    o.onResize?.(w, h);
    for (const o of topOverlays) o.onResize?.(w, h);
  };
  window.addEventListener('resize', handleResize, { passive: true });
  // Correct the initial sizing now that the canvas has been laid out: the
  // ShaderPlane constructor seeds uResolution from window.innerWidth/Height,
  // which can disagree with the display box on mobile. One pass aligns
  // buffers, uResolution, and any already-registered overlay cameras.
  handleResize();

  // Subtle pointer parallax — feed normalised coords to the shader plane. Skip
  // entirely under reduced-motion (the pointer stays centred, so no drift).
  const handleMouse = (e) => {
    shaderPlane.setMouseTarget(
      (e.clientX / window.innerWidth)  * 2 - 1,
      -((e.clientY / window.innerHeight) * 2 - 1),
    );
  };
  const mouseEnabled = !prefersReducedMotion();
  if (mouseEnabled) window.addEventListener('mousemove', handleMouse, { passive: true });

  return {
    renderer,
    shaderPlane,
    /** Start rendering on gsap.ticker. main.js calls this LAST so overlays render fresh. */
    startRenderLoop() { gsap.ticker.add(renderTick); },
    /** Render on the base canvas (behind the DOM + noise) — used by the hero facepack. */
    addOverlay(scene, camera, onResize) {
      overlays.push({ scene, camera, onResize });
      // Seed the camera aspect from the display box immediately — overlays mount
      // lazily, so without this they'd use the window-based aspect until the next
      // resize and read stretched on mobile.
      const { w, h } = sizeOf();
      onResize?.(w, h);
    },
    /** Render on the overlay canvas above the noise — used by the awards trophy cloud. */
    addTopOverlay(scene, camera, onResize) {
      topOverlays.push({ scene, camera, onResize });
      const { w, h } = sizeOf();
      onResize?.(w, h);
    },
    removeOverlay(scene) {
      const i = overlays.findIndex((o) => o.scene === scene);
      if (i !== -1) { overlays.splice(i, 1); return; }
      const j = topOverlays.findIndex((o) => o.scene === scene);
      if (j !== -1) topOverlays.splice(j, 1);
    },
    destroy() {
      gsap.ticker.remove(renderTick);
      window.removeEventListener('resize', handleResize);
      if (mouseEnabled) window.removeEventListener('mousemove', handleMouse);
      shaderPlane.dispose();
      renderer.dispose();
      overlayRenderer.dispose();
      overlayCanvas.remove();
    },
  };
}
