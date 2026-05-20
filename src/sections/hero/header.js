// Hero header — fixed top-left Niji logo (blue square + wordmark).
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
  `;
  return el;
}
