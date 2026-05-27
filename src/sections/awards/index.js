// Awards section — a compact, editorial "modern interactive list" of the
// distinctions Niji has won. A large two-line heading sits on the left; the
// list is pinned to the right. Hovering a row brightens it, dims the rest, and
// reveals two placeholder preview images in the empty space beside the list.
// There is no per-row link (no "see case") — the awards have no subpages.
//
// Lives in a fixed stage toggled visible on enter (like clients/video).

const DEFAULT_HEADING_TOP    = 'On ne les cherchait pas.';
const DEFAULT_HEADING_BOTTOM = 'Ils sont là.';

// Placeholder awards — swap for real distinctions when available.
const DEFAULT_AWARDS = [
  { year: '2024', title: 'Awwwards — Site of the Day',       category: 'Expérience Utilisateur' },
  { year: '2024', title: 'FWA — Favourite Website Award',    category: 'Design & Innovation' },
  { year: '2023', title: 'CSS Design Awards — Best UI',      category: 'Interface Design' },
  { year: '2023', title: 'UX Design Awards — Finalist',      category: 'Mobile Experience' },
  { year: '2022', title: 'Grand Prix Stratégies Digital',    category: 'Stratégie de Marque' },
  { year: '2022', title: 'Communication & Entreprise Award', category: 'Communication Digitale' },
];

export function mountAwards({
  container,
  headingTop    = DEFAULT_HEADING_TOP,
  headingBottom = DEFAULT_HEADING_BOTTOM,
  awards        = DEFAULT_AWARDS,
} = {}) {
  const section = container.querySelector('[data-section="awards"]');
  if (!section) return null;
  section.classList.add('awards');

  const stage = document.createElement('div');
  stage.className = 'awards__stage';
  section.appendChild(stage);

  const inner = document.createElement('div');
  inner.className = 'awards__inner';
  stage.appendChild(inner);

  // ── Heading (left column) ───────────────────────────────────────────────────
  const head = document.createElement('div');
  head.className = 'awards__head';
  head.innerHTML = `
    <h2 class="awards__heading">
      <span class="awards__heading-muted">${headingTop}</span>
      <span class="awards__heading-strong">${headingBottom}</span>
    </h2>
  `;
  inner.appendChild(head);

  // ── List (right column) ─────────────────────────────────────────────────────
  const list = document.createElement('div');
  list.className = 'awards__list';
  inner.appendChild(list);

  const rows = awards.map((award, i) => {
    // Cool blue → purple → pink ramp, matching the site's palette.
    const hue = Math.round(212 + (i / Math.max(1, awards.length - 1)) * 118);

    const row = document.createElement('div');
    row.className = 'awards__row';
    row.innerHTML = `
      <span class="awards__year">${award.year}</span>
      <span class="awards__body">
        <span class="awards__title">${award.title}</span>
        <span class="awards__cat">${award.category}</span>
      </span>
    `;
    list.appendChild(row);

    // Two placeholder image gradients per award — swap for real thumbnails later.
    const grad1 = `linear-gradient(150deg, hsl(${hue}, 72%, 58%) 0%, hsl(${hue + 40}, 66%, 40%) 100%)`;
    const grad2 = `linear-gradient(150deg, hsl(${hue + 28}, 70%, 56%) 0%, hsl(${hue + 72}, 64%, 40%) 100%)`;
    row.addEventListener('pointerenter', () => onRowEnter(row, grad1, grad2));
    return row;
  });

  // ── Hover preview — two placeholder images revealed beside the list ────────
  const preview = document.createElement('div');
  preview.className = 'awards__preview';
  preview.setAttribute('aria-hidden', 'true');
  preview.innerHTML = `
    <span class="awards__preview-img awards__preview-img--1"></span>
    <span class="awards__preview-img awards__preview-img--2"></span>
  `;
  stage.appendChild(preview);
  const img1 = preview.querySelector('.awards__preview-img--1');
  const img2 = preview.querySelector('.awards__preview-img--2');

  let activeRow = null;

  // Highlight the entered row, dim the rest, and reveal its two placeholder
  // images. List-level leave clears it — so moving row-to-row never flickers
  // the dim state off and on.
  function onRowEnter(row, grad1, grad2) {
    if (activeRow && activeRow !== row) activeRow.classList.remove('is-active');
    row.classList.add('is-active');
    activeRow = row;
    list.classList.add('is-hovering');
    img1.style.backgroundImage = grad1;
    img2.style.backgroundImage = grad2;
    preview.classList.add('is-visible');
  }

  function onListLeave() {
    activeRow?.classList.remove('is-active');
    activeRow = null;
    list.classList.remove('is-hovering');
    preview.classList.remove('is-visible');
  }
  list.addEventListener('pointerleave', onListLeave);

  return {
    section,
    // main.js toggles this on section enter/leave; clear any hover on leave.
    setActive(on) { if (!on) onListLeave(); },
    destroy() {
      list.removeEventListener('pointerleave', onListLeave);
    },
  };
}
