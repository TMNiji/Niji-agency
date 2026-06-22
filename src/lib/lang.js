// Site language — derived from the URL path. The English site is served at
// /en (Vercel cleanUrls maps en.html → /en); everything else is French, the
// default. Keeping detection path-based (not navigator-based) means the two
// languages are real, shareable, indexable URLs — the language a visitor sees
// always matches the link they opened.

export const LANGS = ['fr', 'en'];
export const DEFAULT_LANG = 'fr';

/** Current site language ('fr' | 'en'), read from the URL path. Matches both
 *  the production clean URL (/en, via Vercel cleanUrls) and the dev file path
 *  (/en.html, served directly by Vite). */
export function getLang() {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  const seg = window.location.pathname.replace(/^\/+/, '').split('/')[0].replace(/\.html$/, '');
  return seg === 'en' ? 'en' : 'fr';
}

/** Home-page path for a language — '/' for FR, '/en' for EN. */
export function homePath(lang) {
  return lang === 'en' ? '/en' : '/';
}

/** Pick the right variant from a { fr, en } map, falling back to FR. */
export function pick(map, lang = getLang()) {
  if (!map) return undefined;
  return map[lang] ?? map[DEFAULT_LANG];
}
