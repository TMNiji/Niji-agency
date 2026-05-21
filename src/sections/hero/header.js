// Hero header — fixed top-left Niji logo (blue square + wordmark)
// plus a contextual section-name label that fades in for every section
// except hero itself.
export function createHeader() {
  const el = document.createElement('header');
  el.className = 'hero-header';
  el.innerHTML = `
    <a class="hero-header__logo" href="/" aria-label="Niji — accueil">
      <span class="hero-header__logo-square">
        <img
          class="hero-header__logo-mark"
          src="/logo/niji-mark.svg"
          alt="niji"
        />
      </span>
    </a>
    <span class="hero-header__section-label" aria-live="polite"></span>
  `;

  const labelEl = el.querySelector('.hero-header__section-label');

  return {
    el,
    /** Show a section name next to the logo (pass '' to hide). */
    setSectionLabel(name) {
      labelEl.textContent = name || '';
      labelEl.classList.toggle('is-visible', !!name);
    },
  };
}
