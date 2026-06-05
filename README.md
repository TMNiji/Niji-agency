# Niji Agency V3

Scrollytelling marketing site for Niji — a single WebGL-driven page (Three.js +
GSAP + Lenis) with editable content read from Sanity at runtime.

## Stack
- **Vite** (vanilla JS, ES modules) — build + dev server
- **Three.js** — shader backdrops, hero facepack, awards trophy cloud
- **GSAP + Lenis** — animation timeline and smooth scroll
- **Sanity** — CMS; the front end `fetch`es the `homePage` singleton from the
  Sanity CDN at page load and falls back to hardcoded defaults on failure

## Commands
| | |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run studio:dev` | Run the Sanity Studio locally |
| `npm run studio:deploy` | Deploy the Studio (after schema/UI changes) |

## Content & deployment
- **Content** is edited in the Studio and goes live within seconds — no redeploy.
- **Code** auto-deploys to Vercel on every push to `main` (GitHub Actions).

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full content/code/deploy flow and
[SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) for first-time setup.
