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

// Tight ceiling — boot awaits this fetch so anything slower than ~400ms shows
// the user a black page during the wait. If Sanity hasn't responded by then,
// fall back to the hardcoded defaults and let the page paint. (The previous
// 5s ceiling produced a ~3-4s black screen on every reload.)
export async function fetchHomePage() {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Sanity fetch timeout')), 400)
    );
    return await Promise.race([client.fetch(QUERY), timeout]);
  } catch (err) {
    console.warn('[sanity] fetch failed, using defaults:', err.message);
    return null;
  }
}
