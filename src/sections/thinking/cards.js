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

// ── Dot 1 — /Stratégie — a radar chart that draws itself on open ─────────────
export function createStrategyCard() {
  const el = baseCard({ title: '/Stratégie', modifier: 'st' });

  const AXES = [
    { label: 'Vision',      value: 0.86 },
    { label: 'Insight',     value: 0.72 },
    { label: 'Audience',    value: 0.92 },
    { label: 'Différence',  value: 0.78 },
    { label: 'Objectif',    value: 0.88 },
  ];
  const N  = AXES.length;
  const cx = 110, cy = 100, r = 58;
  const angle  = (i) => -Math.PI / 2 + (i / N) * Math.PI * 2;
  const vertex = (i, scale) => {
    const a = angle(i);
    return [cx + scale * r * Math.cos(a), cy + scale * r * Math.sin(a)];
  };
  const pentaPts = (scale) => AXES.map((_, i) => {
    const [x, y] = vertex(i, scale);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const dataPts = AXES.map((a, i) => vertex(i, a.value));
  const dataPolyPts = dataPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  // Polyline closes by repeating the first vertex so stroke-dasharray draws the
  // full outline including the final edge back to the top.
  const dataLinePts = dataPolyPts + ' ' + `${dataPts[0][0].toFixed(1)},${dataPts[0][1].toFixed(1)}`;

  const axisLines = AXES.map((_, i) => {
    const [x, y] = vertex(i, 1);
    return `<line class="st__axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }).join('');

  const dots = dataPts.map(([x, y], i) =>
    `<circle class="st__dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" style="--i:${i}"/>`,
  ).join('');

  const labels = AXES.map((a, i) => {
    const [lx, ly] = vertex(i, 1.32);
    // Anchor text per side of the pentagon so labels don't clip the geometry.
    const anchor = i === 0 ? 'middle' : (lx > cx ? 'start' : 'end');
    return `<text class="st__label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" style="--li:${i}">${a.label}</text>`;
  }).join('');

  el.querySelector('.bcard__body').innerHTML = `
    <div class="st">
      <svg class="st__svg" viewBox="0 0 220 200" aria-hidden="true">
        <polygon class="st__ring"            points="${pentaPts(1)}"/>
        <polygon class="st__ring st__ring--m" points="${pentaPts(0.66)}"/>
        <polygon class="st__ring st__ring--s" points="${pentaPts(0.33)}"/>
        ${axisLines}
        <polygon  class="st__data-fill" points="${dataPolyPts}"/>
        <polyline class="st__data-line" points="${dataLinePts}"/>
        ${dots}
        ${labels}
      </svg>
    </div>
  `;

  const root = el.querySelector('.st');
  const line = el.querySelector('.st__data-line');

  return {
    el,
    closeSelector: '.bcard__close',
    play() {
      if (prefersReducedMotion()) { root.classList.add('is-done'); return; }
      const len = line.getTotalLength();
      line.style.transition = 'none';
      line.style.strokeDasharray  = `${len}`;
      line.style.strokeDashoffset = `${len}`;
      line.getBoundingClientRect(); // force reflow so the reset takes
      root.classList.remove('is-playing', 'is-done');
      requestAnimationFrame(() => {
        line.style.transition = 'stroke-dashoffset 1200ms var(--ease-out-expo)';
        line.style.strokeDashoffset = '0';
        root.classList.add('is-playing');
      });
    },
    stop() {
      root.classList.remove('is-playing', 'is-done');
    },
  };
}

// ── Dot 2 — /Business Value — a line graph that draws itself upward ──────────
export function createBusinessValueCard() {
  const el = baseCard({ title: '/Business Value', modifier: 'bv' });
  el.querySelector('.bcard__body').innerHTML = `
    <div class="bv">
      <span class="bv__delta">+38%</span>
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
export function createDesignSprintCard() {
  const el = baseCard({ title: '/Design Sprint', modifier: 'ds' });
  const STEPS = ['Map', 'Sketch', 'Decide', 'Prototype', 'Test'];
  el.querySelector('.bcard__body').innerHTML = `
    <ul class="ds">
      ${STEPS.map((s, i) => `
        <li class="ds__item${i < 1 ? ' is-done' : ''}" style="--i:${i}">
          <span class="ds__box"></span>
          <span class="ds__label">${s}</span>
        </li>`).join('')}
    </ul>
    <div class="ds__bar"><span class="ds__fill"></span></div>
    <div class="ds__status">
      <span class="ds__count"></span>
      <span class="ds__ready">SPRINT READY</span>
    </div>
  `;
  const list  = el.querySelector('.ds');
  const items = [...el.querySelectorAll('.ds__item')];
  const fill  = el.querySelector('.ds__fill');
  const count = el.querySelector('.ds__count');

  const update = () => {
    const done = items.filter((it) => it.classList.contains('is-done')).length;
    fill.style.width = `${(done / items.length) * 100}%`;
    count.textContent = `${done}/${items.length} terminé${done > 1 ? 's' : ''}`;
    el.classList.toggle('is-ready', done === items.length);
  };
  items.forEach((it) => it.addEventListener('click', () => {
    it.classList.toggle('is-done');
    update();
  }));
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
export function createBrainstormCard() {
  const el = baseCard({ title: '/Brainstorming', modifier: 'bs' });
  el.querySelector('.bcard__body').innerHTML = `<div class="bs"></div>`;
  const feed = el.querySelector('.bs');

  const MSGS = [
    { side: 'in',  text: 'C\'est quoi le vrai problème user ?' },
    { side: 'out', text: '40% abandonnent au checkout.' },
    { side: 'in',  text: 'Trop de champs ?' },
    { side: 'out', text: 'Oui. On garde l\'essentiel, on prototype.' },
    { side: 'in',  text: 'Parfait, je teste demain.' },
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
          row.innerHTML = `<div class="bs__bubble">${m.text}</div>`;
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
        feed.innerHTML = MSGS
          .map((m) => `<div class="bs__row bs__row--${m.side}"><div class="bs__bubble">${m.text}</div></div>`)
          .join('');
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

export function createBenchmarkStack({ stage }) {
  const layer = document.createElement('div');
  layer.className = 'bwin-layer';
  stage.appendChild(layer);

  let timers = [];
  let isOpen = false;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function makeWindow(site, i) {
    const w = document.createElement('div');
    w.className = 'bwin';
    w.style.setProperty('--accent', site.accent);
    w.style.zIndex = String(10 + i);
    w.innerHTML = `
      <div class="bwin__bar">
        <span class="bwin__lights"><i></i><i></i><i></i></span>
        <span class="bwin__url">${site.url}</span>
        <button class="bwin__close" type="button" aria-label="Fermer">×</button>
      </div>
      <div class="bwin__view">
        <div class="bwin__nav"><span></span><span></span><span></span></div>
        <div class="bwin__hero"></div>
        <div class="bwin__grid"><span></span><span></span><span></span></div>
      </div>
    `;
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
    const picks    = [...SITES].sort(() => Math.random() - 0.5).slice(0, 5);
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
