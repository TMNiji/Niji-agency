// Sanity v3 Studio configuration — mounts schema bundle, plugins, project ID.
//
// Webhook setup (Sanity → Vercel rebuild on publish):
//   1. Vercel: project → Settings → Git → Deploy Hooks → create hook
//   2. Sanity: manage.sanity.io → API → Webhooks → add webhook
//        URL:     <vercel deploy hook URL>
//        Trigger: on publish, for ANY document type
//        Filter:  !(_id in path("drafts.**"))
//        Method:  POST
//   3. Optional: only fire on the production dataset.
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './schemas';

export default defineConfig({
  name: 'niji-agency-v3',
  title: 'Niji — Agence',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'kpguac1f',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
});
