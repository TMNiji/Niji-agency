// Case-study overlay — plays a Vimeo case or previews a site in a 16:9 frame
// over the page, instead of navigating the user away. A single overlay element
// is created lazily and reused; opening swaps the iframe source, closing clears
// it so playback stops.

let overlay = null;
let media = null;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'case-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="case-overlay__backdrop"></div>
    <div class="case-overlay__frame">
      <button class="case-overlay__close" type="button" aria-label="Fermer">×</button>
      <div class="case-overlay__media"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  media = overlay.querySelector('.case-overlay__media');
  overlay.querySelector('.case-overlay__backdrop').addEventListener('click', closeCaseOverlay);
  overlay.querySelector('.case-overlay__close').addEventListener('click', closeCaseOverlay);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeCaseOverlay();
  });
  return overlay;
}

// https://vimeo.com/{id}/{hash}?... → https://player.vimeo.com/video/{id}?h={hash}
// The second path segment is the unlisted-video privacy hash.
function vimeoEmbed(url) {
  try {
    const u = new URL(url);
    const [id, hash] = u.pathname.split('/').filter(Boolean);
    if (!/^\d+$/.test(id)) return null;
    const q = new URLSearchParams({ autoplay: '1', byline: '0', portrait: '0', title: '0' });
    if (hash) q.set('h', hash);
    return `https://player.vimeo.com/video/${id}?${q.toString()}`;
  } catch (_) {
    return null;
  }
}

export function openCaseOverlay(url, label = '') {
  ensureOverlay();
  const isVimeo = /(^|\.)vimeo\.com$/.test((() => {
    try { return new URL(url).hostname; } catch (_) { return ''; }
  })());
  const src = isVimeo ? (vimeoEmbed(url) ?? url) : url;

  const iframe = document.createElement('iframe');
  iframe.className = 'case-overlay__iframe';
  iframe.src = src;
  iframe.title = label || 'Aperçu';
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
  iframe.setAttribute('allowfullscreen', '');

  media.innerHTML = '';
  media.appendChild(iframe);
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}

export function closeCaseOverlay() {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.hidden = true;
  media.innerHTML = ''; // unload the iframe so the video stops playing
}
