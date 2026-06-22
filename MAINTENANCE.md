# Niji Agency — Guide de maintenance / Maintenance Guide

> 🇫🇷 **Version française ci-dessous.** &nbsp;•&nbsp; 🇬🇧 **English version below the French one.**
>
> Ce document est le guide de passation du site **niji.agency**. Il explique comment
> le site fonctionne, comment modifier le contenu, comment déployer du code, et qui a
> accès à quoi.

---
---

# 🇫🇷 GUIDE (Français)

## 0. Accès & rôles

Le site repose sur **trois plateformes**. Voici qui doit avoir accès à quoi.

| Rôle | GitHub | Vercel | Sanity |
|---|---|---|---|
| **Éditeur de contenu** (textes, images) | — | — | ✅ Editor/Admin |
| **Développeur** (modifie le code) | ✅ Write | ✅ recommandé | ✅ utile |
| **Mainteneur / responsable** | ✅ Admin | ✅ **indispensable** | ✅ Admin |

**Point important sur le déploiement :** un accès **Write sur GitHub suffit pour
déclencher une mise en production**. Vercel se redéploie automatiquement à chaque push
sur `main` via un webhook lié au **dépôt**, pas à la personne — **inutile d'avoir un
compte Vercel pour que le déploiement parte.**

> ⚠️ **Mais** sans accès Vercel, on ne peut **ni voir si le build a réussi ou échoué**,
> ni **lire les logs d'erreur**, ni **revenir en arrière (rollback)**, ni changer les
> variables d'environnement. Risque concret : quelqu'un pousse un commit qui casse le
> build → le site reste silencieusement sur l'ancienne version, sans visibilité sur la
> cause. **Au moins une personne technique doit donc avoir accès au projet Vercel
> `niji-agency`.**

### Accès actuels (à jour 2026-06-22)

**GitHub** — dépôt `TMNiji/Niji-agency`, branche `main` **non protégée** (push direct
autorisé) :

| Utilisateur GitHub | Rôle | Peut pousser sur `main` |
|---|---|---|
| `TMNiji` | Admin | ✅ |
| `Rereuil` | Write | ✅ |
| `YCO-2026` | Write | ✅ |
| `Melissa-el-H` | Write | ✅ |

**Sanity (CMS)** — peuvent éditer et publier le contenu depuis le Studio : Yv Corbeil,
Nicolas Prudhomme, Cindy Soares (+ les invitations précédentes). ⚠️ Vérifiez qu'au moins
**une** de ces personnes a le rôle **Administrator** (et pas seulement Editor) afin de
pouvoir gérer les membres, les CORS et le projet — sur `manage.sanity.io` → projet
**N Agency** → *Members*.

Gestion des accès : **Sanity** → `manage.sanity.io` → *Members* ; **Vercel** → équipe
`tmn-iji-s-projects` → *Members* ; **GitHub** → `TMNiji/Niji-agency` → *Settings →
Collaborators*.

---

## 1. Vue d'ensemble — comment le site est fait

`niji.agency` est un site **vitrine en une seule page** (scrollytelling), avec des
animations WebGL. Le contenu (textes, images) est **éditable sans toucher au code**,
via le CMS Sanity.

**La chose la plus importante à comprendre :**

> **Le contenu et le code voyagent par deux chemins totalement séparés.**
> - **Le contenu** (Sanity) est lu par le navigateur **en direct** depuis le CDN Sanity. Publier dans le Studio = **en ligne en quelques secondes, sans rien déployer.**
> - **Le code** (ce dépôt) doit être **déployé sur Vercel** pour être mis en ligne (un simple `git push` suffit).

