// Client logo entry — name + uploaded logo. Mirrors CLIENTS shape in config.js.
export default {
  name: 'client',
  title: 'Client',
  type: 'document',
  fields: [
    { name: 'name', title: 'Name', type: 'string', validation: (R) => R.required() },
    { name: 'logo', title: 'Logo', type: 'image' },
  ],
  preview: {
    select: { title: 'name', media: 'logo' },
  },
};
