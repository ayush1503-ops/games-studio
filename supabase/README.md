# Supabase setup for Brainchild Games

This directory contains the Supabase integration that powers the **public
site** (newsletter signup, contact form, player auth, wishlists, and live
reads of published content). The Express + Drizzle backend in `server/`
continues to handle the admin/CMS API unchanged.

## 1. Configure env

The project is `kxirdoacrphluervussu` — its URL is
`https://kxirdoacrphluervussu.supabase.co` (the project *ref* is the subdomain;
the publishable key `sb_publishable_…` is **not** part of the URL).

Keys live in two git-ignored files (copy from the `.env.example` next to each):

| File | Variables | Which key |
| --- | --- | --- |
| `/.env.local` (browser bundle) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | publishable / anon key only |
| `/server/.env` (API) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `STORAGE_DRIVER=supabase` | service-role key stays here |

On Vercel set the same names in **Project → Settings → Environment Variables**
(the `VITE_` pair is inlined at build time; the rest is read by the API at
runtime). Dashboard location of the keys: **Project Settings → API Keys**.

> ⚠️ Never put the **service-role** key in a `VITE_` variable — that key
> bypasses RLS and must stay on the server. Rotate it in the dashboard if it
> was ever pasted into a chat, a ticket or a commit.

## 2. Apply the SQL migrations

Open your Supabase project dashboard → **SQL Editor**, and run, in order:

1. `supabase/migrations/0001_init_schema.sql` — tables, functions, RLS, storage buckets
2. `supabase/migrations/0002_seed.sql` — starter categories, settings, one sample job
3. `supabase/migrations/0004_add_media_bucket.sql` — public `media` bucket for uploads
4. `supabase/migrations/0005_add_brainchild_admin.sql` — primary-admin promotion trigger
5. `supabase/migrations/0006_harden_primary_admin_trigger.sql` — **run this even if
   0005 was applied long ago.** The original 0005 trigger fired `BEFORE INSERT`
   on `auth.users` and inserted into tables that reference `auth.users(id)`, so
   creating `brainchildgamesin@gmail.com` (and only that address) failed with
   "Database error creating new user". 0006 replaces it with an `AFTER INSERT`,
   exception-guarded version.

If you use the Supabase CLI you can instead run `supabase db push`.

## 3. Create your first admin

Primary studio admin `brainchildgamesin@gmail.com` is always valid as SUPER_ADMIN (auto-promoted by migrations).

1. In **Authentication → Users**, click *Add user* and create `brainchildgamesin@gmail.com` with a strong password (or your own email).
2. Back in the SQL Editor, promote yourself to SUPER_ADMIN (if you used a different email, or to ensure primary admin):

   ```sql
   -- Primary admin (always valid)
   INSERT INTO admin_users (id, name, role, is_active)
   SELECT id, 'Brainchild Games', 'SUPER_ADMIN', true
   FROM auth.users WHERE email = 'brainchildgamesin@gmail.com'
   ON CONFLICT (id) DO UPDATE SET role = 'SUPER_ADMIN', is_active = true;

   -- Additional admin (example)
   INSERT INTO admin_users (id, name, role, is_active)
   SELECT id, 'Studio Admin', 'SUPER_ADMIN', true
   FROM auth.users WHERE email = 'you@brainchild.games';
   ```

## 4. (Optional) Enable OAuth providers

In **Authentication → Providers**, enable Google / GitHub / Discord / Apple
as desired — the frontend already supports them through
`useSupabaseAuth().signInWithOAuth('google')`.

## What's in the frontend

| File | Purpose |
| --- | --- |
| `src/lib/supabase.ts` | Singleton browser Supabase client (anon key). Safe no-op if env is missing. |
| `src/context/SupabaseAuthContext.tsx` | React context: `useSupabaseAuth()` exposes `user`, `session`, `signIn`, `signUp`, `signOut`, `signInWithOAuth`, `resetPasswordForEmail`, `updatePassword`. Mounted at the root in `App.tsx`. |
| `src/lib/supabase-public.ts` | Helpers for the public site: `subscribeNewsletter()`, `submitContactMessage()`, `fetchPublishedNews()`, `fetchPublishedGames()`. |

### Quick example

