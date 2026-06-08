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
| **Vercel** | Hosting / build | Project `niji-agency` (team `tmn-iji-s-projects`), domain `niji.agency` |
| **Sanity** | CMS (content) | Project `kpguac1f`, dataset `production`, Studio `https://kpguac1f.sanity.studio` |

---

## 2. Content flow (Sanity → live site) — fully automatic

The front end fetches content client-side at runtime:

- `src/lib/sanity.js` `fetch`es the `homePage` singleton from the Sanity CDN query API
  (`apicdn.sanity.io`). It's called from `src/main.js` on page load.
- `projectId` / `dataset` fall back to hardcoded `kpguac1f` / `production`, and are
  also set as Vercel env vars (`VITE_SANITY_PROJECT_ID`, `VITE_SANITY_DATASET`).
- On fetch failure (or if the CDN read loses the 1.5s boot race / a 6s hard timeout),
  each section paints from its hardcoded defaults.

**Therefore:** edit in the Studio → **Publish** → the change is live on niji.agency on
the next page load (within the CDN's short cache window, typically seconds). No Vercel
redeploy is involved. This is why there is no deploy hook.

### Editing content
- **Studio:** `https://kpguac1f.sanity.studio` — log in with your Sanity account, no local server needed.
- **Local studio dev:** `npm run studio:dev`
- **Re-deploy the Studio app** (only after schema/UI changes): `npm run studio:deploy`

---

## 3. Code flow (GitHub → Vercel) — Vercel's native Git integration

**Every push to `main` auto-deploys to production.** The Vercel project
**`niji-agency`** (team `tmn-iji-s-projects`) is connected to this GitHub repo via
Vercel's native Git integration, so a push is all it takes:

```bash
git add . && git commit -m "..." && git push origin main   # → auto-deploys
```

Vercel detects the framework (Vite), builds, and promotes to production. There is
**no GitHub Actions workflow and no `VERCEL_TOKEN` secret** — both were removed; the
native integration handles everything with no token to maintain.

> Earlier this repo used a GitHub Actions workflow with a `VERCEL_TOKEN` because the
> native integration was thought not to link cleanly across the two accounts. It does
> link (the project is owned by the Niji Vercel account, whose GitHub login matches
> `TMNiji`), so the workflow was redundant — and was deploying to the wrong (personal)
> Vercel project. It has been deleted.

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
| `git push` didn't deploy | Check the GitHub Actions run (§3); a failed/cancelled workflow won't deploy. Verify the `VERCEL_TOKEN` secret is set. As a fallback, deploy manually with `vercel --prod`. |
| `vercel git connect` fails on a public repo | Authorize the Vercel GitHub App for the `TMNiji` account in the dashboard first (§3). |
| Build can't reach Sanity | Confirm `VITE_SANITY_*` env vars (§4); code falls back to defaults otherwise. |
| Studio 404 | Run `npm run studio:deploy`. |
