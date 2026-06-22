// One-shot migration: upload every /public asset to Sanity and (re)build the
// singleton homePage documents — ONE PER LANGUAGE — so all text + assets become
// CMS-editable. French is served at /, English at /en (see src/lib/lang.js).
//
// Run from the repo root:  node scripts/populate-sanity.mjs
//
// The write token is read from the local Sanity CLI config (~/.config/sanity/
// config.json) — never hardcode or print it.

import { createClient } from '@sanity/client';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PUBLIC = join(ROOT, 'public');

const token =
  process.env.SANITY_AUTH_TOKEN ||
  JSON.parse(readFileSync(join(homedir(), '.config/sanity/config.json'), 'utf8')).authToken;
if (!token) throw new Error('No Sanity auth token found.');

const client = createClient({
  projectId: 'kpguac1f',
  dataset: 'production',
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

// One document id per language. The FR id is the original singleton so existing
// references / history are preserved; EN is a new sibling document.
const DOC_ID = { fr: '97134c16-fdf9-4c99-99c2-a2ef0a018939', en: 'homePage-en' };

// ── Asset upload with per-path cache so a file shared across fields uploads once.
const cache = new Map();
async function upload(kind, relPath) {
  if (cache.has(relPath)) return cache.get(relPath);
  const abs = join(PUBLIC, relPath);
  const buf = readFileSync(abs);
  const asset = await client.assets.upload(kind, buf, { filename: basename(relPath) });
  console.log(`  ↑ ${kind}  ${relPath}  →  ${asset._id}`);
  cache.set(relPath, asset._id);
  return asset._id;
}
const imageRef = async (relPath) => ({ _type: 'image', asset: { _type: 'reference', _ref: await upload('image', relPath) } });
const fileRef  = async (relPath) => ({ _type: 'file',  asset: { _type: 'reference', _ref: await upload('file',  relPath) } });

// The "Explore with AI" links are intentionally NOT written to the CMS: the
// prompt is localized (FR/EN) and points at niji.agency at runtime, so it lives
// in code (src/sections/shared/aiLinks.js → DEFAULT_AI_LINKS). Leaving aiLinks
// unset here lets every consumer fall back to that localized default.

const FACE = {
  bgBottomRight:   'hero/bg-bottom-right.webp',
  bgTop:           'hero/bg-top.webp',
  foreheadLeftBg:  'hero/forehead-left-bg.webp',
  foreheadBgRight: 'hero/forehead-bg-right.webp',
  bgBottom:        'hero/bg-bottom.webp',
  mouthLeft:       'hero/mouth-left.webp',
  mouthRight:      'hero/mouth-right.webp',
  eyeLeft:         'hero/eye-left.webp',
  earRight:        'hero/ear-right.webp',
  bottomEarRight:  'hero/bottom-ear-right.webp',
  earLeft:         'hero/ear-left.webp',
  eyeRight:        'hero/eye-right.webp',
};

// Per-client: assets + accent + back-face type are language-neutral; only the
// front label and (text-back) blurb are translated.
const CLIENTS = [
  { name: 'Lacoste',          logo: 'logo/lacoste.png',          accent: '#00563F', back: 'image', image: 'clients/screenshots/lacoste.webp',
    frontLabel: { fr: '1ère app m-commerce',                       en: 'First m-commerce app' } },
  { name: 'Grand Frais',      logo: 'logo/grand_frais_grey.svg', accent: '#2EA84A', back: 'image', image: 'clients/screenshots/grand-frais.webp', caseUrl: 'https://apps.apple.com/fr/app/grand-frais/id6753673412',
    frontLabel: { fr: '1ère app m-commerce',                       en: 'First m-commerce app' } },
  { name: 'Aromazone',        logo: 'logo/aromazone.svg',        accent: '#4A3428', back: 'text',
    frontLabel: { fr: 'App & Commerce',                            en: 'App & Commerce' },
    blurb:      { fr: 'Product & Experience',                      en: 'Product & Experience' } },
  { name: 'Orange',           logo: 'logo/orange.png',           accent: '#FF7900', back: 'text',
    frontLabel: { fr: 'Experience',                               en: 'Experience Design' },
    blurb:      { fr: 'Design Partenaire depuis 10 ans',          en: 'Partner for 10 years' } },
  { name: 'Relais & Châteaux',logo: 'logo/relais-chateaux.png',  accent: '#7A1A2F', back: 'qr',    qr: 'clients/qr/relais-chateaux.svg', caseUrl: 'https://vimeo.com/842443761/4551f51afc?share=copy&fl=sv&fe=ci',
    frontLabel: { fr: 'Plateforme de marque & Ecosystème digital', en: 'Brand platform & Digital ecosystem' } },
  { name: 'Arte',             logo: 'logo/arte.svg',             accent: '#FF4E00', back: 'text',
    frontLabel: { fr: 'Plateforme digitale',                      en: 'Digital platform' },
    blurb:      { fr: 'Product & Experience',                      en: 'Product & Experience' } },
  { name: 'Decathlon',        logo: 'logo/decathlon.svg',        accent: '#0082C3', back: 'text',
    frontLabel: { fr: 'Application métiers',                       en: 'Business app' },
    blurb:      { fr: 'Partenaire depuis 8 ans',                   en: 'Partner for 8 years' } },
  { name: 'Accor',            logo: 'logo/accor.png',            accent: '#C9A14D', back: 'image', image: 'clients/screenshots/accor.webp', caseUrl: 'https://group.accor.com/fr',
    frontLabel: { fr: 'Site Corporate',                           en: 'Corporate site' } },
  { name: 'BNP Paribas',      logo: 'logo/bnp-paribas.png',      accent: '#008855', back: 'text',
    frontLabel: { fr: 'Design System. Partenaire depuis 9 ans.',  en: 'Design System. Partner for 9 years.' },
    blurb:      { fr: 'Partenaire depuis 9 ans',                  en: 'Partner for 9 years' } },
  { name: 'Ritz',             logo: 'logo/ritz.png',             accent: '#1F2A44', back: 'qr',    qr: 'clients/qr/ritz.svg', caseUrl: 'https://vimeo.com/911295072/ad02f28185?share=copy&fl=sv&fe=ci',
    frontLabel: { fr: 'Ecosystème digital',                       en: 'Digital ecosystem' } },
  { name: 'RATP',             logo: 'logo/ratp.webp',            accent: '#008C53', back: 'qr',    qr: 'clients/qr/ratp.svg', caseUrl: 'https://vimeo.com/911295002/cabba31990?share=copy&fl=sv&fe=ci',
    frontLabel: { fr: '1er site web eco-conçu et accessible',     en: 'First eco-designed, accessible website' } },
  { name: 'Groupe Bel',       logo: 'logo/groupe-bel.png',       accent: '#E60028', back: 'image', image: 'clients/screenshots/bel.webp', caseUrl: 'https://www.groupe-bel.com',
    frontLabel: { fr: 'Site Groupe',                              en: 'Group site' } },
];

// Award tallies are language-neutral (proper names + counts); only the section
// heading differs per language (see COPY.awards).
const AWARDS = [
  { title: '25 Grand Prix Stratégies', details: ['1 Grand Prix | 13 Golds', '7 Silvers | 4 Bronzes'],            trophy: 'awards/strat_square.glb' },
  { title: '11 Lovie Awards',          details: ['2 Golds | 4 Silvers | 2 Bronzes', '2 Shortlist | Top 4 worldwide'], trophy: 'awards/lovie.glb' },
  { title: '7 Webby Awards',           details: ['3 Nominee | 4 Honoree', 'Top 4 Agency worldwide'],             trophy: 'awards/webby.glb' },
];

// Benchmark windows (thinking card 5) — URLs are language-neutral.
const BENCHMARK_SITES = [
  { url: 'stripe.com',    accent: '#635bff' },
  { url: 'linear.app',    accent: '#5e6ad2' },
  { url: 'vercel.com',    accent: '#111111' },
  { url: 'awwwards.com',  accent: '#222222' },
  { url: 'figma.com',     accent: '#f24e1e' },
  { url: 'framer.com',    accent: '#0099ff' },
  { url: 'dribbble.com',  accent: '#ea4c89' },
  { url: 'behance.net',   accent: '#1769ff' },
  { url: 'godly.website', accent: '#16a34a' },
  { url: 'apple.com',     accent: '#555555' },
];

// ── Per-language copy ────────────────────────────────────────────────────────
const COPY = {
  fr: {
    sectionLabels: ['VISION', 'THINKING', 'DESIGN', 'CODE', 'CLIENTS', 'AWARDS', 'CONTACT'],
    hero: {
      title: 'We\nMake products\nfor humans.\n&AGENTS',
      subtitle: [
        'Agence de product design AI-native.',
        '115 designers | 9 bureaux',
        '25 ans à construire',
        "ce qui se regarde, s'utilise",
        'et maintenant se parle.',
      ].join('\n'),
    },
    thinking: {
      services: [
        { tag: 'PRODUCT',  items: ['Vision, conception et roadmap',    'Design system, tokens, gouvernance'] },
        { tag: 'AI',       items: ['Audit, workflows',                  "Développement d'agents"] },
        { tag: 'BUSINESS', items: ['Unit economics, cost-to-serve',     'Cadrage produit, business case, go-to-market'] },
        { tag: 'BRANDING', items: ['Plateforme et positionnement',      'Promesse, preuves, expérience'] },
      ],
      cards: {
        strategy:      { title: '/Stratégie', recto: 'Pas une feature à ajouter.', verso: 'Une expérience à réinventer.' },
        businessValue: { title: '/Business Value', deltaTag: 'LCV', deltaValue: '+38 %' },
        designSprint:  { title: '/Design Sprint', steps: ['Brief', 'Hypothèse', 'Proto', 'Test', 'Décision'] },
        brainstorm: { title: '/Brainstorming', messages: [
          { side: 'in',  text: "C'est quoi le vrai problème ?" },
          { side: 'out', text: '40 % abandonnent au checkout.' },
          { side: 'in',  text: 'Humains ? Agents ?' },
          { side: 'out', text: 'Les 2' },
          { side: 'out', text: 'Ok, on active le protocole AI.Commerce' },
        ] },
      },
    },
    design: {
      title: 'Du chaos naît le produit',
      subtitle: "On juge une idée à ce qu'elle transforme",
      services: [
        { tag: 'CONCEPT',  items: ['Vision produit, direction créative',  'Concepts qui tiennent en boardroom'] },
        { tag: 'WORKSHOP', items: ['Idéation co-conçue avec vos équipes', 'Une idée par mur. Une décision par jour.'] },
        { tag: 'WORKFLOW', items: ['IA générative dans le process créatif', 'Idée prototypée en quelques heures'] },
      ],
    },
    code: {
      title: 'Le produit prend vie.',
      subtitle: "Le go-live n'est que le début.",
      services: [
        { tag: 'FRONT',           items: ['React, Next.js, Vue, TypeScript',       'Shopify, Salesforce Commerce Cloud'] },
        { tag: 'ANIMATION',       items: ['GSAP, Three.js, Framer Motion, Lottie', 'Le mouvement sert le produit, ou il sort'] },
        { tag: 'AI PIXEL CODEUR', items: ['Figma vers React, sans handoff',         'Design-to-code-to-design'] },
      ],
    },
    clients: { title: 'Quelques grands noms qui nous font confiance', subtitle: 'Des produits à leur hauteur' },
    awards:  { headingTop: 'On ne les cherchait pas.', headingBottom: 'Ils sont là.' },
    contact: {
      headline: ['Question rapide, demandez à une IA.', 'Sujet sérieux, demandez à un humain.'],
      contacts: [
        { topic: 'Pour parler burning platform et impact P&L global', email: 'yv.corbeil@niji.fr' },
        { topic: 'Pour parler AI commerce, conversion, refonte e-commerce', email: 'nicolas.prudhomme@niji.fr' },
        { topic: 'Pour parler produit, branding et agents IA', email: 'chris.de-abreu@niji.fr' },
      ],
      loopLabel: 'Keep scrolling — back to start',
    },
  },

  en: {
    sectionLabels: ['VISION', 'THINKING', 'DESIGN', 'CODE', 'CLIENTS', 'AWARDS', 'CONTACT'],
    hero: {
      title: 'We\nMake products\nfor humans.\nAnd agents.',
      subtitle: [
        'AI-native product design agency.',
        'Creative force in build, operational rigor in run.',
        '115 designers | 9 offices',
        '25 years building what you look at, use, and now talk to.',
      ].join('\n'),
    },
    thinking: {
      services: [
        { tag: 'PRODUCT',  items: ['Vision, design and roadmap',          'Design system, tokens, governance'] },
        { tag: 'AI',       items: ['Audit, workflows',                    'Agent development'] },
        { tag: 'BUSINESS', items: ['Unit economics, cost-to-serve',       'Product scoping, business case, go-to-market'] },
        { tag: 'BRANDING', items: ['Platform and positioning',           'Promise, proof, experience'] },
      ],
      cards: {
        strategy:      { title: '/Strategy', recto: 'Not a feature to bolt on.', verso: 'An experience to reinvent.' },
        businessValue: { title: '/Business Value', deltaTag: 'LCV', deltaValue: '+38 %' },
        designSprint:  { title: '/Design Sprint', steps: ['Brief', 'Hypothesis', 'Proto', 'Test', 'Decision'] },
        brainstorm: { title: '/Brainstorming', messages: [
          { side: 'in',  text: "What's the real problem?" },
          { side: 'out', text: '40% drop off at checkout.' },
          { side: 'in',  text: 'Humans? Agents?' },
          { side: 'out', text: 'Both.' },
        ] },
      },
    },
    design: {
      title: 'Out of chaos, the product',
      subtitle: 'You judge an idea by what it changes',
      services: [
        { tag: 'CONCEPT',  items: ['Product vision, creative direction',   'Concepts that hold up in the boardroom'] },
        { tag: 'WORKSHOP', items: ['Ideation co-built with your teams',    'One idea per wall. One decision per day.'] },
        { tag: 'WORKFLOW', items: ['Generative AI inside the creative process', 'An idea prototyped in hours'] },
      ],
    },
    code: {
      title: 'The product comes to life.',
      subtitle: 'Go-live is just the start.',
      services: [
        { tag: 'FRONT',          items: ['React, Next.js, Vue, TypeScript',       'Shopify, Salesforce Commerce Cloud'] },
        { tag: 'ANIMATION',      items: ['GSAP, Three.js, Framer Motion, Lottie', 'Motion serves the product, or it goes'] },
        { tag: 'AI PIXEL CODER', items: ['Figma to React, no handoff',            'Design-to-code-to-design'] },
      ],
    },
    clients: { title: 'A few big names who trust us', subtitle: 'products that match them' },
    awards:  { headingTop: '56 awards · 2020 → 2025', headingBottom: 'We look at the P&L before the trophy shelf.' },
    contact: {
      headline: ['Quick question? Ask an AI.', 'Serious matter? Ask a human.'],
      contacts: [
        { topic: 'To talk burning platform and global P&L impact', email: 'yv.corbeil@niji.fr' },
        { topic: 'To talk AI commerce, conversion, e-commerce redesign', email: 'nicolas.prudhomme@niji.fr' },
        { topic: 'To talk product, branding and AI agents', email: 'chris.de-abreu@niji.fr' },
      ],
      loopLabel: 'Keep scrolling — back to start',
    },
  },
};

const withKeys = (arr) => arr.map((o, i) => ({ _key: `k${i}`, ...o }));

async function buildClientAssets(c) {
  const out = {
    _type: 'object', _key: c.name.replace(/[^a-z0-9]/gi, '').toLowerCase(),
    name: c.name, accent: c.accent, back: c.back,
    logo: await imageRef(c.logo),
  };
  if (c.back === 'image') out.image = await imageRef(c.image);
  if (c.back === 'qr')    out.qr    = await imageRef(c.qr);
  if (c.caseUrl)          out.caseUrl = c.caseUrl;
  return out;
}

async function buildAwardAssets(a, i) {
  return { _type: 'object', _key: `award${i}`, title: a.title, details: a.details, trophy: await fileRef(a.trophy) };
}

function buildDoc(lang, copy, shared) {
  const t = copy.thinking;
  return {
    _id: DOC_ID[lang],
    _type: 'homePage',
    language: lang,
    logo: shared.logo,
    sectionLabels: copy.sectionLabels,
    hero: { ...copy.hero, facePack: shared.facePack },
    thinking: {
      services: withKeys(t.services),
      cards: {
        strategy: t.cards.strategy,
        businessValue: t.cards.businessValue,
        designSprint: t.cards.designSprint,
        brainstorm: { title: t.cards.brainstorm.title, messages: withKeys(t.cards.brainstorm.messages) },
        benchmark: { sites: withKeys(BENCHMARK_SITES) },
      },
    },
    design: { ...copy.design, services: withKeys(copy.design.services) },
    code:   { ...copy.code,   services: withKeys(copy.code.services) },
    clients: {
      title: copy.clients.title,
      subtitle: copy.clients.subtitle,
      list: shared.clientAssets.map((base, i) => {
        const src = CLIENTS[i];
        const out = { ...base, frontLabel: src.frontLabel[lang] };
        if (src.back === 'text') out.blurb = src.blurb[lang];
        return out;
      }),
    },
    awards: { ...copy.awards, list: shared.awardAssets },
    contact: {
      headline: copy.contact.headline,
      contacts: copy.contact.contacts.map((c) => ({ _type: 'contactEntry', ...c })),
      loopLabel: copy.contact.loopLabel,
    },
  };
}

async function main() {
  console.log('Uploading assets…');

  const facePack = {};
  for (const [k, v] of Object.entries(FACE)) facePack[k] = await imageRef(v);

  const clientAssets = [];
  for (const c of CLIENTS) clientAssets.push(await buildClientAssets(c));

  const awardAssets = [];
  for (let i = 0; i < AWARDS.length; i++) awardAssets.push(await buildAwardAssets(AWARDS[i], i));

  const logo = await imageRef('logo/niji-mark.svg');

  const shared = { logo, facePack, clientAssets, awardAssets };

  for (const lang of ['fr', 'en']) {
    console.log(`Writing ${lang.toUpperCase()} homePage document…`);
    await client.createOrReplace(buildDoc(lang, COPY[lang], shared));
  }
  console.log('✓ Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
