// Shared service-dropdown panel — the collapsible "/TAG" list used by the
// thinking right-panel and the design (video) section. Builds the
// `thinking__services` container; styling lives in thinking.css.
//
// Only one dropdown is open at a time: clicking a tag closes the others.

/**
 * @param {Object} opts
 * @param {Array<{tag:string, items?:string[]}>} [opts.services] Dropdown data.
 * @returns {{ el: HTMLElement }}
 */
export function createServiceDropdowns({ services = [] } = {}) {
  const el = document.createElement('div');
  el.className = 'thinking__services';

  const items = services.map((s) => {
    const item = document.createElement('div');
    item.className = 'thinking__service';

    const tagBtn = document.createElement('button');
    tagBtn.type = 'button';
    tagBtn.className = 'thinking__service-tag';
    tagBtn.setAttribute('aria-expanded', 'false');

    const subEl = document.createElement('div');
    subEl.className = 'thinking__service-sub';
    (s.items ?? []).forEach((text) => {
      const span = document.createElement('span');
      span.className = 'thinking__service-sub-item';
      span.textContent = text;
      subEl.appendChild(span);
    });

    item.appendChild(tagBtn);
    item.appendChild(subEl);
    el.appendChild(item);

    const setState = (open) => {
      tagBtn.textContent = (open ? '>' : '/') + s.tag;
      tagBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      item.classList.toggle('is-open', open);
    };
    setState(false); // closed by default; open only on click

    return { item, setState, tagBtn };
  });

  items.forEach((entry) => {
    entry.tagBtn.addEventListener('click', () => {
      const wasOpen = entry.item.classList.contains('is-open');
      items.forEach(({ setState }) => setState(false));
      if (!wasOpen) entry.setState(true);
    });
  });

  return { el };
}
