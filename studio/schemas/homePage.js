// Home page — singleton document covering every editable text and asset on the
// page. Create exactly one document of this type in the studio.
//
// The front-end (src/lib/sanity.js) reads this document and falls back to the
// hardcoded defaults baked into each section module when a field is empty, so
// the page always renders even before the document is populated.

// ── Reusable field groups ────────────────────────────────────────────────────

// A "/TAG" dropdown block (thinking + video/code service panels).
const serviceArray = (description) => ({
  name: 'services',
  title: 'Service tags',
  description,
  type: 'array',
  of: [
    {
      type: 'object',
      fields: [
        {
          name: 'tag',
          title: 'Tag name',
          description: 'Displayed as /TAG (uppercase). Opens to > TAG when clicked.',
          type: 'string',
          validation: (R) => R.required(),
        },
        {
          name: 'items',
          title: 'Sub-items',
          type: 'array',
          of: [{ type: 'string' }],
        },
      ],
      preview: { select: { title: 'tag' } },
    },
  ],
});

// "Explore with AI" link block (shared by thinking right-panel + contact).
const aiLinksObject = {
  name: 'aiLinks',
  title: 'AI links',
  description: '"Explore with AI" block. Button label drives the icon (Claude / GPT / Perplexity).',
  type: 'object',
  fields: [
    { name: 'label', title: 'Label', type: 'string' },
    {
      name: 'buttons',
      title: 'Buttons',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', title: 'Label', type: 'string', validation: (R) => R.required() },
            { name: 'url', title: 'URL', type: 'url', validation: (R) => R.required() },
          ],
          preview: { select: { title: 'label', subtitle: 'url' } },
        },
      ],
    },
  ],
};

