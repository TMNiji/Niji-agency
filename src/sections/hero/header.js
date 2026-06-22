// Hero header — fixed top-left Niji logo (blue square + wordmark) and a small
// FR / EN language switcher (top-right). `logoSrc` overrides the static mark
// when supplied by the CMS; `lang` is the active site language.
import { asset } from '@/lib/asset.js';
import { homePath } from '@/lib/lang.js';

export function createHeader({ logoSrc, lang = 'fr' } = {}) {
  const el = document.createElement('header');
  el.className = 'hero-header';
  const src = asset(logoSrc || '/logo/niji-mark.svg');
  // The logo links to the home of the CURRENT language so it never bounces an
  // EN visitor back to the French root.
  el.innerHTML = `
    <a class="hero-header__logo" href="${homePath(lang)}" aria-label="Niji — ${lang === 'en' ? 'home' : 'accueil'}">
      <span class="hero-header__logo-square">
        <img
          class="hero-header__logo-mark"
          src="${src}"
          alt=""
        />
      </span>
    </a>
  `;

  // ── Language switcher — fixed top-right, hoisted to <body> by the hero so it
  // sits above the section stages (like the timeline). Each entry links to the
  // same page in the other language (FR at /, EN at /en).
  const switcher = document.createElement('nav');
  switcher.className = 'lang-switcher';
  switcher.setAttribute('aria-label', lang === 'en' ? 'Language' : 'Langue');
  const LANGS = [
    { code: 'fr', label: 'FR' },
    { code: 'en', label: 'EN' },
  ];
  switcher.innerHTML = LANGS.map(({ code, label }) => {
    const active = code === lang;
    return `<a class="lang-switcher__link${active ? ' is-active' : ''}" href="${homePath(code)}"`
      + `${active ? ' aria-current="true"' : ''} hreflang="${code}" lang="${code}">${label}</a>`;
  }).join('<span class="lang-switcher__sep" aria-hidden="true">/</span>');

  return { el, switcher };
}
