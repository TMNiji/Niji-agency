import { createClient } from '@sanity/client';

const client = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID ?? 'kpguac1f',
  dataset: import.meta.env.VITE_SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

// Fetch all editable content for the home page.
// Returns null on failure — callers fall back to hardcoded defaults.
const QUERY = /* groq */ `*[_type == "homePage"][0]{
  hero {
    title,
    facePack {
      bgBottomRight   { asset->{ url } },
      bgTop           { asset->{ url } },
      foreheadLeftBg  { asset->{ url } },
      foreheadBgRight { asset->{ url } },
      bgBottom        { asset->{ url } },
      mouthLeft       { asset->{ url } },
      mouthRight      { asset->{ url } },
      eyeLeft         { asset->{ url } },
      earRight        { asset->{ url } },
      bottomEarRight  { asset->{ url } },
      earLeft         { asset->{ url } },
      eyeRight        { asset->{ url } }
    }
  },
  thinking {
    services[] { tag, items },
    aiLinks { label, buttons[] { label, url } }
  }
}`;

export async function fetchHomePage() {
  try {
    return await client.fetch(QUERY);
  } catch (err) {
    console.warn('[sanity] fetch failed, using defaults:', err.message);
    return null;
  }
}
