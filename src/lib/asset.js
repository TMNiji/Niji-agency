// Prefix a public-folder path with Vite's base URL so it resolves under a
// sub-path deploy (GitHub Pages serves this app from /Niji-agency/). BASE_URL is
// '/' in dev and '/Niji-agency/' in production. Absolute URLs (Sanity CDN, the
// QR API) and data URIs pass through untouched.
export function asset(path) {
  if (typeof path !== 'string') return path;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}
