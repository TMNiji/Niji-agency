// The home page does exactly one public, CDN-cached GROQ read, so we hit the
// Sanity query API directly with fetch instead of pulling in @sanity/client
// (~33KB gzip on the first-paint critical path). The write side
// (scripts/populate-sanity.mjs) still uses the client — it needs auth + uploads.
const PROJECT_ID = import.meta.env.VITE_SANITY_PROJECT_ID ?? 'kpguac1f';
const DATASET    = import.meta.env.VITE_SANITY_DATASET ?? 'production';
const API_VERSION = '2024-01-01';
// apicdn.* is the CDN-backed (cached) host — matches the old useCdn: true.
const QUERY_URL = (groq) =>
  `https://${PROJECT_ID}.apicdn.sanity.io/v${API_VERSION}/data/query/${DATASET}?query=${encodeURIComponent(groq)}`;

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
// section. The ceiling has to clear the SLOW tail, not the median: a 400ms
// then a 2500ms cap both still lost the race on cold/throttled loads and
// silently discarded every CMS edit. 6s gives the CDN room to win even on a
// bad connection; only a genuinely dead network now falls back to defaults.
const TIMEOUT_MS = 6000;

export async function fetchHomePage() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(QUERY_URL(QUERY), { signal: controller.signal });
    if (!res.ok) throw new Error(`Sanity query HTTP ${res.status}`);
    const { result } = await res.json();
    return result ?? null;
  } catch (err) {
    console.warn('[sanity] fetch failed, using defaults:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
