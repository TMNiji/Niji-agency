# Deployment Guide: GitHub → Vercel + Sanity Studio

## Overview
This project is a modern scrollytelling website with a Sanity CMS backend and Vercel hosting. The Sanity Studio allows remote editing of content without needing to run a local server.

---

## 1. GitHub Setup (✅ Already Done)

Repository: **https://github.com/TMNiji/Niji-agency**

The code is pushed and ready. All future updates:
```bash
git add .
git commit -m "Your message"
git push origin main
```

---

## 2. Sanity CMS Setup

### What's Already Configured
- **Project ID:** `kpguac1f` (in `studio/.env`)
- **Dataset:** `production`
- **Schema:** Defined in `studio/schemas/`
- **Studio:** Built with v3 structure tool + vision tool

### Access the Sanity Studio Remotely

**Option A: Deploy Studio to Sanity CDN (Recommended for Login Access)**

```bash
cd studio
npm run deploy
```

This publishes your studio to a **permanent Sanity-hosted URL** you can access from any device:

```
https://<project-id>.sanity.studio
```

**Login required** — uses your Sanity account credentials.

### Step-by-Step: First-Time Setup

1. **Verify Sanity project exists:**
   - Go to [manage.sanity.io](https://manage.sanity.io)
   - Sign in with your account
   - You should see a project called "niji-agency-v3"

2. **Generate an API token (for webhook/Vercel integration):**
   - Sanity Dashboard → Settings → API → Tokens
   - Create a new token with **Editor** role
   - Copy the token

3. **Deploy the studio to Sanity CDN:**
   ```bash
   cd studio
   npm install
   npm run deploy
   ```
   - Follow prompts to select your project
   - Studio will be live at: `https://kpguac1f.sanity.studio`

4. **Access from any device:**
   - Open `https://kpguac1f.sanity.studio` in any browser
   - Log in with your Sanity credentials
   - Start editing!

---

## 3. Vercel Setup

### Initial Deploy

1. **Connect GitHub repo to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign in / Sign up
   - Click "New Project"
   - Import your GitHub repo: `https://github.com/TMNiji/Niji-agency`
   - Vercel auto-detects Vite config from `vercel.json`
   - **Deploy**

2. **Configure Environment Variables:**
   - Project Settings → Environment Variables
   - Add these:
     ```
     SANITY_STUDIO_PROJECT_ID = kpguac1f
     SANITY_STUDIO_DATASET = production
     ```
   - Redeploy

### Auto-Rebuild on Content Changes (Webhook)

When you publish content in Sanity, Vercel automatically rebuilds the site.

**Setup:**

1. **Create Vercel Deploy Hook:**
   - Vercel Dashboard → Project → Settings → Git
   - Scroll to "Deploy Hooks"
   - Create: Name = "Sanity Publish", Branch = "main"
   - Copy the webhook URL

2. **Add webhook to Sanity:**
   - Go to [manage.sanity.io](https://manage.sanity.io)
   - Project → API → Webhooks
   - Create new webhook:
     - **URL:** (paste Vercel deploy hook URL)
     - **Trigger:** Document published
     - **Filter:** `!(_id in path("drafts.**"))`
     - **Method:** POST

3. **Test it:**
   - Edit any document in Sanity Studio
   - Publish it
   - Vercel should auto-trigger a rebuild (check Deployments tab)

---

## 4. Access from Any Laptop

### Sanity Studio (Content Editing)
- **URL:** `https://kpguac1f.sanity.studio`
- **Authentication:** Your Sanity account login
- **No local server needed** ✅

### Live Website
- **URL:** `https://niji-agency.vercel.app` (or your custom domain)
- **Auto-rebuilds** when content is published in Sanity

### Local Development (Optional)
If you want to dev locally:
```bash
npm install
npm run dev                # main site on localhost:5173
npm run studio:dev         # studio on localhost:3333
```

---

## 5. Custom Domain Setup

1. **Buy domain** (Namecheap, GoDaddy, etc.)
2. **Vercel → Project Settings → Domains**
   - Add your domain
   - Follow instructions to update DNS records

---

## 6. Schema & Content Types

Current schemas in `studio/schemas/`:
- `siteConfig.js` — Site-wide settings
- `section.js` — Page sections (hero, thinking, etc.)
- `teamMember.js` — Team profiles
- `client.js` — Client case studies
- `award.js` — Awards/recognition

Add more schemas as needed, then re-deploy:
```bash
npm run deploy
```

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| "Project not found" on deploy | Check `SANITY_STUDIO_PROJECT_ID` in `studio/.env` |
| Studio URL 404 | Run `npm run deploy` from `studio/` folder |
| Vercel rebuild doesn't trigger | Verify webhook URL and filter in Sanity settings |
| Environment vars not applied | Redeploy Vercel after adding vars |

---

## Quick Reference

| Task | Command |
|------|---------|
| Push code to GitHub | `git push origin main` |
| Deploy studio to Sanity | `cd studio && npm run deploy` |
| Local dev (site) | `npm run dev` |
| Local dev (studio) | `npm run studio:dev` |
| Build for production | `npm run build` |

---

## Next Steps

1. ✅ Push to GitHub (done)
2. ⏳ Deploy Sanity Studio: `cd studio && npm run deploy`
3. ⏳ Connect GitHub to Vercel: [vercel.com/import](https://vercel.com/import)
4. ⏳ Create Vercel deploy hook and add to Sanity webhooks
5. ✅ Access studio from anywhere: `https://kpguac1f.sanity.studio`