```tsx
import { useSupabaseAuth } from './context/SupabaseAuthContext';
import { subscribeNewsletter } from './lib/supabase-public';

function SignupBox() {
  const { user, signInWithOAuth, signOut } = useSupabaseAuth();
  return user ? (
    <button onClick={signOut}>Sign out</button>
  ) : (
    <button onClick={() => signInWithOAuth('google')}>Sign in with Google</button>
  );
}
```

## RLS summary (built into 0001_init_schema.sql)

| Role | Can do |
| --- | --- |
| `anon` (not logged in) | Read published games/news, open jobs, categories, public content blocks, media. Insert into `subscribers`, `contact_messages`. Call `increment_view`, `unsubscribe`. |
| Authenticated player | All anon permissions. Read/update their own `profiles` row, manage their `wishlists`, upload their own avatar. |
| Studio editor / admin / super-admin | Full CRUD on every table plus upload/delete in all storage buckets. |

## Admin password reset: Supabase Auth carries the email, the API owns the password

This is the most important thing to know before debugging a broken reset link.

| Flow | Credential store | Who sends the email |
| --- | --- | --- |
| **Admin console** (`/admin/login`) | `admin_users.password_hash` (bcrypt) in the API's Postgres | Supabase Auth (recovery email) when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise the API's SMTP mailer |
| Public site / players | Supabase `auth.users` | Supabase Auth, from the browser |

The two stores are different: an older version of the console called
`supabase.auth.resetPasswordForEmail` from the browser and then
`updateUser({ password })`, which changed the **Supabase** password while
`/api/auth/login` kept checking `admin_users` — the link "worked" and you still
could not sign in. The current flow keeps Supabase as the *mail carrier* only:

1. `POST /api/auth/forgot-password` — the API looks the address up in
   `admin_users`. For a real admin it makes sure a confirmed user with the same
   email exists in Supabase Auth (created with the service-role key on first
   use, reused afterwards) and asks Supabase to send its **Reset Password**
   email with `redirect_to = <APP_BASE_URL>/admin/reset-password`. Unknown
   addresses get the identical response and never touch Supabase.
2. The email link goes to Supabase (`/auth/v1/verify`), which redirects to
   `/admin/reset-password#access_token=…&type=recovery`. The Supabase browser
   client turns that into a session and fires `PASSWORD_RECOVERY`.
3. `ResetPasswordPage` posts `{ supabaseAccessToken, newPassword }` to
   `POST /api/auth/reset-password`. The API verifies the token **server-side**
   (`GET /auth/v1/user` with the service-role key), requires `amr` to contain a
   `recovery` entry newer than `RECOVERY_SESSION_MAX_AGE_MINUTES` (60), requires
   the email to belong to an active admin, rotates `admin_users.password_hash`,
   revokes every other console session **and** the Supabase session, and writes
   `PASSWORD_RESET_COMPLETED` to the audit log. Replays, `password`-login
   sessions, forged JWTs and stale sessions are all rejected with `400`.

Without Supabase configured (`PASSWORD_RESET_CHANNEL=smtp`, or no
`SUPABASE_URL`) the API falls back to its own single-use token link
(`/admin/reset-password?token=…`) delivered over SMTP — or printed to the log
in development. `POST /api/auth/reset-password` accepts exactly one proof per
request: `token` *or* `supabaseAccessToken`.

### Dashboard checklist for the reset email (one-time)

1. **Authentication → URL Configuration**
   - Site URL: `https://www.brainchildapp.com`
   - Redirect URLs: `https://www.brainchildapp.com/admin/reset-password` and
     `http://localhost:3000/admin/reset-password` (Supabase silently falls back
     to the Site URL when `redirect_to` is not on this list — the link then
     lands on the homepage instead of the reset form).
2. **Authentication → Emails → Templates → Reset Password** must keep
   `{{ .ConfirmationURL }}` (or the equivalent `{{ .SiteURL }}`-free token link).
3. **Email delivery.** Supabase's built-in mailer is rate-limited (a few emails
   per hour) and **only delivers to email addresses that are members of the
   Supabase organisation/project** — invite `brainchildgamesin@gmail.com` under
   **Organization → Team** or configure a real provider under
   **Authentication → SMTP Settings** (Resend, Postmark, SES…). Custom SMTP
   removes both limits.
4. **Authentication → Rate Limits**: "Rate limit for sending emails" defaults
   to 2 per hour without custom SMTP. Raise it once SMTP is configured.
5. Run `supabase/migrations/0006_harden_primary_admin_trigger.sql` (see §2) so
   the auth user for the primary admin can actually be created.

### Verifying it end to end

