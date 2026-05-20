// Singleton test document — title + hero image, editable from the Studio.
export default {
  name: 'testPage',
  title: 'Test page',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (R) => R.required(),
    },
    {
      name: 'heroImage',
      title: 'Hero image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        { name: 'alt', title: 'Alt text', type: 'string' },
      ],
    },
  ],
  preview: {
    select: { title: 'title', media: 'heroImage' },
  },
};
