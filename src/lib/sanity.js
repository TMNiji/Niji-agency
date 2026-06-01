import { createClient } from '@sanity/client';

const client = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID ?? 'kpguac1f',
  dataset: import.meta.env.VITE_SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

// Fetch all editable content for the home page.
// Returns null on failure — callers fall back to hardcoded defaults.
const IMG = '{ asset->{ url } }';

const QUERY = /* groq */ `*[_type == "homePage"][0]{
  logo ${IMG},
  sectionLabels,
  hero {
    title,
    subtitle,
    facePack {
      bgBottomRight   ${IMG},
      bgTop           ${IMG},
      foreheadLeftBg  ${IMG},
      foreheadBgRight ${IMG},
      bgBottom        ${IMG},
      mouthLeft       ${IMG},
      mouthRight      ${IMG},
      eyeLeft         ${IMG},
      earRight        ${IMG},
      bottomEarRight  ${IMG},
      earLeft         ${IMG},
      eyeRight        ${IMG}
    }
  },
  thinking {
    services[] { tag, items },
    aiLinks { label, buttons[] { label, url } },
    cards {
      strategy { title, recto, verso },
      businessValue { title, deltaTag, deltaValue },
      designSprint { title, steps },
      brainstorm { title, messages[] { side, text } },
      benchmark { sites[] { url, accent } }
    }
  },
  design { title, subtitle, services[] { tag, items } },
  code   { title, subtitle, services[] { tag, items } },
  clients {
    title,
    subtitle,
    list[] {
      name,
      frontLabel,
      accent,
      back,
      blurb,
      caseUrl,
      logo  ${IMG},
      image ${IMG},
      qr    ${IMG}
    }
  },
  awards {
    headingTop,
    headingBottom,
    list[] { title, details, trophy { asset->{ url } } }
  },
  contact {
    email,
    loopLabel,
    aiLinks { label, buttons[] { label, url } }
  }
}`;

// CDN-backed read — typically resolves in well under a second. We still race a
// timeout so a network stall can't hold the (WebGL-heavy) boot indefinitely;
// on timeout the page paints with the hardcoded defaults baked into each
// section. Kept generous enough that a normal CDN response always wins (the
// previous 400ms ceiling lost the race on cold loads, silently discarding
// every CMS edit).
const TIMEOUT_MS = 2500;

export async function fetchHomePage() {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Sanity fetch timeout')), TIMEOUT_MS)
    );
    return await Promise.race([client.fetch(QUERY), timeout]);
  } catch (err) {
    console.warn('[sanity] fetch failed, using defaults:', err.message);
    return null;
  }
}
