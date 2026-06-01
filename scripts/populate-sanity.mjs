// One-shot migration: upload every /public asset to Sanity and (re)build the
// singleton homePage document so all text + assets become CMS-editable.
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

const DOC_ID = '97134c16-fdf9-4c99-99c2-a2ef0a018939';

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

// ── Shared AI-links payload (mirrors src/sections/shared/aiLinks.js) ──────────
const NIJI_PROMPT = 'I want to understand what Niji is and what they do. They are a French digital agency specialising in UX/UI design, custom development, digital transformation, e-commerce, and data & AI services. They work with major enterprise accounts across retail, banking, luxury, and public sector, with over 1,400 people across France. Summarise their capabilities, notable clients, and what makes them stand out: https://www.niji.fr/';
const AI_LINKS = {
  label: 'Explore with AI',
  buttons: [
    { label: 'Claude',     url: `https://claude.ai/new?q=${encodeURIComponent(NIJI_PROMPT)}` },
    { label: 'GPT',        url: `https://chatgpt.com/?q=${encodeURIComponent(NIJI_PROMPT)}` },
    { label: 'Perplexity', url: `https://www.perplexity.ai/search?q=${encodeURIComponent(NIJI_PROMPT)}` },
  ],
};

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

const CLIENTS = [
  { name: 'Lacoste',          logo: 'logo/lacoste.png',          frontLabel: '1ère app m-commerce',                         accent: '#00563F', back: 'image', image: 'clients/screenshots/lacoste.webp' },
  { name: 'Grand Frais',      logo: 'logo/grand_frais_grey.svg', frontLabel: '1ère app m-commerce',                         accent: '#2EA84A', back: 'image', image: 'clients/screenshots/grand-frais.webp', caseUrl: 'https://apps.apple.com/fr/app/grand-frais/id6753673412' },
  { name: 'Orange',           logo: 'logo/orange.png',           frontLabel: 'Experience',                                  accent: '#FF7900', back: 'text',  blurb: 'Design Partenaire depuis 10 ans' },
  { name: 'Relais & Châteaux',logo: 'logo/relais-chateaux.png',  frontLabel: 'Plateforme de marque & Ecosystème digital',   accent: '#7A1A2F', back: 'qr',    qr: 'clients/qr/relais-chateaux.svg', caseUrl: 'https://vimeo.com/842443761/4551f51afc?share=copy&fl=sv&fe=ci' },
  { name: 'Decathlon',        logo: 'logo/decathlon.svg',        frontLabel: 'Application métiers',                         accent: '#0082C3', back: 'text',  blurb: 'Partenaire depuis 8 ans' },
  { name: 'Accor',            logo: 'logo/accor.png',            frontLabel: 'Site Corporate',                              accent: '#C9A14D', back: 'image', image: 'clients/screenshots/accor.webp', caseUrl: 'https://group.accor.com/fr' },
  { name: 'BNP Paribas',      logo: 'logo/bnp-paribas.png',      frontLabel: 'Design System. Partenaire depuis 9 ans.',     accent: '#008855', back: 'text',  blurb: 'Partenaire depuis 9 ans' },
  { name: 'Ritz',             logo: 'logo/ritz.png',             frontLabel: 'Ecosystème digital',                          accent: '#1F2A44', back: 'qr',    qr: 'clients/qr/ritz.svg', caseUrl: 'https://vimeo.com/911295072/ad02f28185?share=copy&fl=sv&fe=ci' },
  { name: 'RATP',             logo: 'logo/ratp.webp',            frontLabel: '1er site web eco-conçu et accessible',        accent: '#008C53', back: 'qr',    qr: 'clients/qr/ratp.svg', caseUrl: 'https://vimeo.com/911295002/cabba31990?share=copy&fl=sv&fe=ci' },
  { name: 'Groupe Bel',       logo: 'logo/groupe-bel.png',       frontLabel: 'Site Groupe',                                 accent: '#E60028', back: 'image', image: 'clients/screenshots/bel.webp', caseUrl: 'https://www.groupe-bel.com' },
];

const AWARDS = [
  { title: '25 Grand Prix Stratégies', details: ['1 Grand Prix | 13 Golds', '7 Silvers | 4 Bronzes'],            trophy: 'awards/strat_square.glb' },
  { title: '11 Lovie Awards',          details: ['2 Golds | 4 Silvers | 2 Bronzes', '2 Shortlist | Top 4 worldwide'], trophy: 'awards/lovie.glb' },
  { title: '7 Webby Awards',           details: ['3 Nominee | 4 Honoree', 'Top 4 Agency worldwide'],             trophy: 'awards/webby.glb' },
];