### Pages du site
| URL | Contenu |
|---|---|
| `/` | Site en **français** (page d'accueil) |
| `/en` | Site en **anglais** |
| `/iris` | Agent vocal IA « Iris » (démo, utilise l'API Google Gemini) |

### Technologies (pour info)
- **Vite** (JavaScript, sans framework) — build & serveur de dev
- **Three.js** — animations WebGL (fond, visage du hero, trophées)
- **GSAP + Lenis** — timeline d'animation & scroll fluide
- **Sanity** — CMS (le front lit le document `homePage` au chargement)

---

## 2. Modifier le contenu (le cas le plus fréquent) — Sanity

C'est ce que vous ferez 95 % du temps. **Aucune compétence technique requise, aucun
déploiement.**

1. Aller sur le **Studio Sanity** : **https://niji-agency-website.sanity.studio/**
2. Se connecter avec son compte Sanity (voir section 0 pour être invité).
3. Ouvrir le document **Home page**. ⚠️ Il y en a **deux** : un en **Français**, un en
   **Anglais** (champ *Language* en haut). Modifiez celui qui correspond à la langue du site.
4. Éditer les textes / images. Les sections suivent la structure du site : *Hero,
   Thinking, Design, Code, Clients, Awards, Contact*, plus les *Service tags* et *AI links*.
5. Cliquer sur **Publish** (en bas à droite).
6. ✅ Le changement est **en ligne en quelques secondes** sur niji.agency, au prochain
   rechargement de page. **Rien d'autre à faire.**

> ⚠️ **Piège classique :** « Save » crée un brouillon, ça ne suffit pas. Il faut
> **Publish** pour que ce soit visible publiquement.

> 💡 Si une modif n'apparaît pas : avez-vous bien **publié** ? Faites un
> rechargement forcé (le cache du CDN est très court).

Le Studio fonctionne **depuis n'importe quel navigateur, sur n'importe quel appareil**
(ordinateur, mobile) — aucun logiciel à installer.

### 🤖 Modifier le contenu Sanity directement via Claude
Le projet est connecté à Sanity via le **MCP Sanity** dans Claude Code. On peut donc
demander à Claude d'agir directement sur le contenu, en langage naturel, par ex. :
- « Lis le contenu actuel de la page d'accueil (FR / EN) »
- « Change le titre du hero par … »
- « Ajoute un client dans la section Clients »
- « Publie les modifications »

Claude interroge (GROQ), modifie (patch / create) et publie les documents `homePage`,
et peut aussi lire ou mettre à jour le schéma. **À utiliser avec prudence :** demandez
toujours à Claude de vous **montrer le contenu avant/après** et **vérifiez le rendu sur
le site** après publication (le changement est live en quelques secondes, comme depuis
le Studio). Pour de l'édition simple au quotidien, le Studio (ci-dessus) reste le plus
direct.

---

## 3. Modifier le code & déployer — GitHub → Vercel

À ne faire que pour changer le **fonctionnement** du site (animations, structure,
nouvelles sections…), pas pour le contenu.

### La règle d'or du déploiement
> **Chaque `git push` sur la branche `main` déclenche automatiquement une mise en
> production sur Vercel.** C'est le **seul** chemin de déploiement officiel.

```bash
git add .
git commit -m "Description du changement"
git push origin main      # → Vercel build & met en ligne automatiquement (~1 min)
```

Vercel détecte le framework (Vite), compile, et publie sur `niji.agency`. Il n'y a
**ni GitHub Actions, ni token à maintenir** : c'est l'intégration Git native de Vercel.

### ✅ Toujours tester AVANT de pousser sur `main`
> **Ne poussez jamais directement sur `main` sans avoir vérifié votre changement.**
> Un push sur `main` part **immédiatement en production** sur niji.agency. Vérifiez
> d'abord par **l'une de ces deux méthodes :**

1. **En local** — lancez `npm run dev` (→ http://localhost:5173) et contrôlez votre
   changement dans le navigateur (testez aussi `/en` et `/iris` si vous y avez touché).
   Pour être au plus près de la prod : `npm run build` puis `npm run preview`.
2. **Sur une branche de test (recommandé pour les gros changements)** — travaillez sur
   une branche dédiée, pas sur `main` :
   ```bash
   git checkout -b ma-modif
   git push origin ma-modif        # → Vercel crée une URL de PREVIEW automatique
   ```
   Vercel génère une **URL de prévisualisation** (visible dans le dashboard / sur la
   Pull Request) qui montre le site exactement comme il sera en prod, **sans toucher
   à niji.agency.** Une fois validé, ouvrez une Pull Request vers `main` (ou mergez) →
   c'est seulement à ce moment que ça part en production.

> 💡 Règle simple : **local pour les petites retouches, branche de test + preview pour
> tout changement visible ou risqué.** On ne « teste » jamais en production.

### ⚠️ Piège important (machine actuelle)
> **N'utilisez PAS `vercel --prod` depuis ce projet en local.** La config locale
> `.vercel/` pointe vers un **ancien projet personnel orphelin** (sans domaine).
> `vercel --prod` déploierait là-bas et **ne changerait RIEN** sur niji.agency.
>
> Sur une nouvelle machine, faites `vercel link` et reliez explicitement le projet
> **`niji-agency`** de l'équipe **`tmn-iji-s-projects`** avant toute commande Vercel CLI.
> Mais dans tous les cas, **le `git push` suffit** — c'est la méthode recommandée.

---

## 4. Développement en local (optionnel)

Pour tester des changements de code avant de les pousser :

```bash
# Installer les dépendances (une seule fois)
npm install
npm --prefix studio install

# Lancer le site en local
npm run dev          # → http://localhost:5173

# (Optionnel) lancer le Studio Sanity en local
npm run studio:dev   # → http://localhost:3333
```

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de dev local du site |
| `npm run build` | Build de production → dossier `dist/` |
| `npm run preview` | Sert le build de production en local |
| `npm run studio:dev` | Lance le Studio Sanity en local |
| `npm run studio:deploy` | Redéploie le Studio (voir §5) |

---

## 5. Cas particulier — changer la STRUCTURE du contenu (schéma Sanity)

Si vous voulez **ajouter / supprimer un champ** dans le CMS (pas juste son contenu),
il faut modifier le schéma puis redéployer le Studio.

1. Éditer `studio/schemas/homePage.js` (définition des champs).
2. Adapter la requête de lecture côté front dans `src/lib/sanity.js` (GROQ) pour lire
   le nouveau champ, et l'utiliser dans la section concernée.
3. Redéployer le Studio :
   ```bash
   npm run studio:deploy      # déploie l'app d'édition
   ```
   (Pour ne déployer que le schéma : `cd studio && npx sanity schema deploy`.)
4. Pousser le code front (§3).

> Réservé à un profil technique. Pour du contenu simple, restez sur la §2.

---

## 6. Variables d'environnement

Définies dans **Vercel → Project Settings → Environment Variables** :

| Variable | Valeur | Rôle |
|---|---|---|
| `VITE_SANITY_PROJECT_ID` | `kpguac1f` | ID du projet Sanity (lecture du contenu) |
| `VITE_SANITY_DATASET` | `production` | Dataset Sanity |
| `GEMINI_API_KEY` | *(secret)* | Clé Google Gemini pour la page `/iris` — **côté serveur uniquement**, ne doit jamais arriver dans le navigateur |

Les `VITE_*` ont des valeurs de repli codées en dur, donc le build ne casse pas si
elles manquent — mais gardez-les définies. Localement, elles sont dans `.env`
(voir `.env.example` pour le modèle).

---

## 7. Coordonnées des plateformes (récapitulatif)

| Plateforme | Coordonnées |
|---|---|
| **Code (GitHub)** | `TMNiji/Niji-agency`, branche `main` |
| **Hébergement (Vercel)** | Projet `niji-agency`, équipe `tmn-iji-s-projects` |
| **Domaine** | `niji.agency` (apex) + `www.niji.agency` (redirige vers l'apex). Registrar : **Gandi**. DNS `A → 76.76.21.21` |
| **CMS (Sanity)** | Projet `kpguac1f` (« N Agency »), dataset `production` |
| **Studio Sanity** | https://niji-agency-website.sanity.studio/ |
| **Page Iris** | `/iris` — utilise l'API Google Gemini via `api/iris-token.js` & `api/iris-chat.js` |

---

## 8. Dépannage rapide

| Problème | Cause / Solution |
|---|---|
| Une modif de contenu n'apparaît pas | Avez-vous cliqué **Publish** (pas juste sauvegardé un brouillon) ? Rechargement forcé. |
| `git push` ne met pas à jour le site | Vérifier le déploiement dans le dashboard Vercel (équipe `tmn-iji-s-projects`, projet `niji-agency`). Le build a-t-il échoué ? |
| `vercel --prod` « réussit » mais le site ne change pas | Normal : la config locale pointe vers l'ancien projet orphelin. Utiliser `git push` (§3). |
| Studio en 404 | Redéployer : `npm run studio:deploy`. |
| Le site n'arrive pas à lire Sanity | Vérifier les variables `VITE_SANITY_*` (§6). Le site bascule alors sur des valeurs par défaut codées en dur. |
| La page `/iris` ne répond pas | Vérifier `GEMINI_API_KEY` sur Vercel (Production + Preview) et le quota du compte Google AI Studio. |
| Port 5173 déjà utilisé | `npm run dev -- --port 5174` |

---
---

# 🇬🇧 GUIDE (English)

## 0. Access & roles

The site runs on **three platforms**. Here is who should have access to what.

| Role | GitHub | Vercel | Sanity |
|---|---|---|---|
| **Content editor** (text, images) | — | — | ✅ Editor/Admin |
| **Developer** (edits code) | ✅ Write | ✅ recommended | ✅ useful |
| **Maintainer / owner** | ✅ Admin | ✅ **essential** | ✅ Admin |

**Key point about deployment:** **GitHub Write access is enough to trigger a production
deploy.** Vercel auto-deploys on every push to `main` via a webhook tied to the
**repository**, not to the person — **no Vercel account is needed for the deploy to
fire.**

> ⚠️ **However**, without Vercel access you **cannot see whether the build succeeded or
> failed**, **read error logs**, **roll back**, or change environment variables. Concrete
> risk: someone pushes a commit that breaks the build → the live site silently stays on
> the old version, with no visibility into why. **So at least one technical person must
> have access to the Vercel `niji-agency` project.**

### Current access (as of 2026-06-22)

**GitHub** — repo `TMNiji/Niji-agency`, branch `main` **not protected** (direct push
allowed):

| GitHub user | Role | Can push to `main` |
|---|---|---|
| `TMNiji` | Admin | ✅ |
| `Rereuil` | Write | ✅ |
| `YCO-2026` | Write | ✅ |
| `Melissa-el-H` | Write | ✅ |

**Sanity (CMS)** — can edit and publish content from the Studio: Yv Corbeil, Nicolas
Prudhomme, Cindy Soares (plus earlier invites). ⚠️ Make sure at least **one** of them
has the **Administrator** role (not just Editor) so they can manage members, CORS, and
the project — at `manage.sanity.io` → project **N Agency** → *Members*.

Managing access: **Sanity** → `manage.sanity.io` → *Members*; **Vercel** → team
`tmn-iji-s-projects` → *Members*; **GitHub** → `TMNiji/Niji-agency` → *Settings →
Collaborators*.

---

## 1. Overview — how the site is built

`niji.agency` is a **single-page marketing site** (scrollytelling) with WebGL
animations. The content (text, images) is **editable without touching the code**, via
the Sanity CMS.

**The single most important thing to understand:**

> **Content and code travel on two completely separate paths.**
> - **Content** (Sanity) is read by the browser **at runtime** from the Sanity CDN. Publishing in the Studio is **live within seconds — nothing to deploy.**
> - **Code** (this repo) must be **deployed to Vercel** to go live (a simple `git push` does it).

### Site pages
| URL | Content |
|---|---|
| `/` | **French** site (homepage) |
| `/en` | **English** site |
| `/iris` | "Iris" AI voice agent (demo, uses the Google Gemini API) |

### Tech stack (for reference)
- **Vite** (vanilla JavaScript, no framework) — build & dev server
- **Three.js** — WebGL animations (backdrop, hero face, awards trophies)
- **GSAP + Lenis** — animation timeline & smooth scroll
- **Sanity** — CMS (the front end reads the `homePage` document on load)

---

## 2. Editing content (the most common case) — Sanity

This is what you'll do 95% of the time. **No technical skills required, no deployment.**

1. Go to the **Sanity Studio**: **https://niji-agency-website.sanity.studio/**
2. Log in with your Sanity account (see section 0 to get invited).
3. Open the **Home page** document. ⚠️ There are **two** of them: one in **French**, one
   in **English** (the *Language* field at the top). Edit the one matching the site language.
4. Edit the text / images. Sections follow the site structure: *Hero, Thinking, Design,
   Code, Clients, Awards, Contact*, plus *Service tags* and *AI links*.
5. Click **Publish** (bottom right).
6. ✅ The change is **live within seconds** on niji.agency, on the next page load.
   **Nothing else to do.**

> ⚠️ **Common pitfall:** "Save" creates a draft, which is not enough. You must
> **Publish** for it to be publicly visible.

> 💡 If a change doesn't show up: did you **Publish**? Do a hard refresh (the CDN
> cache window is very short).

The Studio works **from any browser, on any device** (computer, mobile) — nothing to
install.

### 🤖 Editing Sanity content directly via Claude
The project is connected to Sanity through the **Sanity MCP** in Claude Code, so you
can ask Claude to act on the content directly, in plain language, e.g.:
- "Read the current homepage content (FR / EN)"
- "Change the hero title to …"
- "Add a client to the Clients section"
- "Publish the changes"

Claude queries (GROQ), edits (patch / create) and publishes the `homePage` documents,
and can also read or update the schema. **Use with care:** always ask Claude to **show
you the before/after content** and **check the result on the live site** after
publishing (the change is live within seconds, just like from the Studio). For simple
day-to-day edits, the Studio (above) is still the most direct route.

---

## 3. Editing code & deploying — GitHub → Vercel

Only needed to change how the site **works** (animations, structure, new sections…),
not for content.

### The golden rule of deployment
> **Every `git push` to the `main` branch automatically triggers a production
> deployment on Vercel.** This is the **only** official deploy path.

```bash
git add .
git commit -m "Description of the change"
git push origin main      # → Vercel builds & goes live automatically (~1 min)
```

Vercel detects the framework (Vite), builds, and publishes to `niji.agency`. There are
**no GitHub Actions and no token to maintain** — it's Vercel's native Git integration.

### ✅ Always test BEFORE pushing to `main`
> **Never push straight to `main` without checking your change first.** A push to
> `main` goes **live in production** on niji.agency immediately. Verify first using
> **one of these two methods:**

1. **Locally** — run `npm run dev` (→ http://localhost:5173) and check your change in
   the browser (also test `/en` and `/iris` if you touched them). To match production
   most closely: `npm run build` then `npm run preview`.
2. **On a test branch (recommended for bigger changes)** — work on a dedicated branch,
   not on `main`:
   ```bash
   git checkout -b my-change
   git push origin my-change       # → Vercel auto-creates a PREVIEW URL
   ```
   Vercel generates a **preview URL** (shown in the dashboard / on the Pull Request)
   that shows the site exactly as it will be in production, **without touching
   niji.agency.** Once validated, open a Pull Request to `main` (or merge) → only then
   does it go to production.

> 💡 Simple rule: **local for small tweaks, test branch + preview for anything visible
> or risky.** Never "test" in production.

### ⚠️ Important pitfall (current machine)
> **Do NOT use `vercel --prod` from this project locally.** The local `.vercel/`
> config points to an **old orphaned personal project** (with no domain).
> `vercel --prod` would deploy there and change **NOTHING** on niji.agency.
>
> On a new machine, run `vercel link` and explicitly connect the **`niji-agency`**
> project under the **`tmn-iji-s-projects`** team before any Vercel CLI command. But in
> all cases, **`git push` is enough** — it's the recommended method.

---

## 4. Local development (optional)

To test code changes before pushing:

```bash
# Install dependencies (once)
npm install
npm --prefix studio install

# Run the site locally
npm run dev          # → http://localhost:5173

# (Optional) run the Sanity Studio locally
npm run studio:dev   # → http://localhost:3333
```

| Command | Effect |
|---|---|
| `npm run dev` | Local dev server for the site |
| `npm run build` | Production build → `dist/` folder |
| `npm run preview` | Serve the production build locally |
| `npm run studio:dev` | Run the Sanity Studio locally |
| `npm run studio:deploy` | Redeploy the Studio (see §5) |

---

## 5. Special case — changing the content STRUCTURE (Sanity schema)

If you want to **add / remove a field** in the CMS (not just its content), you must
edit the schema and redeploy the Studio.

1. Edit `studio/schemas/homePage.js` (field definitions).
2. Update the front-end read query in `src/lib/sanity.js` (GROQ) to read the new field,
   and use it in the relevant section.
3. Redeploy the Studio:
   ```bash
   npm run studio:deploy      # deploys the editing app
   ```
   (To deploy only the schema: `cd studio && npx sanity schema deploy`.)
4. Push the front-end code (§3).

> For technical profiles only. For simple content, stick to §2.

---

## 6. Environment variables

Set in **Vercel → Project Settings → Environment Variables**:

| Variable | Value | Role |
|---|---|---|
| `VITE_SANITY_PROJECT_ID` | `kpguac1f` | Sanity project ID (content read) |
| `VITE_SANITY_DATASET` | `production` | Sanity dataset |
| `GEMINI_API_KEY` | *(secret)* | Google Gemini key for the `/iris` page — **server-side only**, must never reach the browser |

The `VITE_*` vars have hardcoded fallbacks, so the build won't break if they're missing
— but keep them set. Locally they live in `.env` (see `.env.example` for the template).

---

## 7. Platform coordinates (summary)

| Platform | Coordinates |
|---|---|
| **Code (GitHub)** | `TMNiji/Niji-agency`, branch `main` |
| **Hosting (Vercel)** | Project `niji-agency`, team `tmn-iji-s-projects` |
| **Domain** | `niji.agency` (apex) + `www.niji.agency` (redirects to apex). Registrar: **Gandi**. DNS `A → 76.76.21.21` |
| **CMS (Sanity)** | Project `kpguac1f` ("N Agency"), dataset `production` |
| **Sanity Studio** | https://niji-agency-website.sanity.studio/ |
| **Iris page** | `/iris` — uses the Google Gemini API via `api/iris-token.js` & `api/iris-chat.js` |

---

## 8. Quick troubleshooting

| Problem | Cause / Fix |
|---|---|
| A content change doesn't appear | Did you click **Publish** (not just save a draft)? Hard refresh. |
| `git push` doesn't update the site | Check the deployment in the Vercel dashboard (team `tmn-iji-s-projects`, project `niji-agency`). Did the build fail? |
| `vercel --prod` "succeeds" but the site doesn't change | Expected: local config points to the old orphaned project. Use `git push` (§3). |
| Studio shows 404 | Redeploy: `npm run studio:deploy`. |
| Site can't read Sanity | Check `VITE_SANITY_*` vars (§6). The site then falls back to hardcoded defaults. |
| The `/iris` page doesn't respond | Check `GEMINI_API_KEY` on Vercel (Production + Preview) and the Google AI Studio account quota. |
| Port 5173 already in use | `npm run dev -- --port 5174` |

---

*Dernière mise à jour / Last updated: 2026-06-22.*
