// Home page — singleton document covering every editable text and asset on
// the page. Create exactly one document of this type in the studio.
export default {
  name: 'homePage',
  title: 'Home page',
  type: 'document',
  fields: [
    // ── Hero ─────────────────────────────────────────────────────────────────
    {
      name: 'hero',
      title: 'Hero',
      type: 'object',
      fields: [
        {
          name: 'title',
          title: 'Title',
          description: 'The large glitch-decoded headline (e.g. "We make products for humans and agents")',
          type: 'string',
        },
        {
          name: 'facePack',
          title: 'Face pack images',
          description: 'The twelve face fragments that dive past the camera on scroll. Upload replacements here.',
          type: 'object',
          fields: [
            { name: 'bgBottomRight',   title: 'BG — bottom right',   type: 'image' },
            { name: 'bgTop',           title: 'BG — top',            type: 'image' },
            { name: 'foreheadLeftBg',  title: 'Forehead left (BG)',  type: 'image' },
            { name: 'foreheadBgRight', title: 'Forehead right (BG)', type: 'image' },
            { name: 'bgBottom',        title: 'BG — bottom',         type: 'image' },
            { name: 'mouthLeft',       title: 'Mouth — left',        type: 'image' },
            { name: 'mouthRight',      title: 'Mouth — right',       type: 'image' },
            { name: 'eyeLeft',         title: 'Eye — left',          type: 'image' },
            { name: 'earRight',        title: 'Ear — right',         type: 'image' },
            { name: 'bottomEarRight',  title: 'Bottom ear — right',  type: 'image' },
            { name: 'earLeft',         title: 'Ear — left',          type: 'image' },
            { name: 'eyeRight',        title: 'Eye — right',         type: 'image' },
          ],
        },
      ],
    },

    // ── Thinking ──────────────────────────────────────────────────────────────
    {
      name: 'thinking',
      title: 'Thinking',
      type: 'object',
      fields: [
        {
          name: 'services',
          title: 'Service tags',
          description: 'Right-side dropdown list. Order matters.',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                {
                  name: 'tag',
                  title: 'Tag name',
                  description: 'Displayed as /TAG or >TAG (uppercase)',
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
        },
        {
          name: 'aiLinks',
          title: 'AI links',
          description: '"Explore with AI" block in the bottom-right corner.',
          type: 'object',
          fields: [
            {
              name: 'label',
              title: 'Label',
              description: 'Small uppercase label above the buttons',
              type: 'string',
            },
            {
              name: 'buttons',
              title: 'Buttons',
              type: 'array',
              of: [
                {
                  type: 'object',
                  fields: [
                    { name: 'label', title: 'Label', type: 'string', validation: (R) => R.required() },
                    { name: 'url',   title: 'URL',   type: 'url',    validation: (R) => R.required() },
                  ],
                  preview: { select: { title: 'label', subtitle: 'url' } },
                },
              ],
            },
          ],
        },
      ],
    },
  ],

  preview: {
    select: { title: 'hero.title' },
    prepare({ title }) {
      return { title: title ?? 'Home page' };
    },
  },
};
