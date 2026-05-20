# Complete Setup Guide: Niji Agency V3

## Prerequisites
- GitHub account (✅ code already pushed)
- Sanity account (free at https://sanity.io)
- Vercel account (free at https://vercel.com)

---

## Step 1: Set Up Sanity Studio for Remote Editing

### 1a. Create Sanity Project (if not done already)

Go to https://sanity.io and create a free project:
- **Name:** Niji Agency V3
- **Plan:** Free (Community)
- **Template:** Blank
- **Note down the Project ID** (visible in manage.sanity.io)

### 1b. Update Sanity Config

In your project root, update `studio/.env`:
```env
SANITY_STUDIO_PROJECT_ID=YOUR_SANITY_PROJECT_ID
SANITY_STUDIO_DATASET=production
```

Also update `studio/sanity.cli.js`:
```javascript
export default {
  api: {
    projectId: 'YOUR_SANITY_PROJECT_ID',
    dataset: 'production'
  }
}
```

### 1c. Deploy Sanity Studio to CDN

This allows you to access the studio from **any device** without running a local server:

```bash
cd studio
npm install
npm run deploy
```

You'll be prompted:
```
? Studio hostname (myproject.sanity.studio):
```

Enter something like: `niji-agency` → your studio will be at `https://niji-agency.sanity.studio`

**After deployment, you can access it from anywhere:**
- **URL:** `https://niji-agency.sanity.studio`
- **Login:** Your Sanity account email/password
- **No local server needed** ✅

---

## Step 2: Connect to Vercel

### 2a. Deploy Site to Vercel

1. Go to https://vercel.com
2. Click "New Project"
3. Import GitHub repository: `https://github.com/TMNiji/Niji-agency`
4. Vercel auto-detects Vite config
5. Add environment variables:
   - `SANITY_STUDIO_PROJECT_ID` = `YOUR_PROJECT_ID`
   - `SANITY_STUDIO_DATASET` = `production`
6. Deploy

**Your live site:** `https://your-vercel-project.vercel.app`

### 2b. Auto-Rebuild on Content Changes (Optional but Recommended)

When you publish in Sanity, Vercel automatically rebuilds your site.

**Setup webhook:**

1. **In Vercel:**
   - Project Settings → Git → Deploy Hooks
   - Create hook: Name = "Sanity Publish", Branch = "main"
   - Copy webhook URL

2. **In Sanity:**
   - https://manage.sanity.io → Your Project → API → Webhooks
   - Add new webhook:
     - **URL:** (paste Vercel hook)
     - **Events:** `Document published`
     - **Filter:** `!(_id in path("drafts.**"))`
     - **Method:** POST

---

## Step 3: Accessing Sanity Dashboard from Any Laptop

### Desktop
```
https://niji-agency.sanity.studio
```

### Laptop (any browser, anywhere)
Same URL: `https://niji-agency.sanity.studio`
- Login with your Sanity credentials
- Edit content
- Publish
- (Optional: Vercel auto-rebuilds if webhook is set up)

### Mobile (iOS/Android)
Same URL works in mobile browsers too

---

## Step 4: Local Development (Optional)

If you want to develop locally:

```bash
# Install dependencies
npm install
cd studio && npm install && cd ..

# Run main site locally
npm run dev
# Opens http://localhost:5173

# In another terminal, run Sanity Studio locally
npm run studio:dev
# Opens http://localhost:3333

# Both auto-reload on file changes
```

---

## Step 5: Custom Domain (Optional)

1. Buy a domain (Namecheap, GoDaddy, etc.)
2. In Vercel → Project Settings → Domains
3. Add your domain and follow DNS setup instructions

Example: your site at `https://niji.agency`

---

## File Structure

```
Niji Agency V3/
├── src/                  # Main site code
│   ├── main.js
│   ├── sections/        # Hero, Thinking sections
│   ├── shaders/         # WebGL shaders
│   └── styles/
├── studio/              # Sanity CMS Studio
│   ├── sanity.config.js
│   ├── sanity.cli.js
│   ├── schemas/         # Content schemas
│   └── package.json
├── public/              # Static assets (fonts, images)
├── package.json         # Main project deps
├── vercel.json          # Vercel config
└── DEPLOYMENT.md        # Detailed guide
```

---

## Environment Variables Summary

### `studio/.env`
```env
SANITY_STUDIO_PROJECT_ID=kpguac1f
SANITY_STUDIO_DATASET=production
```

### Vercel Project Settings
```
SANITY_STUDIO_PROJECT_ID=kpguac1f
SANITY_STUDIO_DATASET=production
```

---

## Workflow

1. **Edit content:** Go to `https://niji-agency.sanity.studio` → Log in → Edit
2. **Publish:** Click Publish in Sanity
3. **Live:** Website updates automatically (if webhook is set up) or within minutes

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't access Sanity studio | Make sure you deployed it: `cd studio && npm run deploy` |
| Environment vars not working | Redeploy Vercel after updating vars |
| Webhook not triggering rebuild | Check webhook URL and filter in Sanity settings |
| Port 5173 already in use | `npm run dev -- --port 5174` |

---

## Support

- **Sanity Docs:** https://www.sanity.io/docs
- **Vercel Docs:** https://vercel.com/docs
- **Vite Docs:** https://vitejs.dev

---

**You're all set!** 🎉

- **Site code:** GitHub → https://github.com/TMNiji/Niji-agency
- **CMS Studio:** https://niji-agency.sanity.studio
- **Live Site:** https://niji-agency.vercel.app
