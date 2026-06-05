// Build-section cards — one per orbital dot.
//
// Dots 1-4 open a single floating card (positioned + connector-lined by
// orbital.js). Dot 5 (Benchmark) opens a cascading stack of faux browser
// windows instead. Each single-card builder returns:
//   { el, closeSelector, play(), stop() }
// where play() starts the card's animation on open and stop() tears it down on
// close. orbital.js draws the connector to the card's bottom-centre.

import { prefersReducedMotion } from '@modules/motion.js';

// ── Shared free-form card chrome (dots 2-4) ──────────────────────────────────
function baseCard({ title, modifier }) {
  const el = document.createElement('div');
  el.className = `bcard bcard--${modifier}`;
  el.innerHTML = `
    <div class="bcard__head">
      <span class="bcard__title">${title}</span>
      <button class="bcard__close" type="button" aria-label="Fermer">×</button>
    </div>
    <div class="bcard__body"></div>
  `;
  return el;
}

// ── Dot 1 — /Stratégie — flippable recto/verso text card ─────────────────────
// The radar/spider chart used to live here. It was replaced by a two-sided
// statement: the recto reads "Pas une feature à ajouter." and a click flips to
// the verso "Une expérience à réinventer." A small chevron hints at the flip.
// play()/stop() reset the card to its recto on each open.
export function createStrategyCard({
  title = '/Stratégie',
  recto = 'Pas une feature à ajouter.',
  verso = 'Une expérience à réinventer.',
} = {}) {
  const el = baseCard({ title, modifier: 'st' });

  const body = el.querySelector('.bcard__body');
  body.innerHTML = `
    <div class="st-flip" role="button" tabindex="0" aria-label="Retourner la carte">
      <div class="st-flip__inner">
        <div class="st-flip__face st-flip__face--recto">
          <p class="st-flip__text"></p>
          <span class="st-flip__hint">Cliquer pour retourner →</span>
        </div>
        <div class="st-flip__face st-flip__face--verso">
          <p class="st-flip__text"></p>
          <span class="st-flip__hint">← Retour</span>
        </div>
      </div>
    </div>
  `;
  body.querySelector('.st-flip__face--recto .st-flip__text').textContent = recto;
  body.querySelector('.st-flip__face--verso .st-flip__text').textContent = verso;

  const flip = el.querySelector('.st-flip');
  function toggle() { flip.classList.toggle('is-flipped'); }
  // Click + keyboard activation. Pointer event is stopped so the orbital's
  // click-outside handler doesn't close the popup when the user just wanted to
  // flip the card.
  flip.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  flip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });

  return {
    el,
    closeSelector: '.bcard__close',
    play()  { flip.classList.remove('is-flipped'); },
    stop()  { flip.classList.remove('is-flipped'); },
  };
}

// ── Dot 2 — /Business Value — a line graph that draws itself upward ──────────
export function createBusinessValueCard({
  title = '/Business Value',
  deltaTag = 'LCV',
  deltaValue = '+38 %',
} = {}) {
  const el = baseCard({ title, modifier: 'bv' });
  el.querySelector('.bcard__body').innerHTML = `
    <div class="bv">
      <span class="bv__delta"><span class="bv__delta-tag"></span> <span class="bv__delta-val"></span></span>
      <svg class="bv__svg" viewBox="0 0 220 120" aria-hidden="true">
        <defs>
          <linearGradient id="bvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="rgba(0,101,255,0.30)"/>
            <stop offset="100%" stop-color="rgba(0,101,255,0)"/>
          </linearGradient>
        </defs>
        <path class="bv__area" d="M6,108 L48,96 L90,100 L130,66 L172,46 L214,16 L214,120 L6,120 Z" fill="url(#bvGrad)"/>
        <path class="bv__line" d="M6,108 L48,96 L90,100 L130,66 L172,46 L214,16"
              fill="none" stroke="#0065FF" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round"/>
        <circle class="bv__end" cx="214" cy="16" r="4" fill="#0065FF"/>
      </svg>
    </div>
  `;
  const bv   = el.querySelector('.bv');
  const line = el.querySelector('.bv__line');
  el.querySelector('.bv__delta-tag').textContent = deltaTag;
  el.querySelector('.bv__delta-val').textContent = deltaValue;

  return {
    el,
    closeSelector: '.bcard__close',
    play() {
      if (prefersReducedMotion()) { bv.classList.add('is-done'); return; }
      const len = line.getTotalLength();
      line.style.transition = 'none';
      line.style.strokeDasharray  = `${len}`;
      line.style.strokeDashoffset = `${len}`;
      line.getBoundingClientRect(); // force reflow so the reset takes
      bv.classList.remove('is-done');
      requestAnimationFrame(() => {
        line.style.transition = 'stroke-dashoffset 1200ms var(--ease-out-expo)';
        line.style.strokeDashoffset = '0';
        bv.classList.add('is-playing');
      });
    },
    stop() {
      bv.classList.remove('is-playing', 'is-done');
    },
  };
}

