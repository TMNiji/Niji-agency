// Hero header — fixed top-left Niji logo (blue square + wordmark).
// `logoSrc` overrides the static mark when supplied by the CMS.
export function createHeader({ logoSrc } = {}) {
  const el = document.createElement('header');
  el.className = 'hero-header';
  const src = logoSrc || '/logo/niji-mark.svg';
  el.innerHTML = `
    <a class="hero-header__logo" href="/" aria-label="Niji — accueil">
      <span class="hero-header__logo-square">
        <img
          class="hero-header__logo-mark"
          src="${src}"
          alt="niji"
        />
      </span>
    </a>
  `;

  return { el };
}
