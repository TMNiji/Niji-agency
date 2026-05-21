import { createClient } from '@sanity/client';

const client = createClient({
  projectId: 'kpguac1f',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

// Fetch all editable content for the home page.
// Returns null on failure — callers fall back to hardcoded defaults.
const QUERY = /* groq */ `*[_type == "homePage"][0]{
  hero {
    title,
    facePack {
      neck          { asset->{ url } },
      centerHead    { asset->{ url } },
      cheekLeft     { asset->{ url } },
      cheekRight    { asset->{ url } },
      eyeLeft       { asset->{ url } },
      eyeRight      { asset->{ url } },
      mouth         { asset->{ url } },
      foreheadLeft  { asset->{ url } },
      foreheadRight { asset->{ url } }
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