- Production: on `/admin/forgot-password` submit `brainchildgamesin@gmail.com`,
  open the "Reset Password" email, set a new password, sign in at
  `/admin/login`. The API log shows `Password reset requested … delivered:true`
  (or `Password reset email was not delivered` with a `reason` such as
  `rate_limited`, `create_user_failed:…` or `network_error`) and the
  **Activity** page in the console shows `PASSWORD_RESET_REQUESTED` /
  `PASSWORD_RESET_COMPLETED`.
- Locally without an inbox: `server/.env` has `DEV_EXPOSE_RESET_LINK=true`, so
  the forgot-password response contains the link (`devResetUrl`) and the
  forgot-password page renders it. Set it to `false` to make Supabase really
  send the email to your inbox.
- Offline regression test:
  `npm run dev:fake-auth --prefix server` (stand-in for Supabase Auth on
  `127.0.0.1:54321`), then start the API with
  `SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=test-service-role-key STORAGE_DRIVER=local RATE_LIMIT_RESET_MAX=200`,
  then `npm run reset-flow:test --prefix server`.

Supabase is also used by this project for the public site (newsletter,
contact form, published content, storage), so the rest of this file still
applies.

## Troubleshooting: "Unable to process request" from Supabase Auth

The full client-side error looks like this:

```
AuthApiError: Unable to process request
status: 500, code: 'unexpected_failure'
Failed to make POST request to "https://<ref>.supabase.co/auth/v1/recover"
```

The response body is `{"code":500,"error_code":"unexpected_failure",
"msg":"Unable to process request","error_id":"…"}`.

**It is a generic, redacted 500 — not a diagnosis.** The string is hard-coded in
`supabase/auth` at `internal/api/recover.go`, and in the versions that were live
throughout 2024 (refs `4392a08d68`, `285c290adf`) *two* different branches
returned it:

1. `models.FindUserByEmailAndAudience` returned an error other than
   "not found" — a real database error while reading `auth.users` (the query is
   `tx.Eager().Q().Where(...).First(obj)`, so an eagerly loaded association such
   as `auth.identities` failing also lands here).
2. **The recovery-email transaction failed — i.e. SMTP delivery blew up.**
   `sendPasswordRecovery` errors were swallowed by a blanket
   `return internalServerError("Unable to process request")`.

Since ref `f3a28d182d` (Sept 2024) branch 2 returns the underlying error, so
newer projects report SMTP problems as `Error sending recovery email` instead.
Which string you see therefore depends on the GoTrue build your project runs.

### What it is NOT

- **Not a missing account.** If the email does not exist, `recover.go` returns
  `200 OK` with `{}` — the request *succeeds*. "The user is in a different
  Supabase project" cannot produce this error.
- **Not duplicate rows.** `findUser` (`internal/models/user.go`) uses
  `.First()`, which returns the first match and does not error when several
  rows share an address. The query is also `LOWER(email) = ?`, so letter case
  is irrelevant.
- **Not Vercel, CSP or this repo's API.** The browser talks to
  `*.supabase.co` directly; `vercel.json` only allows it via
  `connect-src https://*.supabase.co`.

### How to find the real cause

1. **Supabase dashboard → Logs → Auth logs.** The 500 is logged with the
   internal error attached (`observability.LogEntrySetField(r, "error", …)`).
   That one line tells you definitively whether it was SMTP or the database.
2. **Project Settings → Auth → SMTP.** If a custom SMTP host is configured,
   this is by far the most common cause: rejected credentials, a leading space
   in the username, a blocked port, or an expired TLS certificate on the
   provider. Temporarily switch back to Supabase's built-in email service — if
   the reset starts working, the custom SMTP is the problem.
3. **Auth → Email Templates → Reset Password.** A broken template also fails
   the send.
4. **Retry once or twice** before assuming a config problem; transient
   infrastructure errors do occur.

### Getting back in right now

Reset the password directly in the dashboard: **Authentication → Users → your
email → Reset password**. No email is involved, so a broken SMTP setup cannot
block it. Note that this changes the **Supabase** password — it will not change
the admin console password, which lives in `admin_users`. For that, use
`npm run admin:set-password --prefix server`.

## Site URL and redirect allow-list

These are set from the dashboard (**Authentication → URL Configuration**) or
from `supabase/config.toml` when you use config-as-code. See
`0003_auth_email_setup.sql` for the SQL that *is* safe to run.
