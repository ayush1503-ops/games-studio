# Admin password reset — how it works now and how to get the email

Supabase project: `kxirdoacrphluervussu` →
https://supabase.com/dashboard/project/kxirdoacrphluervussu
(URL `https://kxirdoacrphluervussu.supabase.co`; the `sb_publishable_…` key is
a key, not part of the URL — an older copy of `supabase/README.md` had that
wrong).

## What was actually broken

Three independent problems stacked on top of each other, which is why every
earlier "fix" only moved the failure around:

1. **Two password stores.** `/admin/login` checks `admin_users.password_hash`
   in the API's Postgres. The first version of the reset pages used
   `supabase.auth.resetPasswordForEmail` + `updateUser`, which changes the
   password in Supabase `auth.users` — the link "worked", sign-in still failed.
2. **No way to send mail in production.** The follow-up moved the reset to the
   API's own token link, sent over SMTP — but Vercel never had `SMTP_HOST`, so
   the page said "a link is on its way" and nothing was ever sent.
3. **The primary admin could not be created in Supabase Auth.** Migration 0005
   installed a `BEFORE INSERT` trigger on `auth.users` that inserts into
   `profiles`/`admin_users`, both of which reference `auth.users(id)`. For
   `brainchildgamesin@gmail.com` (and only that address) the insert hit a
   foreign-key violation, which Supabase reports as
   "Database error creating new user" / `unexpected_failure`. Reproduced
   locally; fixed by `supabase/migrations/0006_harden_primary_admin_trigger.sql`.

## What the code does now

- `POST /api/auth/forgot-password` keeps the admin password where it is, and
  uses **Supabase Auth only as the mail carrier**: for a real admin it makes
  sure a confirmed Supabase user with that email exists (created with the
  service-role key on first use), then asks Supabase to send its *Reset
  Password* email with `redirect_to = <APP_BASE_URL>/admin/reset-password`.
  Unknown addresses get the same response and never touch Supabase.
- The email link comes back to `/admin/reset-password#…type=recovery`; the page
  posts the Supabase recovery session to `POST /api/auth/reset-password`, which
  verifies it **server-side** (`/auth/v1/user` with the service-role key, `amr`
  must contain a `recovery` factor younger than 60 minutes, email must belong to
  an active admin), rotates `admin_users.password_hash`, revokes all other
  console sessions plus the Supabase session, and audits
  `PASSWORD_RESET_COMPLETED`. Replays, password-login sessions, forged JWTs and
  stale sessions are rejected (`400`).
- No Supabase configured → the previous SMTP/console token link still works
  (`PASSWORD_RESET_CHANNEL=smtp` forces it). Exactly one proof per request:
  `token` *or* `supabaseAccessToken`.
- Verified offline against a GoTrue stand-in:
  `npm run reset-flow:test --prefix server` (29 checks) and
  `npm run security:test --prefix server` (128–130 checks).

## Checklist to receive the reset email at brainchildgamesin@gmail.com

### A. Supabase dashboard (one time)

1. **SQL Editor** → run `supabase/migrations/0006_harden_primary_admin_trigger.sql`
   (safe to re-run; required if 0005 or `apply_now.sql` was ever applied).
2. **Authentication → URL Configuration**
   - Site URL: `https://www.brainchildapp.com`
   - Redirect URLs: `https://www.brainchildapp.com/admin/reset-password`,
     `http://localhost:3000/admin/reset-password`
     (when `redirect_to` is not allow-listed Supabase silently sends the user
     to the Site URL instead — the link "opens the homepage").
3. **Email delivery — pick one:**
   - *Built-in Supabase mailer*: delivers **only to members of the Supabase
     organisation** and at most **2 emails per hour**. If your Supabase login
     is `brainchildgamesin@gmail.com` you are already a member; otherwise
     invite that address under **Organization → Team**.
   - *Custom SMTP* (**Authentication → SMTP Settings**; Resend, Postmark, SES,
     …): delivers to anyone; then raise **Authentication → Rate Limits → emails
     per hour** (default 30 once SMTP is on).
4. **Authentication → Emails → Reset Password template** must still contain
   `{{ .ConfirmationURL }}`.

### B. Vercel → Settings → Environment Variables (Production + Preview)

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://kxirdoacrphluervussu.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the **anon / publishable** key |
| `SUPABASE_URL` | `https://kxirdoacrphluervussu.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key (server only — never `VITE_`) |
| `SUPABASE_ANON_KEY` | same as `VITE_SUPABASE_ANON_KEY` (optional) |
| `APP_BASE_URL` | `https://www.brainchildapp.com` |
| `FRONTEND_ORIGIN` | `https://www.brainchildapp.com` |
| `PASSWORD_RESET_CHANNEL` | `auto` (or omit) |
| `STORAGE_DRIVER` | `supabase` |
| `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=production` | as before |

Redeploy after changing them (the `VITE_` pair is baked in at build time).
The API's first log line must say
`password reset channel: auto (supabase auth configured)` and
`reset link exposure: disabled`.

### C. Trigger it

1. Open `https://www.brainchildapp.com/admin/forgot-password`, submit
   `brainchildgamesin@gmail.com`.
2. Check the inbox (and Spam/Promotions) for the Supabase **Reset Password**
   email → click it → you land on `/admin/reset-password` with the form
   unlocked → choose a password (12+ characters) → sign in at `/admin/login`.
3. Console → **Activity** shows `PASSWORD_RESET_REQUESTED` (`delivered: true`)
   and `PASSWORD_RESET_COMPLETED`.

Locally the same works with `server/.env`; set `DEV_EXPOSE_RESET_LINK=false`
there if you want the real email instead of the link being shown on the page.

## If the email does not arrive

Look at the API log (Vercel → Functions) for
`Password reset email was not delivered` and read its `reason`:

| `reason` | Meaning / fix |
| --- | --- |
| `rate_limited` (`over_email_send_rate_limit`) | Supabase's hourly email budget is spent (2/h on the built-in mailer). Wait an hour or configure custom SMTP. |
| `provider_error` (`Error sending recovery email`) | Supabase could not hand the mail to its provider — with custom SMTP: wrong credentials/port; with the built-in mailer: the address is not a team member. Also check Supabase **Logs → Auth**. |
| `create_user_failed:unexpected_failure` | The auth user could not be created — run migration **0006** (see §A.1). |
| `create_user_failed:…` other | Service-role key wrong/rotated, or `SUPABASE_URL` is not this project. |
| `network_error` | The API could not reach `*.supabase.co` (egress blocked / DNS). |
| `emailDeliveryEnabled: false` in the response | Neither Supabase nor SMTP is configured on the server that answered. |

No `PASSWORD_RESET_REQUESTED` entry at all → the address is not in
`admin_users` on the database the deployed API uses. With `DATABASE_URL`
pointed at that database, `npm run admin:reset-brainchild --prefix server`
creates/repairs the primary admin row (and resets its password).

## Getting in without any email

The password lives in the API's database, so it can always be set directly:

```bash
# point DATABASE_URL at the deployed database first
BRAINCHILD_ADMIN_PASSWORD='YourNewStrongPass123' npm run admin:set-password --prefix server
# or restore the seeded default for the primary admin
npm run admin:reset-brainchild --prefix server
```

Supabase → Authentication → Users → *Reset password* changes only the Supabase
password and has **no effect** on the admin console.

Deeper background (GoTrue error strings, RLS, redirect handling):
`supabase/README.md`.
