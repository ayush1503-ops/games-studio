# Brainchild Games

Brainchild Games is a Vite + React studio site with a Supabase-backed catalog
and editor console. Supabase is the single backend: Auth handles sign-in and
password recovery, Postgres stores CMS content, RLS protects editor actions,
and Storage holds uploaded media.

## Quick start

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The local app runs at `http://localhost:3000`. `.env.example` ships with
placeholders only — no project URL, project ref or API key is committed to this
repository. Fill in the values from your own Supabase project (**Project
Settings → API**) before Supabase-backed features (auth, catalog, newsletter)
will work; the site still renders without them.

## Set up the database

Run [`supabase/editor_setup.sql`](supabase/editor_setup.sql) in the Supabase SQL
Editor of your own project. Then create your studio account in
**Authentication → Users** with a password you choose privately, and run the
final promotion block (replacing `YOUR_ADMIN_EMAIL`) to make that account
`SUPER_ADMIN`.

There is deliberately no default, shared, seeded, or hard-coded password. The
repository never receives a service-role key. All browser access uses the
publishable key and is restricted by Row Level Security.

## Editor console

Visit `/admin/login` after promoting your Auth user. The editor can manage:

- games, publishing state, featured games, images and links
- news posts and categories
- public jobs, website content and site settings
- subscribers and contact messages
- admin roles for users already created in Supabase Auth
- Supabase Auth password recovery and account sign-out

To add another editor, create that user in Supabase Auth first, then insert or
update its `admin_users` row using the same promotion block in the SQL file.

## Deploy to Vercel

The repository is ready for a static Vercel deployment:

```bash
npm run build
npx vercel --prod
```

The app does not need a custom API server, database URL, JWT secret, SMTP
credential, or Vercel function.

Before the first production deploy, check the Vercel project settings:

- **General → Root Directory** must be `./` (the repository root), otherwise
  `vercel.json` is never read.
- **Build & Development Settings**: Framework Preset `Vite`, Build Command
  `npm run build`, Output Directory `dist`. These are also declared in
  `vercel.json`, so a plain Git push works with no dashboard edits.
- **Environment Variables**: add `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` (publishable key). Keys live here, never in
  `vercel.json` or Git. Redeploy after changing them.

### Single-page-app routing

This is a client-routed SPA, so every deep link (`/admin`, `/admin/login`,
`/games`, …) must fall back to `index.html`. `vercel.json` declares that
rewrite. Without it Vercel answers deep links with its own
`404: NOT_FOUND — This page doesn't exist` page even though `/` loads fine,
which is the usual cause of "the admin panel 404s in production". After
changing `vercel.json`, redeploy and hard-refresh.

Finally, configure the same redirect URLs in Supabase Authentication settings
once Vercel gives you the production domain:

- `https://YOUR-VERCEL-DOMAIN.vercel.app/**`
- `http://localhost:3000/**`

## Deploy to cPanel shared hosting (Apache)

This is a 100% static site (Vite build output + Supabase as the backend), so
it runs on any plain cPanel shared host — no Node.js app, no VPS, no
server-side process needed. If a previous upload "didn't work", it was almost
certainly one of: the wrong folder was uploaded, the hidden `.htaccess` was
left behind, or a deep link was opened without the SPA fallback. The steps
below cover all three.

### Release steps (File Manager — recommended)

1. **Configure production values.** cPanel has no env-var dashboard, so
   settings are baked into the bundle at build time:

   ```bash
   cp .env.production.example .env.production
   # edit .env.production: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
   # (leave VITE_BASE_PATH commented for a domain-root install)
   ```

2. **Build locally** (Node 18+):

   ```bash
   npm ci
   npm run build
   ```

   This produces `dist/` containing `index.html`, `assets/`, `images/` and a
   hidden `.htaccess` (copied from `public/.htaccess`) that provides the
   client-side-routing fallback, caching and security headers.

3. **Upload the *contents* of `dist/`** — not the project source, not the
   `dist` folder itself — to the domain's document root (usually
   `public_html/`). In File Manager click **Settings → Show Hidden Files**,
   otherwise `.htaccess` is silently skipped and every page except `/`
   returns a 404. Easiest reliable method: zip the *contents* of `dist/`
   locally (`cd dist && zip -r ../site.zip .`), upload `site.zip`, Extract.

4. **Point Supabase at the live domain.** In Supabase → Authentication → URL
   Configuration add:

   - Site URL: `https://YOUR-DOMAIN.com`
   - Redirect URLs: `https://YOUR-DOMAIN.com/**` (keep the localhost entries
     for local dev)

5. **Verify:** open `https://YOUR-DOMAIN.com`, then
   `https://YOUR-DOMAIN.com/admin/login` directly (this is the deep link that
   404s when `.htaccess` is missing), and sign in.

### Subdirectory install (`example.com/studio/`)

1. Uncomment and set `VITE_BASE_PATH=/studio/` in `.env.production`
   (leading **and** trailing slashes required), rebuild, and upload the
   `dist/` contents to `public_html/studio/`.
2. Add `https://example.com/studio/**` to the Supabase redirect URLs.
3. The same `.htaccess` works unchanged — its fallback rule is relative, so
   it adapts to whatever folder it sits in.

### Push-to-deploy via Git Version Control (optional)

Prefer `git push` over File Manager uploads? Rename
[`.cpanel.yml.example`](.cpanel.yml.example) to `.cpanel.yml`, follow the
checklist inside it, and use cPanel → Git Version Control → Deploy. This
requires Node.js 18+ on the hosting account; otherwise keep the File Manager
flow above.

### Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| Blank page / file listing / PHP errors | You uploaded the project source instead of the build. Only the *contents* of `dist/` belong on the server. No `package.json`, no `node_modules`, no "Setup Node.js App" needed. |
| `/` works but `/admin`, `/admin/login`, refresh → 404 | `.htaccess` is missing on the server. Re-upload with "Show Hidden Files" enabled (or `unzip` the bundle — zips keep dotfiles). |
| Images/JS 404, but only in a subfolder | Built with the default root base path. Set `VITE_BASE_PATH=/sub/` in `.env.production`, rebuild, re-upload. |
| Admin login / password reset fails on live | Supabase redirect URLs don't include the live domain (step 4 above). Also confirm `.env.production` held the *production* Supabase project values when you built. |
| Old version still shows after re-upload | `index.html` is sent `no-cache`, but proxies/CDNs (Cloudflare "Cache Everything") can pin it. Purge the cache and hard-refresh. |
| `500 Internal Server Error` on every page | The host's Apache lacks a module the `.htaccess` references. Every block here is wrapped in `<IfModule>` guards, so first check the cPanel Error Log — a stray `.htaccess` from a previous app (WordPress rules, `php_flag`s) in a parent folder is the usual culprit. |

## Useful commands

```bash
npm run dev      # Vite development server
npm run build    # production build
npm run lint     # TypeScript check
npm run preview  # preview the production build
```