export default {
  name: 'homePage',
  title: 'Home page',
  type: 'document',
  groups: [
    { name: 'global', title: 'Global' },
    { name: 'hero', title: 'Hero' },
    { name: 'thinking', title: 'Thinking' },
    { name: 'design', title: 'Design' },
    { name: 'code', title: 'Code' },
    { name: 'clients', title: 'Clients' },
    { name: 'awards', title: 'Awards' },
    { name: 'contact', title: 'Contact' },
  ],
  fields: [
    // ── Global ────────────────────────────────────────────────────────────────
    {
      name: 'language',
      title: 'Language',
      description: 'Which language version this document holds. One document per language (FR served at /, EN at /en).',
      type: 'string',
      options: { list: [{ title: 'Français', value: 'fr' }, { title: 'English', value: 'en' }], layout: 'radio' },
      initialValue: 'fr',
      validation: (R) => R.required(),
      group: 'global',
    },
    {
      name: 'logo',
      title: 'Header logo',
      description: 'Fixed top-left Niji mark (SVG recommended).',
      type: 'image',
      group: 'global',
    },
    {
      name: 'sectionLabels',
      title: 'Section labels (timeline ruler)',
      description: 'Vertical timeline labels, in scroll order. Leave empty to keep defaults (VISION, THINKING, DESIGN, CODE, CLIENTS, AWARDS, CONTACT).',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'global',
    },

    // ── Hero ────────────────────────────────────────────────────────────────
    {
      name: 'hero',
      title: 'Hero',
      type: 'object',
      group: 'hero',
      fields: [
        {
          name: 'title',
          title: 'Title',
          description: 'Large glitch-decoded headline. Use line breaks to control the stacked layout.',
          type: 'text',
          rows: 4,
        },
        {
          name: 'subtitle',
          title: 'Subtitle',
          description: 'Small agency descriptor under the title. One line per row.',
          type: 'text',
          rows: 5,
        },
        {
          name: 'facePack',
          title: 'Face pack images',
          description: 'The twelve face fragments that dive past the camera on scroll.',
          type: 'object',
          options: { collapsible: true, collapsed: true },
          fields: [
            { name: 'bgBottomRight', title: 'BG — bottom right', type: 'image' },
            { name: 'bgTop', title: 'BG — top', type: 'image' },
            { name: 'foreheadLeftBg', title: 'Forehead left (BG)', type: 'image' },
            { name: 'foreheadBgRight', title: 'Forehead right (BG)', type: 'image' },
            { name: 'bgBottom', title: 'BG — bottom', type: 'image' },
            { name: 'mouthLeft', title: 'Mouth — left', type: 'image' },
            { name: 'mouthRight', title: 'Mouth — right', type: 'image' },
            { name: 'eyeLeft', title: 'Eye — left', type: 'image' },
            { name: 'earRight', title: 'Ear — right', type: 'image' },
            { name: 'bottomEarRight', title: 'Bottom ear — right', type: 'image' },
            { name: 'earLeft', title: 'Ear — left', type: 'image' },
            { name: 'eyeRight', title: 'Eye — right', type: 'image' },
          ],
        },
      ],
    },

    // ── Thinking ──────────────────────────────────────────────────────────────
    {
      name: 'thinking',
      title: 'Thinking',
      type: 'object',
      group: 'thinking',
      fields: [
        serviceArray('Right-side dropdown list for the Thinking section. Order matters.'),
        aiLinksObject,
        {
          name: 'cards',
          title: 'Orbital cards',
          description: 'The five cards opened by the orbital dots.',
          type: 'object',
          options: { collapsible: true, collapsed: true },
          fields: [
            {
              name: 'strategy',
              title: 'Card 1 — Stratégie (flip card)',
              type: 'object',
              fields: [
                { name: 'title', title: 'Card title', type: 'string' },
                { name: 'recto', title: 'Recto text', type: 'string' },
                { name: 'verso', title: 'Verso text', type: 'string' },
              ],
            },
            {
              name: 'businessValue',
              title: 'Card 2 — Business Value (graph)',
              type: 'object',
              fields: [
                { name: 'title', title: 'Card title', type: 'string' },
                { name: 'deltaTag', title: 'Delta tag', description: 'e.g. "LCV"', type: 'string' },
                { name: 'deltaValue', title: 'Delta value', description: 'e.g. "+38 %"', type: 'string' },
              ],
            },
            {
              name: 'designSprint',
              title: 'Card 3 — Design Sprint (checklist)',
              type: 'object',
              fields: [
                { name: 'title', title: 'Card title', type: 'string' },
                { name: 'steps', title: 'Steps', type: 'array', of: [{ type: 'string' }] },
              ],
            },
            {
              name: 'brainstorm',
              title: 'Card 4 — Brainstorming (chat)',
              type: 'object',
              fields: [
                { name: 'title', title: 'Card title', type: 'string' },
                {
                  name: 'messages',
                  title: 'Messages',
                  type: 'array',
                  of: [
                    {
                      type: 'object',
                      fields: [
                        {
                          name: 'side',
                          title: 'Side',
                          type: 'string',
                          options: { list: [{ title: 'Incoming (left)', value: 'in' }, { title: 'Outgoing (right)', value: 'out' }] },
                          validation: (R) => R.required(),
                        },
                        { name: 'text', title: 'Text', type: 'string', validation: (R) => R.required() },
                      ],
                      preview: { select: { title: 'text', subtitle: 'side' } },
                    },
                  ],
                },
              ],
            },
            {
              name: 'benchmark',
              title: 'Card 5 — Benchmark (browser windows)',
              type: 'object',
              fields: [
                {
                  name: 'sites',
                  title: 'Sites',
                  description: 'Five are picked at random per open.',
                  type: 'array',
                  of: [
                    {
                      type: 'object',
                      fields: [
                        { name: 'url', title: 'URL label', type: 'string', validation: (R) => R.required() },
                        { name: 'accent', title: 'Accent color', description: 'Hex, e.g. #635bff', type: 'string' },
                      ],
                      preview: { select: { title: 'url', subtitle: 'accent' } },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Design (video, frames 1-160) ────────────────────────────────────────
    {
      name: 'design',
      title: 'Design',
      type: 'object',
      group: 'design',
      fields: [
        { name: 'title', title: 'Title (small lead-in)', type: 'string' },
        { name: 'subtitle', title: 'Subtitle (large line)', type: 'string' },
        serviceArray('Service dropdowns for the Design section.'),
      ],
    },

    // ── Code (video, frames 161-end) ────────────────────────────────────────
    {
      name: 'code',
      title: 'Code',
      type: 'object',
      group: 'code',
      fields: [
        { name: 'title', title: 'Title (small lead-in)', type: 'string' },
        { name: 'subtitle', title: 'Subtitle (large line)', type: 'string' },
        serviceArray('Service dropdowns for the Code section.'),
      ],
    },

    // ── Clients ──────────────────────────────────────────────────────────────
    {
      name: 'clients',
      title: 'Clients',
      type: 'object',
      group: 'clients',
      fields: [
        { name: 'title', title: 'Title (small line)', type: 'string' },
        { name: 'subtitle', title: 'Subtitle (large line)', type: 'string' },
        {
          name: 'list',
          title: 'Client cards',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                { name: 'name', title: 'Brand name', type: 'string', validation: (R) => R.required() },
                { name: 'logo', title: 'Logo', type: 'image' },
                { name: 'frontLabel', title: 'Front label', description: 'Project / engagement text under the logo', type: 'string' },
                { name: 'accent', title: 'Accent color', description: 'Brand hex, e.g. #00563F', type: 'string' },
                {
                  name: 'back',
                  title: 'Back face type',
                  type: 'string',
                  options: { list: [
                    { title: 'Screenshot image', value: 'image' },
                    { title: 'QR code', value: 'qr' },
                    { title: 'Text blurb', value: 'text' },
                  ] },
                  validation: (R) => R.required(),
                },
                { name: 'image', title: 'Screenshot (back: image)', type: 'image', hidden: ({ parent }) => parent?.back !== 'image' },
                { name: 'qr', title: 'QR code (back: qr)', type: 'image', hidden: ({ parent }) => parent?.back !== 'qr' },
                { name: 'blurb', title: 'Blurb (back: text)', type: 'string', hidden: ({ parent }) => parent?.back !== 'text' },
                { name: 'caseUrl', title: 'Case-study URL', description: 'Opened by the "Voir le case study" button (image / QR backs).', type: 'url' },
              ],
              preview: { select: { title: 'name', subtitle: 'frontLabel', media: 'logo' } },
            },
          ],
        },
      ],
    },

    // ── Awards ────────────────────────────────────────────────────────────────
    {
      name: 'awards',
      title: 'Awards',
      type: 'object',
      group: 'awards',
      fields: [
        { name: 'headingTop', title: 'Heading — top (small line)', type: 'string' },
        { name: 'headingBottom', title: 'Heading — bottom (large line)', type: 'string' },
        {
          name: 'list',
          title: 'Awards',
          description: 'One per trophy. Order matches the trophy cloud.',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                { name: 'title', title: 'Title', type: 'string', validation: (R) => R.required() },
                { name: 'details', title: 'Detail lines', description: 'Two lines shown in the tooltip.', type: 'array', of: [{ type: 'string' }] },
                { name: 'trophy', title: 'Trophy model (.glb)', type: 'file', options: { accept: '.glb,model/gltf-binary' } },
              ],
              preview: { select: { title: 'title' } },
            },
          ],
        },
      ],
    },

    // ── Contact ──────────────────────────────────────────────────────────────
    {
      name: 'contact',
      title: 'Contact',
      type: 'object',
      group: 'contact',
      fields: [
        {
          name: 'headline',
          title: 'Headline',
          description: 'Glitching headline (array of lines for stacking).',
          type: 'array',
          of: [{ type: 'string' }],
        },
        {
          name: 'contacts',
          title: 'Named contacts',
          description: 'Contact entries with topic line and mailto address.',
          type: 'array',
          of: [
            {
              type: 'object',
              name: 'contactEntry',
              fields: [
                { name: 'topic', title: 'Topic', type: 'string', validation: (R) => R.required() },
                { name: 'email', title: 'Email', type: 'string', validation: (R) => R.required() },
              ],
              preview: { select: { title: 'topic', subtitle: 'email' } },
            },
          ],
        },
        { name: 'loopLabel', title: 'Loop CTA label', description: 'Bottom-centre "back to start" hint.', type: 'string' },
        aiLinksObject,
      ],
    },
  ],

  preview: {
    select: { title: 'hero.title', language: 'language' },
    prepare({ title, language }) {
      const lang = (language ?? 'fr').toUpperCase();
      return { title: `[${lang}] ${(title ?? 'Home page').split('\n')[0]}` };
    },
  },
};
