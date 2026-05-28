// Awards section — a compact, editorial "modern interactive list" of the
// distinctions Niji has won. A large two-line heading sits on the left; the
// list is pinned to the right. Hovering a row brightens just that row (CSS
// :hover) — no list-wide dimming.
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

  // Hoisted to <body> (not the section) so its z-index:9995 escapes #app's
  // stacking context and sits above the #noise overlay — the text stays crisp
  // while the WebGL backdrop behind it keeps its grain.
  const stage = document.createElement('div');
  stage.className = 'awards__stage';
  document.body.appendChild(stage);

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

  awards.forEach((award) => {
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
  });

  // Hover is purely per-row via CSS :hover — each award highlights on its own,
  // with no effect on its siblings (no list-wide dimming).
  return {
    section,
    // main.js calls this on section enter/leave. Toggling is-visible on the
    // (body-level) stage drives both the fade/entrance and pointer-events, so
    // :hover can't fire off-screen.
    setActive(on) { stage.classList.toggle('is-visible', on); },
    destroy() { stage.remove(); },
  };
}
