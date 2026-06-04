// Pixel-dissolve page reveal — the boot cover is a full-screen grid of black
// pixel-blocks that vanish to transparent in a random order across the WHOLE
// screen at once (not a directional wipe), revealing the live page beneath.
// Two states only: an opaque black block, or fully transparent.
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@modules/motion.js';

const CELL  = 36;         // pixel-block size in CSS px
const COVER = '#0a0a0a';  // near-black — matches the boot backdrop (flash-free)

export function pixelReveal({ cover = null, duration = 1.1 } = {}) {
  return new Promise((resolve) => {
    if (prefersReducedMotion()) { cover?.remove(); resolve(); return; }

    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    const W    = window.innerWidth;
    const H    = window.innerHeight;
    const cols = Math.ceil(W / CELL);
    const rows = Math.ceil(H / CELL);
    const cw   = W / cols;
    const ch   = H / rows;

    const canvas = document.createElement('canvas');
    canvas.className = 'pixel-reveal';
    canvas.width  = Math.ceil(W * dpr);
    canvas.height = Math.ceil(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    document.body.appendChild(canvas);

    // Per-cell clear-time in [0,1], uniform-random across the grid — so blocks
    // disappear scattered everywhere simultaneously rather than as a wipe.
    const clearAt = new Float32Array(cols * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const f = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
        clearAt[row * cols + col] = f - Math.floor(f);
      }
    }

    const draw = (u) => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = COVER;
      for (let row = 0; row < rows; row++) {
        const y = row * ch;
        for (let col = 0; col < cols; col++) {
          // Block stays an opaque black pixel until its clear-time passes,
          // then it's gone (transparent) — binary, no fade.
          if (clearAt[row * cols + col] > u) {
            ctx.fillRect(col * cw, y, cw + 1, ch + 1);
          }
        }
      }
    };

    draw(0);          // first frame fully covered…
    cover?.remove();  // …so the boot overlay drops with no flash

    const s = { u: 0 };
    gsap.to(s, {
      u: 1,
      duration,
      ease: 'none',     // even dissolve rate across the whole grid
      onUpdate: () => draw(s.u),
      onComplete: () => { canvas.remove(); resolve(); },
    });
  });
}