// ── Dot 3 — /Design Sprint — an interactive checklist ────────────────────────
export function createDesignSprintCard({
  title = '/Design Sprint',
  steps,
} = {}) {
  const el = baseCard({ title, modifier: 'ds' });
  const STEPS = steps?.length ? steps : ['Brief', 'Hypothèse', 'Proto', 'Test', 'Décision'];
  el.querySelector('.bcard__body').innerHTML = `
    <ul class="ds">
      ${STEPS.map((_, i) => `
        <li class="ds__item${i < 1 ? ' is-done' : ''}" style="--i:${i}" role="checkbox" tabindex="0" aria-checked="${i < 1 ? 'true' : 'false'}">
          <span class="ds__box"></span>
          <span class="ds__label"></span>
        </li>`).join('')}
    </ul>
    <div class="ds__bar"><span class="ds__fill"></span></div>
    <div class="ds__status">
      <span class="ds__count"></span>
      <span class="ds__ready">GO/NOGO</span>
    </div>
  `;
  const list  = el.querySelector('.ds');
  const items = [...el.querySelectorAll('.ds__item')];
  const fill  = el.querySelector('.ds__fill');
  const count = el.querySelector('.ds__count');
  items.forEach((it, i) => { it.querySelector('.ds__label').textContent = STEPS[i]; });

  const update = () => {
    const done = items.filter((it) => it.classList.contains('is-done')).length;
    fill.style.width = `${(done / items.length) * 100}%`;
    count.textContent = `${done}/${items.length} terminé${done > 1 ? 's' : ''}`;
    el.classList.toggle('is-ready', done === items.length);
  };
  const toggle = (it) => {
    const done = it.classList.toggle('is-done');
    it.setAttribute('aria-checked', done ? 'true' : 'false');
    update();
  };
  items.forEach((it) => {
    it.addEventListener('click', () => toggle(it));
    it.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(it); }
    });
  });
  update();

  return {
    el,
    closeSelector: '.bcard__close',
    play() {
      if (prefersReducedMotion()) return;
      list.classList.remove('is-in');
      void list.offsetWidth; // restart the stagger each open
      list.classList.add('is-in');
    },
    stop() {},
  };
}

// ── Dot 4 — /Brainstorming — chat messages that auto-play and loop ───────────
export function createBrainstormCard({ title = '/Brainstorming', messages } = {}) {
  const el = baseCard({ title, modifier: 'bs' });
  el.querySelector('.bcard__body').innerHTML = `<div class="bs"></div>`;
  const feed = el.querySelector('.bs');

  const MSGS = messages?.length ? messages : [
    { side: 'in',  text: 'C\'est quoi le vrai problème ?' },
    { side: 'out', text: '40 % abandonnent au checkout.' },
    { side: 'in',  text: 'Humains ? Agents ?' },
    { side: 'out', text: 'Les 2' },
    { side: 'out', text: 'Ok, on active le protocole AI.Commerce' },
  ];

  const TYPING_MS = 700;
  const READ_MS   = 600;
  const GAP_MS    = 450;

  let timers = [];
  const clear  = () => { timers.forEach(clearTimeout); timers = []; };
  const scroll = () => { feed.scrollTop = feed.scrollHeight; };

  function run() {
    feed.innerHTML = '';
    let t = 250;
    MSGS.forEach((m) => {
      timers.push(setTimeout(() => {
        const row = document.createElement('div');
        row.className = `bs__row bs__row--${m.side}`;
        row.innerHTML = `<div class="bs__typing"><i></i><i></i><i></i></div>`;
        feed.appendChild(row);
        scroll();
        timers.push(setTimeout(() => {
          row.innerHTML = '';
          const b = document.createElement('div');
          b.className = 'bs__bubble';
          b.textContent = m.text;   // textContent — CMS copy can't inject markup
          row.appendChild(b);
          scroll();
        }, TYPING_MS));
      }, t));
      t += TYPING_MS + READ_MS + GAP_MS;
    });
    timers.push(setTimeout(run, t + 1700)); // loop
  }

  return {
    el,
    closeSelector: '.bcard__close',
    play() {
      clear();
      if (prefersReducedMotion()) {
        feed.innerHTML = '';
        MSGS.forEach((m) => {
          const row = document.createElement('div');
          row.className = `bs__row bs__row--${m.side}`;
          const b = document.createElement('div');
          b.className = 'bs__bubble';
          b.textContent = m.text;
          row.appendChild(b);
          feed.appendChild(row);
        });
        scroll();
        return;
      }
      run();
    },
    stop() { clear(); },
  };
}

