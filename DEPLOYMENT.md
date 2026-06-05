# Deployment Guide: GitHub → Vercel + Sanity

## Overview
A Vite scrollytelling site with a Sanity CMS backend, hosted on Vercel.

The single most important thing to understand:

> **Content and code travel on two completely separate paths.**
> - **Content** (Sanity) is read by the browser **at runtime** from the Sanity CDN. Publishing in the Studio is live within seconds — **no build, no deploy, nothing to push.**
> - **Code** (this repo) must be **built and deployed to Vercel** to go live.

There is **no content rebuild webhook** and you don't need one — see §2.

---

## 1. The three platforms

| Platform | Role | Coordinates |
|---|---|---|
| **GitHub** | Source of truth for code | `TMNiji/Niji-agency`, branch `main` |
| **Vercel** | Hosting / build | Project `niji-agency-v3`, domain `niji.agency` |
| **Sanity** | CMS (content) | Project `kpguac1f`, dataset `production`, Studio `https://kpguac1f.sanity.studio` |

---

## 2. Content flow (Sanity → live site) — fully automatic

The front end fetches content client-side at runtime:

- `src/lib/sanity.js` creates a `@sanity/client` with `useCdn: true` and queries the
  `homePage` singleton. It's called from `src/main.js` on page load.
- `projectId` / `dataset` fall back to hardcoded `kpguac1f` / `production`, and are
  also set as Vercel env vars (`VITE_SANITY_PROJECT_ID`, `VITE_SANITY_DATASET`).
- On fetch failure or a 2.5s timeout, each section paints from its hardcoded defaults.

**Therefore:** edit in the Studio → **Publish** → the change is live on niji.agency on
the next page load (within the CDN's short cache window, typically seconds). No Vercel
redeploy is involved. This is why there is no deploy hook.

### Editing content
- **Studio:** `https://kpguac1f.sanity.studio` — log in with your Sanity account, no local server needed.
- **Local studio dev:** `npm run studio:dev`
- **Re-deploy the Studio app** (only after schema/UI changes): `npm run studio:deploy`

---

## 3. Code flow (GitHub → Vercel) — automated via GitHub Actions

**Every push to `main` auto-deploys to production**, driven by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

```bash
git add . && git commit -m "..." && git push origin main   # → auto-deploys
```

The workflow runs `vercel pull → build → deploy --prod` using:
- repo secret **`VERCEL_TOKEN`** (a Vercel token scoped to the team),
- the project/org IDs hardcoded in the workflow env.

> We use GitHub Actions instead of Vercel's native Git integration because the
> repo (`TMNiji`) and the Vercel account's GitHub login are on different GitHub
> accounts, which the native integration couldn't link. Actions sidesteps that.

To rotate the token: create a new one at vercel.com/account/settings/tokens
(scope = team `titouan-mazuriers-projects`) and update the `VERCEL_TOKEN` secret.

### Fallback — manual CLI deploy
You can always deploy directly, bypassing CI:

```bash
vercel --prod
```

Note: `vercel --prod` builds the current working directory. Stash WIP first
(`git stash -u`), deploy, then `git stash pop` to deploy only the committed state.

---

## 4. Environment variables

Set on Vercel (Project → Settings → Environment Variables) for all environments:

```
VITE_SANITY_PROJECT_ID = kpguac1f
VITE_SANITY_DATASET     = production
```

These mirror `.env` locally. The code has fallbacks, so the build won't break if they're
missing, but keeping them set avoids silently relying on the fallback.

---

## 5. Quick reference

| Task | Command |
|------|---------|
| Edit content | `https://kpguac1f.sanity.studio` → Publish (live, no deploy) |
| Deploy code (git-connected) | `git push origin main` |
| Deploy code (manual) | `vercel --prod` |
| Re-deploy Studio (schema/UI) | `npm run studio:deploy` |
| Local dev (site) | `npm run dev` |
| Local dev (studio) | `npm run studio:dev` |

---

## 6. Troubleshooting

| Issue | Cause / fix |
|-------|-------------|
| Content edit not showing | Did you **Publish** (not just save a draft)? Hard-refresh; CDN cache is brief. |
| `git push` didn't deploy | Project isn't git-connected — use Option A above, or deploy with `vercel --prod`. |
| `vercel git connect` fails on a public repo | Authorize the Vercel GitHub App for the `TMNiji` account in the dashboard first (§3). |
| Build can't reach Sanity | Confirm `VITE_SANITY_*` env vars (§4); code falls back to defaults otherwise. |
| Studio 404 | Run `npm run studio:deploy`. |
