// noise.js — generate a 256×256 random-pixel tile once, then inject a fixed
// overlay div that CSS animates by shifting background-position at ~10fps.
// This adds film-grain texture to the full page (HTML + WebGL layers), since
// the WebGL shaders only grain their own canvas.

export function initNoise() {
  const SIZE = 256;
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const overlay = document.createElement('div');
  overlay.id = 'noise';
  overlay.style.backgroundImage = `url(${canvas.toDataURL()})`;
  document.body.appendChild(overlay);
}
