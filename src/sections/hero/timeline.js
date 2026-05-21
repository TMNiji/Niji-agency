// Timeline Bar — vertical secondary nav. Drag to shift; small ticks parallax.
// 3 label rows are absolutely positioned and never move.
// Only the small-tick track translates on drag (overflow hidden clips it).

const TICK_COUNT = 80;
const PARALLAX_RATIO = 0.4;
const MAX_DRAG = 200;
const BLOCK_PITCH = 60; // px threshold used to trigger label snap on drag

/**
 * @param {Object} opts
 * @param {string[]} opts.labels - section labels in order
 * @param {number}   opts.startIndex - which label is "current" at boot
 * @param {(index:number)=>void} [opts.onChange] - fires when current label changes
 */
export function createTimeline({ labels, startIndex = 0, onChange } = {}) {
  const el = document.createElement('nav');
  el.className = 'hero-timeline';
  el.setAttribute('aria-label', 'Section navigation');

  // Vertical spine rail + sliding indicator dot.
  const rail = document.createElement('div');
  rail.className = 'hero-timeline__rail';
  el.appendChild(rail);

  const indicator = document.createElement('div');
  indicator.className = 'hero-timeline__indicator';
  el.appendChild(indicator);

  // 3 fixed label slots — prev / current / next — never translate.
  const slotNames = ['prev', 'current', 'next'];
  const slots = slotNames.map((name) => {
    const row = document.createElement('div');
    row.className = 'hero-timeline__label-row';
    row.dataset.slot = name;
    row.innerHTML = `<span class="hero-timeline__long"></span><span class="hero-timeline__text"></span>`;
    el.appendChild(row);
    return row;
  });

  // Small-tick track — the only thing that moves on drag.
  const track = document.createElement('div');
  track.className = 'hero-timeline__track';
  track.setAttribute('data-lenis-prevent', '');
  track.innerHTML = Array.from(
    { length: TICK_COUNT },
    () => `<div class="hero-timeline__tick-row"><span class="hero-timeline__short"></span></div>`,
  ).join('');
  el.appendChild(track);

  // State
  let currentIndex = Math.max(0, Math.min(labels.length - 1, startIndex));
  let dragY = 0;
  let dragging = false;
  let dragStartY = 0;
  let dragStartOffset = 0;

  // Slot vertical positions as fractions of the timeline height.
  // Matches the CSS: prev=28%, current=50%, next=72%.
  const SLOT_POSITIONS = [0.28, 0.50, 0.72];

  function updateLabels(animate = false) {
    slots.forEach((slot, i) => {
      const idx = currentIndex + (i - 1); // -1=prev, 0=current, +1=next
      const text = slot.querySelector('.hero-timeline__text');
      const newLabel = idx >= 0 && idx < labels.length ? labels[idx] : '';

      if (animate && text.textContent !== newLabel) {
        slot.classList.add('is-exiting');
        setTimeout(() => {
          text.textContent = newLabel;
          slot.style.opacity = newLabel ? '1' : '0';
          slot.classList.remove('is-exiting');
          slot.classList.add('is-entering');
          // Remove entering class after transition completes
          setTimeout(() => slot.classList.remove('is-entering'), 220);
        }, 120);
      } else {
        text.textContent = newLabel;
        slot.style.opacity = newLabel ? '1' : '0';
      }
    });

    // Slide indicator to align with the current label slot (index 1 = current).
    // The indicator top is expressed as % of the timeline element height.
    const pct = SLOT_POSITIONS[1] * 100; // always at "current" position = 50%
    indicator.style.top = `${pct}%`;
    indicator.classList.add('is-pulsing');
    setTimeout(() => indicator.classList.remove('is-pulsing'), 400);
  }

  function applyTransform() {
    const parY = dragY * PARALLAX_RATIO;
    track.style.transform = `translateY(${parY}px)`;
  }

  function snap() {
    const threshold = BLOCK_PITCH * 0.45;
    if (dragY <= -threshold && currentIndex < labels.length - 1) {
      currentIndex += 1;
      onChange?.(currentIndex);
    } else if (dragY >= threshold && currentIndex > 0) {
      currentIndex -= 1;
      onChange?.(currentIndex);
    }
    dragY = 0;
    track.classList.remove('is-dragging');
    updateLabels(true);
    applyTransform();
  }

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStartY = e.clientY;
    dragStartOffset = dragY;
    track.classList.add('is-dragging');
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragY = dragStartOffset + (e.clientY - dragStartY);
    dragY = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dragY));
    applyTransform();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    try { el.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
    snap();
  }
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('lostpointercapture', () => { dragging = false; });

  updateLabels();
  applyTransform();

  return {
    el,
    setIndex(i) {
      const prev = currentIndex;
      currentIndex = Math.max(0, Math.min(labels.length - 1, i));
      dragY = 0;
      updateLabels(currentIndex !== prev);
      applyTransform();
    },
    getIndex() { return currentIndex; },
  };
}
