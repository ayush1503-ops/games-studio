<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Brainchild Games — website + studio CMS

A Vite + React site (public studio website) with a secure Express + PostgreSQL
admin/CMS API (`server/`) and Supabase for player-facing auth, content and
storage.

## Architecture

| Piece | Tech | Where it runs on Vercel |
| --- | --- | --- |
| Public site + admin console | Vite + React 19 + Tailwind 4 | Static output (`dist/`), SPA fallback via `vercel.json` |
| Studio API (`/api/*`) | Express + Drizzle + PostgreSQL | Serverless function (`api/[...path].ts`) |
| Media uploads | Local disk (dev) / **Supabase Storage** (prod) | Storage bucket `media` (public) |
| Player auth / wishlists / newsletter / contact | Supabase (anon key, RLS) | Browser SDK (no server needed) |

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
   ```bash
   npm install                  # site + API runtime + dev tooling (one lockfile)
   npm install --prefix server  # optional: embedded Postgres (local dev DB) + nodemailer (SMTP)
   ```
   The second install is only needed for the local dev database
   (`npm run db:up --prefix server`) and local SMTP delivery — the API
   runs fine without it.
2. Start the dev database (embedded PostgreSQL, port 55432):
   ```bash
   npm run db:up --prefix server     # or: npm run db:setup (migrate + seed in one go)
   ```
3. Create `server/.env` from `server/.env.example` (the defaults work for dev).
4. Optionally create `.env.local` with your Supabase project (see
   `supabase/README.md`):
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-ANON-KEY
   ```
5. Run the API and the site:
   ```bash
   npm run dev:server                # Express API on :3001
   npm run dev                       # Vite on :3000 (proxies /api + /uploads)
   ```
   Sign in at `http://localhost:3000/admin/login`
   - **Email:** `brainchildgamesin@gmail.com` (always valid SUPER_ADMIN)
   - **Password:** `Brainchild@2026` — the shared **temporary** password (or `ADMIN_PASSWORD` / `BRAINCHILD_ADMIN_PASSWORD` env var)
   - After first login, change password in **Settings → Change Your Password** (min 12 chars). Other sessions are revoked automatically. Until it is changed, the console shows a temporary-password warning banner — see `TEMPORARY_PASSWORD.md`.

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run db:setup --prefix server` | Migrate + seed the database (creates brainchildgamesin@gmail.com) |
| `npm run seed --prefix server` | Re-seed content (idempotent) |
| `npm run admin:reset-brainchild --prefix server` | Reset password for brainchildgamesin@gmail.com to env or dev default |
| `npm run build` | Build API (`server/dist`) + site (`dist`) |
| `npm run lint` | Typecheck the frontend |
| `npm run lint:all` | Typecheck frontend **and** API |
| `npm run security:test --prefix server` | Security regression suite against a running API |
| `npm run dev:fake-auth --prefix server` | Offline stand-in for Supabase Auth (port 54321) for testing the reset flow |
| `npm run reset-flow:test --prefix server` | End-to-end admin password-reset test (API pointed at the fake auth) |
| `npx tsx scripts/vercel-sim.ts` | Simulate the Vercel serverless runtime locally (after `npm run build`) |

## Deploy to Vercel

The repo is wired for a single Vercel project: static site + API function.
Open `vercel.json` — no Vercel dashboard configuration is required beyond
environment variables.

### 1. Provision the database

Vercel has no persistent local disk, so the API needs a managed Postgres.
Any of these works (Neon is the smoothest fit):

- **Neon** (recommended) — create a project/database, use the **pooled
  endpoint** for `DATABASE_URL` (add `?pgbouncer=true` is *not* needed for the
  `pg` driver; the pooled host is enough).
- **Supabase** — use the Postgres URL from *Project Settings → Database*
  (the same Supabase project you use for auth/storage is fine).

Apply the schema + seed from your machine:

```bash
# in server/
DATABASE_URL="postgresql://..." ADMIN_EMAIL="you@example.com" \
  ADMIN_PASSWORD="something-strong" ADMIN_NAME="Studio Admin" \
  npm run db:setup --prefix server
