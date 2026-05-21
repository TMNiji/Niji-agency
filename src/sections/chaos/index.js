export function mountChaos({ container } = {}) {
  const section = container.querySelector('[data-section="chaos"]');
  if (!section) return null;
  section.classList.add('chaos');

  const stage = document.createElement('div');
  stage.className = 'chaos__stage';
  section.appendChild(stage);

  return { section };
}
