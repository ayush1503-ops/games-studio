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

## Useful commands

```bash
npm run dev      # Vite development server
npm run build    # production build
npm run lint     # TypeScript check
npm run preview  # preview the production build
```
