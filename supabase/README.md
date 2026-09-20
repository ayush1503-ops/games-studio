# Supabase setup

This repository uses one backend: Supabase Auth, Postgres, RLS and Storage.

## SQL Editor

1. Open the Supabase project `gwmljctpddazmjmrrqjy`.
2. Open **SQL Editor → New query**.
3. Paste and run [`editor_setup.sql`](./editor_setup.sql).
4. Open **Authentication → Users → Add user** and create your own studio account.
   Choose the password privately in Supabase Auth; no password is stored in this
   repository or in the SQL file.
5. Run the bottom promotion block for `abhaypoptani@gmail.com` (change only
   the display name if you want a different label).
6. Confirm the final query returns your row with `SUPER_ADMIN` and `is_active = true`.

The script is safe to keep in the project as the database setup reference. It
creates the catalog, newsroom, careers, contact/newsletter tables, CMS content,
media metadata, storage buckets and RLS policies. Anonymous visitors can read
published content and submit forms; only an active row in `admin_users` can use
the studio console.

## Browser configuration

Local development reads `.env.local`:

```bash
VITE_SUPABASE_URL=https://gwmljctpddazmjmrrqjy.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

The publishable key may be included in the browser bundle. Never add a
`service_role` key or any other secret to a `VITE_` variable or to Git.
Vercel's `vercel.json` already points the production build at this project.

## Auth redirect URLs

In **Authentication → URL Configuration**, add the Vercel production URL and
its `/admin/reset-password` path to **Redirect URLs**, plus the local URL when
developing:

- `https://YOUR-VERCEL-DOMAIN.vercel.app/**`
- `http://localhost:3000/**`

Password recovery is handled by Supabase Auth. If recovery email is not
arriving, check **Authentication → SMTP** and the project's email rate limits.
The app never exposes a default password or a password-reset token.
