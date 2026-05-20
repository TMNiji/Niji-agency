// Folder card — matches Figma node 119:1689.
// Tab is white, top-left-only border-radius, right-aligned over the body.
// Body is white with a large internal gap between the tagline and the footer.

export function createFolderCard({
  text    = 'On ne cherche\npas ce qui se fait.',
  rotate  = 0,   // degrees, for stacked-deck variation
  offsetX = 0,   // px nudge
  offsetY = 0,
} = {}) {
  const el = document.createElement('div');
  el.className = 'folder-card';

  if (rotate  !== 0) el.style.transform = `rotate(${rotate}deg)`;
  if (offsetX !== 0 || offsetY !== 0) {
    el.style.marginLeft = `${offsetX}px`;
    el.style.marginTop  = `${offsetY}px`;
  }

  const lines = text.split('\n').join('<br>');

  el.innerHTML = `
    <div class="folder-card__tab"></div>
    <div class="folder-card__body">
      <p class="folder-card__text">${lines}</p>
      <div class="folder-card__spacer"></div>
      <div class="folder-card__footer">
        <div class="folder-card__close" aria-hidden="true">×</div>
        <div class="folder-card__dot"></div>
      </div>
    </div>
  `;

  return { el };
}
