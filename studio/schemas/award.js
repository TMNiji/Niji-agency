// Award entry — title, year, category. Mirrors AWARDS shape in config.js.
export default {
  name: 'award',
  title: 'Award',
  type: 'document',
  fields: [
    { name: 'title', title: 'Title', type: 'string', validation: (R) => R.required() },
    { name: 'year', title: 'Year', type: 'number' },
    { name: 'category', title: 'Category', type: 'string' },
  ],
  preview: {
    select: { title: 'title', subtitle: 'year' },
  },
};
