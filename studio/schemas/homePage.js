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
          description: 'The nine face fragments that explode on scroll. Upload replacements here.',
          type: 'object',
          fields: [
            { name: 'neck',          title: 'Neck',           type: 'image' },
            { name: 'centerHead',    title: 'Center head',    type: 'image' },
            { name: 'cheekLeft',     title: 'Cheek left',     type: 'image' },
            { name: 'cheekRight',    title: 'Cheek right',    type: 'image' },
            { name: 'eyeLeft',       title: 'Eye left',       type: 'image' },
            { name: 'eyeRight',      title: 'Eye right',      type: 'image' },
            { name: 'mouth',         title: 'Mouth',          type: 'image' },
            { name: 'foreheadLeft',  title: 'Forehead left',  type: 'image' },
            { name: 'foreheadRight', title: 'Forehead right', type: 'image' },
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

  // Prevent editors from creating a second instance
  __experimental_actions: ['update', 'publish'],

  preview: {
    select: { title: 'hero.title' },
    prepare({ title }) {
      return { title: title ?? 'Home page' };
    },
  },
};
