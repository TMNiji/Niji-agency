// Prefix a public-folder path with Vite's base URL. BASE_URL is '/' (the site
// is served from the apex domain niji.agency). Absolute URLs (Sanity CDN, the
// QR API) and data URIs pass through untouched.
export function asset(path) {
  if (typeof path !== 'string') return path;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}
