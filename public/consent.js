/*
 * Google Analytics 4 + RGPD consent banner (Google Consent Mode v2).
 *
 * Self-contained, framework-free script shared by both the Vite home page
 * (index.html) and the static /mentions-legales page — neither can share an
 * ES module, so this lives in public/ and is loaded with a plain <script>.
 *
 * Behaviour: consent defaults to DENIED. GA is not loaded and fires nothing
 * until the visitor clicks "Accepter". The choice is stored in localStorage,
 * so the banner only shows until the visitor decides.
 *
 * GA_ID is a Google Analytics Measurement ID — a public, client-side
 * identifier (not a secret), so hardcoding it here is expected.
 */
(function () {
  var GA_ID = 'G-T8P06050ZD';
  var STORAGE_KEY = 'niji-consent'; // 'granted' | 'denied'

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  // Consent Mode v2 — deny everything by default, before any GA call.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });

  var gaLoaded = false;
  function loadGA() {
    if (gaLoaded) return;
    gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function grant() {
    gtag('consent', 'update', { analytics_storage: 'granted' });
    loadGA();
  }

  // Withdraw a previously-given consent. Consent Mode flips back to denied so
  // GA stops using storage immediately (the gtag.js script can't be unloaded,
  // but with analytics_storage denied it fires nothing persistent), and we
  // best-effort delete the _ga* cookies it already set.
  function revoke() {
    gtag('consent', 'update', { analytics_storage: 'denied' });
    var base = location.hostname.replace(/^www\./, '');
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (name.indexOf('_ga') !== 0) return;
      var expire = '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      document.cookie = name + expire;
      document.cookie = name + expire + ';domain=' + location.hostname;
      document.cookie = name + expire + ';domain=.' + base;
    });
  }

  function store(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* private mode */ }
  }
  function read() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css =
      '.nj-consent{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
      'z-index:2147483000;width:calc(100% - 32px);max-width:560px;display:flex;' +
      'flex-direction:column;gap:16px;padding:20px 22px;border-radius:14px;' +
      'background:rgba(18,18,18,.92);border:1px solid rgba(255,255,255,.12);' +
      'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
      "box-shadow:0 12px 40px rgba(0,0,0,.5);color:#fff;" +
      "font-family:'N27',-apple-system,BlinkMacSystemFont,sans-serif;" +
      'opacity:0;transition:opacity .35s ease,transform .35s ease;transform:translateX(-50%) translateY(8px)}' +
      '.nj-consent.is-in{opacity:1;transform:translateX(-50%) translateY(0)}' +
      '.nj-consent__text{margin:0;font-size:.875rem;line-height:1.55;color:rgba(255,255,255,.85)}' +
      '.nj-consent__text a{color:#fff;text-decoration:underline;text-underline-offset:2px}' +
      '.nj-consent__actions{display:flex;gap:10px;justify-content:flex-end}' +
      '.nj-consent__btn{font:inherit;font-size:.8125rem;letter-spacing:.02em;cursor:pointer;' +
      'padding:9px 18px;border-radius:999px;border:1px solid transparent;transition:opacity .2s ease,background .2s ease,border-color .2s ease}' +
      '.nj-consent__btn--ghost{background:transparent;border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.8)}' +
      '.nj-consent__btn--ghost:hover{border-color:rgba(255,255,255,.5);color:#fff}' +
      '.nj-consent__btn--solid{background:#fff;color:#0a0a0a;font-weight:700}' +
      '.nj-consent__btn--solid:hover{opacity:.85}' +
      '@media (min-width:520px){.nj-consent{flex-direction:row;align-items:center;justify-content:space-between}' +
      '.nj-consent__actions{flex:none}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showBanner() {
    // Guard against a second banner when "Gérer mes cookies" is clicked twice.
    if (document.querySelector('.nj-consent')) return;
    injectStyles();
    var banner = document.createElement('div');
    banner.className = 'nj-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Consentement aux cookies de mesure d’audience');
    banner.innerHTML =
      '<p class="nj-consent__text">Nous utilisons des cookies de mesure d’audience (Google Analytics) ' +
      'pour comprendre comment le site est utilisé. ' +
      '<a href="/mentions-legales/">En savoir plus</a></p>' +
      '<div class="nj-consent__actions">' +
      '<button type="button" class="nj-consent__btn nj-consent__btn--ghost" data-action="refuse">Refuser</button>' +
      '<button type="button" class="nj-consent__btn nj-consent__btn--solid" data-action="accept">Accepter</button>' +
      '</div>';

    function close() {
      banner.classList.remove('is-in');
      setTimeout(function () { banner.remove(); }, 350);
    }
    banner.addEventListener('click', function (e) {
      var action = e.target && e.target.getAttribute('data-action');
      if (action === 'accept') { store('granted'); grant(); close(); }
      else if (action === 'refuse') { store('denied'); revoke(); close(); }
    });

    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.classList.add('is-in'); });
  }

  function init() {
    var choice = read();
    if (choice === 'granted') { grant(); return; }
    if (choice === 'denied') { return; } // stays denied, no banner
    showBanner();
  }

  // Public API — the "Gérer mes cookies" footer link calls open() to re-show
  // the banner so a visitor can change or withdraw their choice at any time
  // (required by the CNIL: revoking must be as easy as granting).
  window.nijiConsent = { open: showBanner };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
