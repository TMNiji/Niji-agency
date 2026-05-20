// Team member — name, role, optional photo. Mirrors TEAM_MEMBERS shape.
export default {
  name: 'teamMember',
  title: 'Team member',
  type: 'document',
  fields: [
    { name: 'name', title: 'Name', type: 'string', validation: (R) => R.required() },
    { name: 'role', title: 'Role', type: 'string' },
    { name: 'photo', title: 'Photo', type: 'image', options: { hotspot: true } },
  ],
  preview: {
    select: { title: 'name', subtitle: 'role', media: 'photo' },
  },
};