// ── Dot 5 — /Benchmark — a cascade of faux browser windows ───────────────────
const SITES = [
  { url: 'stripe.com',   accent: '#635bff' },
  { url: 'linear.app',   accent: '#5e6ad2' },
  { url: 'vercel.com',   accent: '#111111' },
  { url: 'awwwards.com', accent: '#222222' },
  { url: 'figma.com',    accent: '#f24e1e' },
  { url: 'framer.com',   accent: '#0099ff' },
  { url: 'dribbble.com', accent: '#ea4c89' },
  { url: 'behance.net',  accent: '#1769ff' },
  { url: 'godly.website', accent: '#16a34a' },
  { url: 'apple.com',    accent: '#555555' },
];

export function createBenchmarkStack({ stage, sites } = {}) {
  const SITE_LIST = sites?.length ? sites : SITES;
  const layer = document.createElement('div');
  layer.className = 'bwin-layer';
  stage.appendChild(layer);

  let timers = [];
  let isOpen = false;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function makeWindow(site, i) {
    const w = document.createElement('div');
    w.className = 'bwin';
    if (site.accent) w.style.setProperty('--accent', site.accent);
    w.style.zIndex = String(10 + i);
    w.innerHTML = `
      <div class="bwin__bar">
        <span class="bwin__lights"><i></i><i></i><i></i></span>
        <span class="bwin__url"></span>
        <button class="bwin__close" type="button" aria-label="Fermer">×</button>
      </div>
      <div class="bwin__view">
        <div class="bwin__nav"><span></span><span></span><span></span></div>
        <div class="bwin__hero"></div>
        <div class="bwin__grid"><span></span><span></span><span></span></div>
      </div>
    `;
    w.querySelector('.bwin__url').textContent = site.url;
    w.querySelector('.bwin__close').addEventListener('click', (e) => {
      e.stopPropagation();
      w.classList.add('is-out');
      setTimeout(() => w.remove(), 220);
    });
    return w;
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    clearTimers();
    layer.innerHTML = '';

    const reduced  = prefersReducedMotion();
    // Fisher-Yates — an unbiased shuffle. (`sort(() => Math.random() - 0.5)` is
    // biased: comparator results aren't consistent, so some orders are favoured.)
    const pool = [...SITE_LIST];
    for (let k = pool.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [pool[k], pool[j]] = [pool[j], pool[k]];
    }
    const picks = pool.slice(0, 5);
    const sw = stage.offsetWidth  || window.innerWidth;
    const sh = stage.offsetHeight || window.innerHeight;
    const baseX = sw / 2 - 150; // windows are 300px wide
    const baseY = sh / 2 - 150;

    picks.forEach((site, i) => {
      const w  = makeWindow(site, i);
      const dx = (i - 2) * 34;
      const dy = (i - 2) * 26;
      const rot = (i - 2) * 2.4;
      w.style.left = `${baseX + dx}px`;
      w.style.top  = `${baseY + dy}px`;
      w.style.setProperty('--rot', `${rot}deg`);
      layer.appendChild(w);
      timers.push(setTimeout(() => w.classList.add('is-in'), reduced ? 0 : 90 + i * 150));
    });
  }

  function close() {
    isOpen = false;
    clearTimers();
    layer.innerHTML = '';
  }

  return { open, close };
}
