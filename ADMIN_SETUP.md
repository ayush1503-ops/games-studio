# Admin Setup — brainchildgamesin@gmail.com

Primary studio admin **brainchildgamesin@gmail.com** is always valid as `SUPER_ADMIN` in the Express/PostgreSQL admin API. Supabase Auth is a separate store used by the player-facing site.

## 1. Express + PostgreSQL (main admin API)

### How it works
- `server/src/config/env.ts` defaults `ADMIN_EMAIL` to `brainchildgamesin@gmail.com`
- `server/scripts/seed.ts` always ensures this email exists as `SUPER_ADMIN`:
  - If `ADMIN_EMAIL` env var is set to something else, both accounts are created
  - If `ADMIN_EMAIL` is `brainchildgamesin@gmail.com` (default), only one account is created
  - Password comes from `ADMIN_PASSWORD` env var, or `BRAINCHILD_ADMIN_PASSWORD`, or the shared **temporary** password `Brainchild@2026` in dev
    (`TEMPORARY_ADMIN_PASSWORD` overrides the temporary value — see `TEMPORARY_PASSWORD.md`)
- `server/db/migrations/0002_add_brainchild_admin.sql` inserts the account if it does not exist and ensures role = `SUPER_ADMIN`, `is_active = true`
- `server/db/migrations/0003_temporary_admin_password.sql` then installs the current temporary password `Brainchild@2026` (bcrypt 12 rounds), clears any lockout, reactivates the account and revokes its old sessions. It runs automatically on `npm run db:migrate`, so an already-migrated database gets the temporary password too.

### Local dev
```bash
# in server/
npm run db:setup   # migrates + seeds, creates brainchildgamesin@gmail.com / Brainchild@2026
# or
ADMIN_EMAIL=brainchildgamesin@gmail.com ADMIN_PASSWORD=YourStrongPassword123 npm run seed
```

Sign in at `http://localhost:3000/admin/login` with:
- Email: `brainchildgamesin@gmail.com`
- Password: `Brainchild@2026` (temporary) or whatever you set in `ADMIN_PASSWORD`

### Production (Vercel + Neon/Supabase Postgres)
Set in Vercel env:
- `ADMIN_EMAIL=brainchildgamesin@gmail.com`
- `ADMIN_PASSWORD=<strong 12+ chars>`
- `DATABASE_URL=...`

Then run from your machine:
```bash
DATABASE_URL="postgresql://..." ADMIN_EMAIL="brainchildgamesin@gmail.com" ADMIN_PASSWORD="strong-pass" npm run db:setup --prefix server
```

## 2. Supabase Auth (player-facing auth + carrier for the admin reset email)

### How it works
- `supabase/migrations/0005_add_brainchild_admin.sql`:
  - Auto-confirms `brainchildgamesin@gmail.com` in `auth.users`
  - Ensures `profiles` row exists with `display_name = Brainchild Games`
  - Ensures `admin_users` row exists with `role = SUPER_ADMIN`, `is_active = true`
  - Creates trigger `trg_auto_promote_primary_admin` that auto-promotes this email on any future INSERT into `auth.users`
- `supabase/migrations/0006_harden_primary_admin_trigger.sql` replaces that trigger with an
  `AFTER INSERT`, exception-guarded version. The original `BEFORE INSERT` trigger inserted into
  tables that reference `auth.users(id)` before the row existed, so creating
  `brainchildgamesin@gmail.com` in Supabase Auth failed with "Database error creating new user".
  **Run 0006 on every project that ran 0005 or `apply_now.sql`.**
- `supabase/0003_auth_email_setup.sql` confirms/promotes an already-existing auth user
- `supabase/apply_now.sql` is a one-file setup that includes the (fixed) trigger + promotion

### Setup steps (Supabase Dashboard → SQL Editor)
1. Run `supabase/migrations/0001_init_schema.sql` (or `apply_now.sql` for one-go)
2. Run `supabase/migrations/0002_seed.sql`
3. Run `supabase/migrations/0004_add_media_bucket.sql`
4. Run `supabase/migrations/0005_add_brainchild_admin.sql`
5. Run `supabase/migrations/0006_harden_primary_admin_trigger.sql`
6. The auth user `brainchildgamesin@gmail.com` is created automatically the first time the
   admin console's *Forgot password* is used (or add it manually in Authentication → Users →
   Add user with *Auto Confirm User* ticked)
7. Verify:
```sql
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'brainchildgamesin@gmail.com';
SELECT id, name, role, is_active FROM admin_users WHERE id IN (SELECT id FROM auth.users WHERE email = 'brainchildgamesin@gmail.com');
```