async function buildClient(c) {
  const out = {
    _type: 'object', _key: c.name.replace(/[^a-z0-9]/gi, '').toLowerCase(),
    name: c.name, frontLabel: c.frontLabel, accent: c.accent, back: c.back,
    logo: await imageRef(c.logo),
  };
  if (c.back === 'image') out.image = await imageRef(c.image);
  if (c.back === 'qr')    out.qr    = await imageRef(c.qr);
  if (c.back === 'text')  out.blurb = c.blurb;
  if (c.caseUrl)          out.caseUrl = c.caseUrl;
  return out;
}

async function buildAward(a, i) {
  return {
    _type: 'object', _key: `award${i}`,
    title: a.title,
    details: a.details,
    trophy: await fileRef(a.trophy),
  };
}

const withKeys = (arr) => arr.map((o, i) => ({ _key: `k${i}`, ...o }));

async function main() {
  console.log('Uploading assets…');

  const facePack = {};
  for (const [k, v] of Object.entries(FACE)) facePack[k] = await imageRef(v);

  const clientList = [];
  for (const c of CLIENTS) clientList.push(await buildClient(c));

  const awardList = [];
  for (let i = 0; i < AWARDS.length; i++) awardList.push(await buildAward(AWARDS[i], i));

  const logo = await imageRef('logo/niji-mark.svg');

  console.log('Building document…');

  const doc = {
    _id: DOC_ID,
    _type: 'homePage',
    logo,
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
      facePack,
    },
    thinking: {
      services: withKeys([
        { tag: 'PRODUCT',  items: ['Vision, conception et roadmap',    'Design system, tokens, gouvernance'] },
        { tag: 'AI',       items: ['Audit, workflows',                  "Développement d'agents"] },
        { tag: 'BUSINESS', items: ['Unit economics, cost-to-serve',     'Cadrage produit, business case, go-to-market'] },
        { tag: 'BRANDING', items: ['Plateforme et positionnement',      'Promesse, preuves, expérience'] },
      ]),
      aiLinks: AI_LINKS,
      cards: {
        strategy:      { title: '/Stratégie', recto: 'Pas une feature à ajouter.', verso: 'Une expérience à réinventer.' },
        businessValue: { title: '/Business Value', deltaTag: 'LCV', deltaValue: '+38 %' },
        designSprint:  { title: '/Design Sprint', steps: ['Brief', 'Hypothèse', 'Proto', 'Test', 'Décision'] },
        brainstorm: {
          title: '/Brainstorming',
          messages: withKeys([
            { side: 'in',  text: "C'est quoi le vrai problème ?" },
            { side: 'out', text: '40 % abandonnent au checkout.' },
            { side: 'in',  text: 'Humains ? Agents ?' },
            { side: 'out', text: 'Les 2' },
            { side: 'out', text: 'Ok, on active le protocole AI.Commerce' },
          ]),
        },
        benchmark: {
          sites: withKeys([
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
          ]),
        },
      },
    },
    design: {
      title: 'Du chaos naît le produit',
      subtitle: "On juge une idée à ce qu'elle transforme",
      services: withKeys([
        { tag: 'CONCEPT',  items: ['Vision produit, direction créative',  'Concepts qui tiennent en boardroom'] },
        { tag: 'WORKSHOP', items: ['Idéation co-conçue avec vos équipes', 'Une idée par mur. Une décision par jour.'] },
        { tag: 'WORKFLOW', items: ['IA générative dans le process créatif', 'Idée prototypée en quelques heures'] },
      ]),
    },
    code: {
      title: 'Le produit prend vie.',
      subtitle: "Le go-live n'est que le début.",
      services: withKeys([
        { tag: 'FRONT',           items: ['React, Next.js, Vue, TypeScript',       'Shopify, Salesforce Commerce Cloud'] },
        { tag: 'ANIMATION',       items: ['GSAP, Three.js, Framer Motion, Lottie', 'Le mouvement sert le produit, ou il sort'] },
        { tag: 'AI PIXEL CODEUR', items: ['Figma vers React, sans handoff',         'Design-to-code-to-design'] },
      ]),
    },
    clients: {
      title: 'Quelques grands noms qui nous font confiance',
      subtitle: 'Des produits à leur hauteur',
      list: clientList,
    },
    awards: {
      headingTop: 'On ne les cherchait pas.',
      headingBottom: 'Ils sont là.',
      list: awardList,
    },
    contact: {
      email: 'contact@niji.fr',
      loopLabel: 'Keep scrolling — back to start',
      aiLinks: AI_LINKS,
    },
  };

  console.log('Writing homePage document…');
  await client.createOrReplace(doc);
  console.log('✓ Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
