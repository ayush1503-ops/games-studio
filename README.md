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

The local app runs at `http://localhost:3000`. The checked-in `.env.example`
contains the current Supabase project URL and publishable key. The same public
values are configured for the Vercel build in `vercel.json`.

## Set up the database

Run [`supabase/editor_setup.sql`](supabase/editor_setup.sql) in the Supabase
SQL Editor for project `gwmljctpddazmjmrrqjy`. Then create
`abhaypoptani@gmail.com` in **Authentication → Users** with a password you
choose privately. Run the final promotion block to make that account
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
credential, or Vercel function. Configure the same redirect URLs in Supabase
Authentication settings after Vercel gives you the production domain. Vercel
will use the project URL and publishable key already present in `vercel.json`,
or you may override them with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` in the Vercel project settings.

## Useful commands

```bash
npm run dev      # Vite development server
npm run build    # production build
npm run lint     # TypeScript check
npm run preview  # preview the production build
```
