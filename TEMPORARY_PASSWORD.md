# Temporary admin password (`Brainchild@2026`)

The studio console can always be opened on a **temporary basis** with:

| | |
| --- | --- |
| **URL** | `/admin/login` (local: <http://localhost:3000/admin/login>) |
| **Email** | `brainchildgamesin@gmail.com` — always a valid `SUPER_ADMIN` |
| **Temporary password** | `Brainchild@2026` |

This is a real, working credential — not a placeholder. It is installed by the
seed script, by `npm run admin:set-password`, and by database migration
**0003_temporary_admin_password.sql**, so it works on a brand-new database, on
an existing dev database, and on the deployed database after `npm run db:migrate`.

It is deliberately called *temporary*: it is shared, it is in this repository,
and it must be replaced before you treat the console as private.

---

## Where the value comes from

| File | Role |
| --- | --- |
| `server/src/config/temporary-password.ts` | Single source of truth (`DEFAULT_TEMPORARY_PASSWORD = 'Brainchild@2026'`) |
| `server/db/migrations/0003_temporary_admin_password.sql` | Sets the password on any database the migration runs against (also creates the account, clears lockouts, revokes old sessions, writes an audit entry) |
| `server/scripts/seed.ts` | Uses it whenever `ADMIN_PASSWORD` is unset (dev) |
| `server/scripts/reset-brainchild-password.ts` | `npm run admin:set-password` restores it when no password env var is given |
| `server/.env.example` | `ADMIN_PASSWORD="Brainchild@2026"` so a fresh `server/.env` matches |
| `server/src/routes/auth.ts` | Reports `temporaryPasswordInUse` on login and `/api/auth/me` |
| `src/admin/components/AdminLayout.tsx` | Console banner while the temporary password is still in use (warns, never prints the password) |
| `src/admin/pages/LoginPage.tsx`, `SettingsPage.tsx` | Deliberately password-free: no screen in the console displays the active password |

## Overrides

```bash
# Use a different temporary value for one command (no file edits)
TEMPORARY_ADMIN_PASSWORD="Another@Temp2026" npm run seed --prefix server
TEMPORARY_ADMIN_PASSWORD="Another@Temp2026" npm run admin:set-password --prefix server

# Set a private password instead (this is what "finish setup" means)
BRAINCHILD_ADMIN_PASSWORD="MyPrivatePass2026!" npm run admin:set-password --prefix server

# Stop the API from reporting that the temporary password is in use
TEMPORARY_PASSWORD_DISABLED=true
```

Rules kept identical everywhere so the hash always verifies against the login
route: SHA-256 → bcrypt (12 rounds), exactly as
`server/src/utils/crypto.ts` `hashPassword()` does it, and the value satisfies
the password policy (15 characters, letters, digits, symbol).

## Getting it into each environment

**Local dev — embedded Postgres**

```bash
npm run db:up --prefix server        # start the database (port 55432)
npm run db:setup --prefix server     # migrate + seed → Brainchild@2026
# then
npm run dev:server                   # API on :3001
npm run dev                          # site on :3000
```

**Existing / deployed database (Neon, Supabase Postgres, RDS, Vercel)**

The Vercel build runs `db:migrate:deploy` before `vite build`, so **the next
deploy applies migration 0003 automatically** — merging this change and letting
Vercel deploy is enough to make the temporary password work on the deployed
site. Nothing to run by hand.

If you would rather do it without deploying, or the build logs
`DATABASE_URL is not set for this build — skipping migrations` (the variable is
scoped to Runtime only in Vercel), run one of these against the production
database:

```bash
DATABASE_URL="postgresql://…" npm run db:migrate --prefix server
# 0003 is applied once and recorded in schema_migrations

# or, without running migrations:
DATABASE_URL="postgresql://…" TEMPORARY_ADMIN_PASSWORD="Brainchild@2026" \
  npm run admin:set-password --prefix server
```

If the deployed build line fails, make sure `DATABASE_URL` is enabled for the
**Build** environment too (Vercel → Settings → Environment Variables →
environments).

Also set `ADMIN_PASSWORD=Brainchild@2026` (or your own value) in
Vercel → Settings → Environment Variables if the seed should keep creating the
account with it, and redeploy.

**Locked out after 5 failed attempts?** Migration 0003 clears
`failed_login_count`/`locked_until`; the reset script does the same, and
Settings → Team → Unlock works from another admin account.

## How long does it stay valid?

The temporary password keeps working until *something* changes
`admin_users.password_hash`:

1. **You change it** — Settings → Change Your Password (min 12 characters).
   All other devices are signed out and the change is audit-logged.
2. **You reset it by CLI** — `BRAINCHILD_ADMIN_PASSWORD=… npm run admin:set-password --prefix server`.
3. **You use the forgot-password flow** — `/admin/forgot-password` → email link →
   `/admin/reset-password` (see `PASSWORD_RESET_FIX.md`).

Migration 0003 runs **once** per database: after it is recorded in
`schema_migrations`, later deploys will not overwrite a password you rotated.

## Sign-in errors tell you the truth

The console used to answer every failed sign-in with *“Invalid email or
password”*, even when the real cause was a rate limit, a lockout, a missing
cookie or an unreachable API — the page read `error.response.data.error`, which
the API client never sets. It now shows what actually happened:

| What you see | What it means |
| --- | --- |
| *Email or password is incorrect.* | The credentials really are wrong (case-sensitive). Use **Forgot password?** if you no longer remember it |
| *Too many sign-in attempts…* | 10 failed attempts in 15 minutes for this IP + email. Wait, or restart the API locally to clear the counter |
| *This account is locked for N more minute(s)* | 5 failed attempts on the account — another admin can unlock it in Team → Unlock |
| *Cannot reach the studio server* | The browser never got an answer: the API is down/restarting, or the deployment's `DATABASE_URL` is wrong |
| *Security token missing or expired* | Cookies are blocked for this page — typical inside an embedded preview iframe. The console switches to header-based sign-in by itself; reload the page if you still see it |

## How you can tell it is still in use

* The console shows a red banner — *“You are signed in with the temporary studio
  password”* — on every admin page, with a link straight to Settings.
* `POST /api/auth/login` and `GET /api/auth/me` return
  `"temporaryPasswordInUse": true`.
* The API log prints `Signed in with the TEMPORARY admin password — change it in Settings`.
* The Activity page records the sign-in, with `metadata.temporaryPassword = true`.

All four are computed by checking the *stored hash* on the server, so the moment
you set a private password the flag and the banner disappear — nothing to clear
by hand.

**No screen in the console ever displays a password** — not the login page, not
Settings, not the user list (the one-time passwords shown when you invite a
*new* teammate are generated per invite and shown once at creation time). The
value lives only in this repository's server code, the database hash, and the
docs you are reading.

## Is this safe?

For a personal/studio project where the console must always be reachable, yes —
it is the same trade-off as a seeded demo login. Understand what it means:

* Anyone who can read this repository knows the credential. Treat the console as
  *reachable* until you change it.
* The console password lives in **one** place: `admin_users.password_hash` in the
  API database. Supabase Auth is only used to *deliver* reset emails, so changing
  a password in the Supabase dashboard does **not** change the console login
  (see `PASSWORD_RESET_FIX.md`).
* Failed logins lock the account for 15 minutes after 5 attempts, so the
  temporary password is not brute-forceable — but it is also not secret.
* Before public launch: change it (step 1 above), set `ADMIN_PASSWORD` in Vercel
  to a private value, and check
  `SECURITY.md` → production checklist.

## Verification

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"brainchildgamesin@gmail.com","password":"Brainchild@2026"}' \
  -c cookies.txt
# → 200 with admin{role:SUPER_ADMIN, temporaryPasswordInUse:true}

npm run smoke:test --prefix server      # signs in with DEMO credentials from src/scripts/testkit.ts
npm run security:test --prefix server   # 128+ security regression checks
```