### Password reset
The admin console password lives in `admin_users.password_hash` in the Express API — **not** in
Supabase. Supabase Auth is used only to *deliver* the reset email: `/admin/forgot-password` →
`POST /api/auth/forgot-password` → Supabase sends its "Reset Password" email →
`/admin/reset-password#…type=recovery` → `POST /api/auth/reset-password` verifies the Supabase
recovery session server-side and rotates the API password. Dashboard prerequisites (redirect URL
allow-list, who the built-in mailer can deliver to, SMTP) and the Vercel variables are listed in
`PASSWORD_RESET_FIX.md`.

## 3. Frontend

- `src/admin/pages/LoginPage.tsx` placeholder is `brainchildgamesin@gmail.com` and shows helper "Primary admin: brainchildgamesin@gmail.com is always valid"
- `src/admin/pages/ForgotPasswordPage.tsx` defaults to `brainchildgamesin@gmail.com`
- `.env.example` includes `VITE_ADMIN_EMAIL=brainchildgamesin@gmail.com`

## 4. Testing login

Express API test:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"brainchildgamesin@gmail.com","password":"Brainchild@2026"}' \
  -c cookies.txt
```

Supabase test:
```js
import { supabase } from './lib/supabase'
await supabase.auth.signInWithPassword({ email: 'brainchildgamesin@gmail.com', password: '...' })
```

## 5. Current password & changing it

### Current password
- **Email:** `brainchildgamesin@gmail.com`
- **Password:** `Brainchild@2026` — temporary, works in dev, preview and production (15 chars, meets policy: letter + number + symbol)
- This is set by:
  - `server/db/migrations/0003_temporary_admin_password.sql` (authoritative for an existing database)
  - `server/scripts/seed.ts` and `server/scripts/reset-brainchild-password.ts` (defaults)
  - `server/src/config/temporary-password.ts` (single source of truth for the value)
  - Can be overridden by env var `BRAINCHILD_ADMIN_PASSWORD`, `ADMIN_PASSWORD` or `TEMPORARY_ADMIN_PASSWORD`

Full details, rotation and expiry-of-use: **`TEMPORARY_PASSWORD.md`**.

### How to change after login (recommended)

**Option A — UI (Settings page):**
1. Login at `/admin/login` with `brainchildgamesin@gmail.com` / `Brainchild@2026`
2. Go to **Settings** (left sidebar) → **Change Your Password** card at top
3. Enter current password, new password (min 12 chars), confirm
4. Click **Change Password** — other devices will be signed out, audit logged

**Option B — CLI reset (server):**
```bash
# Set to known password
cd server
npm run admin:reset-brainchild
# Or set custom
BRAINCHILD_ADMIN_PASSWORD=MyNewStrongPass123 npm run admin:reset-brainchild
# Or use ADMIN_PASSWORD env
ADMIN_PASSWORD=MyNewStrongPass123 npm run seed
```

**Option C — Forgot password flow:**
1. Go to `/admin/forgot-password`
2. Enter `brainchildgamesin@gmail.com`
3. Check Gmail inbox (including Spam/Promotions) for the Supabase "Reset Password" email
4. The link lands on `/admin/reset-password` with the form unlocked → set new password
   (requires the Supabase dashboard setup in `PASSWORD_RESET_FIX.md`; locally with
   `DEV_EXPOSE_RESET_LINK=true` the link is shown on the page instead of being emailed)

**Option D — Supabase dashboard (player auth only):**
1. Supabase Dashboard → Authentication → Users → find the player account
2. Click ⋯ → Reset password or send magic link

This does not change the Express admin-console password. For the studio admin, use Option B or the forgot-password flow above.

### Production
- Set `ADMIN_PASSWORD` in Vercel env to a strong unique password (min 12 chars)
- Run seed: `DATABASE_URL=... ADMIN_PASSWORD=StrongPass123 npm run db:setup --prefix server`
- Immediately change via Settings UI after first login
- Never commit real passwords — use env vars and secret manager

### Security notes
- Passwords are hashed with SHA256 → bcrypt 12 rounds (see `server/src/utils/crypto.ts`)
- Change triggers `PASSWORD_CHANGED` audit log and revokes other sessions
- Failed logins lock account for 15 min after 5 attempts — unlock via Team → Unlock or CLI reset
- Primary admin `brainchildgamesin@gmail.com` is protected: cannot be deleted if last SUPER_ADMIN, cannot deactivate self
