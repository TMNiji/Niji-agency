// Section content — mirrors SECTIONS in src/content/config.js exactly.
export default {
  name: 'section',
  title: 'Section',
  type: 'document',
  fields: [
    {
      name: 'id',
      title: 'Section ID (slug)',
      type: 'string',
      validation: (R) => R.required().regex(/^[a-z0-9-]+$/, { name: 'kebab-case' }),
    },
    { name: 'title', title: 'Title', type: 'string' },
    { name: 'body', title: 'Body', type: 'text', rows: 4 },
    { name: 'image', title: 'Image', type: 'image', options: { hotspot: true } },
    {
      name: 'shader',
      title: 'Background shader',
      type: 'string',
      options: {
        list: [
          { title: 'Noise flow', value: 'noise_flow' },
          { title: 'Grid distort', value: 'grid_distort' },
        ],
      },
    },
    { name: 'order', title: 'Display order', type: 'number' },
  ],
  orderings: [
    { name: 'orderAsc', title: 'Order ascending', by: [{ field: 'order', direction: 'asc' }] },
  ],
  preview: {
    select: { title: 'title', subtitle: 'id' },
  },
};