```

From then on every deploy keeps the schema current by itself: the Vercel build
runs `npm run db:migrate:deploy --prefix server`, which applies any pending
migration before the site is built (that is how the temporary admin password in
migration 0003 reaches production without a manual step). It never fails the
build — if `DATABASE_URL` is not exposed to the build environment or the
database is unreachable, it logs and continues, and you can still run
`npm run db:migrate --prefix server` by hand. Set
`SKIP_DB_MIGRATE_ON_BUILD=true` to turn it off.

### 2. Configure Supabase (already in your stack)

1. If you haven't set the project up yet, follow `supabase/README.md`
   (runs `0001_init_schema.sql` + `0002_seed.sql`).
2. Run **`supabase/migrations/0004_add_media_bucket.sql`** in the SQL Editor —
   it creates the public `media` bucket the API uploads into.
3. Run **`supabase/migrations/0005_add_brainchild_admin.sql`** and
   **`0006_harden_primary_admin_trigger.sql`** (0006 is required even if 0005
   was applied earlier — the original trigger blocked creating the primary
   admin in Supabase Auth).
4. After deployment, add your domain to Supabase
   *Authentication → URL Configuration*: Site URL `https://www.brainchildapp.com`
   and Redirect URL `https://www.brainchildapp.com/admin/reset-password`
   (plus `http://localhost:3000/admin/reset-password` for local dev). The
   admin password-reset email is sent by Supabase Auth and comes back to that
   route.

### 3. Vercel environment variables

Project → Settings → Environment Variables (Production **and** Preview):

**Frontend (build-time, embedded in the bundle)**

`vercel.json` → `build.env` includes the public URL and anon key for the
Brainchild Supabase project (`kxirdoacrphluervussu`), so Vercel builds have
browser authentication configured. These are public browser credentials, not
administrator credentials; keep Row Level Security enabled on exposed tables.
If switching projects, update both values together. Local development still
uses `.env.local` as described above.

Redeploy after changing these values: Vite embeds them at build time.

Password recovery for the **admin console**: the password itself lives in
this project's own database (`admin_users`), but the reset *email* is sent by
Supabase Auth using the server-side variables below, so no SMTP account is
needed. Set `APP_BASE_URL` to your deployed origin — the emailed link redirects
to `<APP_BASE_URL>/admin/reset-password`, which must be on Supabase's redirect
allow-list. Full walkthrough: `PASSWORD_RESET_FIX.md`.

Never commit `DATABASE_URL`, database passwords, or service-role/secret keys.
Set those only in Vercel's environment settings (server-side, without `VITE_`).

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | publishable/anon key (safe to expose) |

