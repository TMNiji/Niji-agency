// Singleton document — global site copy (title, tagline, meta description).
export default {
  name: 'siteConfig',
  title: 'Site configuration',
  type: 'document',
  fields: [
    { name: 'title', title: 'Title', type: 'string' },
    { name: 'tagline', title: 'Tagline', type: 'string' },
    { name: 'description', title: 'Description', type: 'text', rows: 3 },
  ],
};
