// Cell element — geometric SVG revealed once the face pack has exploded.
// Pure CSS/SVG, no assets. Pulses subtly and grows in as scroll progresses.

export function createCellElement() {
  const el = document.createElement('div');
  el.className = 'hero-cell';
  el.innerHTML = `
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" class="hero-cell__svg" aria-hidden="true">
      <defs>
        <radialGradient id="cellCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stop-color="#FA5EB3" stop-opacity="0.85" />
          <stop offset="55%" stop-color="#8147F5" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#0A0A0F" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="cellRing" cx="50%" cy="50%" r="50%">
          <stop offset="80%" stop-color="#8147F5" stop-opacity="0" />
          <stop offset="95%" stop-color="#FA5EB3" stop-opacity="0.7" />
          <stop offset="100%" stop-color="#FA5EB3" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- Cytoplasm halo -->
      <circle cx="200" cy="200" r="190" fill="url(#cellRing)" />

      <!-- Nucleus core -->
      <circle cx="200" cy="200" r="120" fill="url(#cellCore)" />

      <!-- Membrane stippling — 24 dots around the perimeter -->
      <g fill="#FFFFFF" opacity="0.55">
        ${Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const r = 178;
          const cx = 200 + Math.cos(a) * r;
          const cy = 200 + Math.sin(a) * r;
          return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.4"/>`;
        }).join('')}
      </g>

      <!-- Organelles — small offset blobs inside the nucleus -->
      <g opacity="0.6">
        <circle cx="170" cy="180" r="14" fill="#FFFFFF" opacity="0.35"/>
        <circle cx="220" cy="210" r="9"  fill="#FFFFFF" opacity="0.25"/>
        <circle cx="195" cy="235" r="6"  fill="#FFFFFF" opacity="0.2"/>
      </g>

      <!-- Outer ring stroke -->
      <circle cx="200" cy="200" r="180" fill="none" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="0.6" />
      <circle cx="200" cy="200" r="155" fill="none" stroke="#FFFFFF" stroke-opacity="0.10" stroke-width="0.4" stroke-dasharray="2 6" />
    </svg>
  `;

  /**
   * Cell only appears once the face has started to explode.
   * Maps progress [0.25, 1] → opacity/scale [0, 1] with smoothstep.
   */
  function setProgress(progress) {
    const p = Math.max(0, Math.min(1, progress));
    const t = Math.max(0, Math.min(1, (p - 0.25) / 0.55));
    const eased = t * t * (3 - 2 * t); // smoothstep
    el.style.setProperty('--cell-opacity', String(eased));
    el.style.setProperty('--cell-scale', String(0.7 + eased * 0.3));
  }

  setProgress(0);
  return { el, setProgress };
}