**API (serverless runtime)**

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | your Postgres connection string |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 32+ chars (`openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | 32+ chars (different from above) |
| `ADMIN_EMAIL` | `brainchildgamesin@gmail.com` (primary `SUPER_ADMIN`) |
| `ADMIN_PASSWORD` | `Brainchild@2026` — the **temporary** console password (`TEMPORARY_PASSWORD.md`); replace with your own when you are done setting up |
| `FRONTEND_ORIGIN` | your Vercel URL (same-origin, but CSRF/origin checks use it) |
| `STORAGE_DRIVER` | `supabase` |
| `SUPABASE_URL` | same project URL as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | **service-role key — server-side only, never a `VITE_` var** |
| `STORAGE_BUCKET` | `media` (default) |
| `SERVE_FRONTEND` | `false` (Vercel serves the static build itself) |

**Password-reset emails.** With `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
set (above), the API asks Supabase Auth to send the reset email — nothing else
is required on Vercel:

| Variable | Value |
| --- | --- |
| `APP_BASE_URL` | your deployed origin, e.g. `https://www.brainchildapp.com` |
| `SUPABASE_ANON_KEY` | same as `VITE_SUPABASE_ANON_KEY` (optional) |
| `PASSWORD_RESET_CHANNEL` | `auto` (default) · `supabase` · `smtp` |

Supabase's built-in mailer only delivers to members of the Supabase
organisation (2 emails/hour); configure *Authentication → SMTP Settings* in
the Supabase dashboard to email anyone. If Supabase is not configured (or
`PASSWORD_RESET_CHANNEL=smtp`) the API sends its own token link over SMTP
instead — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`
(`nodemailer` is a root dependency, so it ships in the Vercel function).
Whatever the channel, an undelivered email is logged as
`Password reset email was not delivered` with a `reason`, and a server with no
channel at all returns `emailDeliveryEnabled: false` so the page can say so.

### 4. Deploy

```bash
npm i -g vercel
vercel            # first time: link the project, answer "Yes" to the prompts
vercel --prod
```

The build (see `vercel.json`) runs:

1. `npm ci` — installs everything from the single root lockfile. The
   local-dev-only optional packages (`embedded-postgres`, `nodemailer`)
   live in `server/` and are never installed on Vercel, so no native
   Postgres binary is downloaded in the build sandbox.
2. `npm run build:server && vite build` — compiles the API to
   `server/dist` and the site to `dist`.

Everything else is automatic:

- `dist/` → static site; the SPA fallback rewrites non-API paths to `index.html`
- `api/[...path].ts` → serverless function for every `/api/*` request (the SPA fallback explicitly excludes `/api` so it cannot swallow API calls)
  (the API's runtime dependencies are traced from the root `node_modules`,
  so no `includeFiles` are needed)
- security headers (CSP, X-Frame-Options, …) are set in `vercel.json`

**Function duration:** `vercel.json` sets `maxDuration: 60` for the API
function — the highest value accepted on every Vercel plan (Hobby caps
serverless functions at 60 s; a higher value in `vercel.json` fails the
build). If you're on Pro or Enterprise and need longer-running requests
(large backup exports), raise the project's Function Max Duration and bump
`maxDuration` in `vercel.json` to match (300 s max on Pro).

### 5. Verify

- `GET https://<your-project>.vercel.app/api/public/site` → JSON with games/news/jobs
- `GET .../api/health` → `{"status":"ok","database":"connected"}`
- Open `.../admin/login` and sign in with the admin you seeded.

### Vercel notes & trade-offs

- **Uploads**: with `STORAGE_DRIVER=supabase` (the setup above) images are
  stored in the public `media` bucket and served from Supabase's CDN — the
  right fit for serverless, where the local filesystem is ephemeral.
- **Body limit**: Vercel caps request bodies at 4.5 MB; the API caps single
  images at 4 MB (`MAX_UPLOAD_BYTES`) so uploads never trip the platform limit.
- **Rate limiting**: `express-rate-limit` uses in-memory counters, so limits
  are per function instance, not global. The login limiter (per IP + email)
  still blunts credential stuffing; for global limits add a shared store
  (e.g. Upstash Redis) when you outgrow it.
- **DB connections**: the pool is module-scoped and reused across warm
  invocations; idle connections are released after 30 s. Keep
  `DB_POOL_MAX` modest (≤ 10) so many instances don't exhaust a small
  database.
- **Function timeout** is set to 300 s (the platform maximum), which covers
  even large backup exports.
- **Migrations**: `buildCommand` runs `db:migrate:deploy` before `vite build`,
  so a deployment can never sit in front of an out-of-date database. Migration
  0003 (the temporary admin password) reaches production this way. The step is
  non-fatal by design: missing `DATABASE_URL` or an unreachable database logs a
  warning and the build continues. `SKIP_DB_MIGRATE_ON_BUILD=true` disables it.
  Migrations are recorded in `schema_migrations`, so each one applies once and
  never overwrites a password you rotated afterwards.

## Embedded previews (iframes)

The console signs in with HttpOnly cookies by default. Inside a **cross-site
iframe** — an embedded preview panel, for example — browsers do not attach
`SameSite=Lax` cookies to API calls and block third-party cookies outright in
several browsers, so a cookie-based sign-in can never complete there: every
request arrives unauthenticated and the API answers `csrf_missing` or
`unauthenticated`, no matter what password is typed.

The console detects that situation (`window.self !== window.top`, or a cookie
probe that fails) and switches to the API's **header transport**:
`POST /api/auth/login` returns the same JWT/refresh tokens in the response body,
the client keeps them in memory (`sessionStorage` when available) and sends
`Authorization: Bearer`. Rotation, revocation, lockouts, RBAC and the audit log
are unchanged; CSRF double-submit is not needed in this mode because a
cross-site attacker cannot attach an `Authorization` header, and the
`Origin` / `Sec-Fetch-Site` guards still reject cross-site requests. Details and
the full threat model: `SECURITY.md` §6.1.

Cookie mode remains the default wherever cookies work — including the deployed
site — so nothing changes for normal visitors.

## Security model (short version)

- Admin auth: bcrypt (12 rounds) + HttpOnly `SameSite=Lax` JWT cookies +
  rotating refresh tokens, double-submit CSRF, origin checks, per-route RBAC,
  lockout after repeated failures.
- Content: parameterized SQL (Drizzle), HTML sanitized server-side, uploads
  validated by magic bytes with dimension checks.
- Supabase: everything player-facing is RLS-gated (see
  `supabase/migrations/0001_init_schema.sql`); the service-role key is used
  server-side only for media uploads.
- Full details in `SECURITY.md`.

## Documentation map

| File | What it covers |
| --- | --- |
| `TEMPORARY_PASSWORD.md` | The shared temporary admin password `Brainchild@2026`: where it comes from, how to install/rotate it, how the console warns you while it is still in use |
| `ADMIN_SETUP.md` | Primary admin account, environments, changing the password, testing login |
| `PASSWORD_RESET_FIX.md` | Why the reset email is sent through Supabase Auth and how to make it arrive |
| `SECURITY.md` | Threat model, controls and the production checklist |
