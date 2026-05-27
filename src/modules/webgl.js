import * as THREE from 'three';
import { gsap } from 'gsap';
import { SHADER_PRESETS } from '@shaders/index.js';

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
      // Physical drawing-buffer size — gl_FragCoord uses physical pixels,
      // so uResolution must match to keep uv in the [0,1]² range.
      uResolution: { value: new THREE.Vector2(
        window.innerWidth  * dpr,
        window.innerHeight * dpr,
      ) },
    };
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
  resize(w, h) {
    // Keep uResolution in physical pixels (matches gl_FragCoord)
    const dpr = this.renderer.getPixelRatio();
    this.uniforms.uResolution.value.set(w * dpr, h * dpr);
  }

  render() {
    this.timer.update();
    this.uniforms.uTime.value = this.timer.getElapsed();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.geometry.dispose();
    this.material?.dispose();
  }
}

export function initWebGL({ canvas, initialShader = 'hero_grain' } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.autoClear = false;

  const shaderPlane = new ShaderPlane({ renderer, initialShader });

  // Overlay scenes rendered after the background (depth-cleared between each).
  const overlays = [];

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
  };

  const handleResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    shaderPlane.resize(w, h);
    for (const o of overlays) o.onResize?.(w, h);
  };
  window.addEventListener('resize', handleResize, { passive: true });

  return {
    renderer,
    shaderPlane,
    /** Start rendering on gsap.ticker. main.js calls this LAST so overlays render fresh. */
    startRenderLoop() { gsap.ticker.add(renderTick); },
    addOverlay(scene, camera, onResize) { overlays.push({ scene, camera, onResize }); },
    removeOverlay(scene) {
      const i = overlays.findIndex((o) => o.scene === scene);
      if (i !== -1) overlays.splice(i, 1);
    },
    destroy() {
      gsap.ticker.remove(renderTick);
      window.removeEventListener('resize', handleResize);
      shaderPlane.dispose();
      renderer.dispose();
    },
  };
}
