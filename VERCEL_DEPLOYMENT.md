# Deploying Brainchild Games to Vercel 🚀

This repository is fully configured for seamless, zero-config deployment to **Vercel** with both the **Vite React frontend** and the **Express/Node.js Serverless API (`/api/*`)**.

---

## ⚡ Quick Start: Deploy in 2 Minutes

### Method 1: Deploy via GitHub (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Vercel deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/brainchild-games.git
   git push -u origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in.
   - Click **"Add New..."** → **"Project"**.
   - Select your `brainchild-games` repository and click **"Import"**.

3. **Verify Settings** (Vercel reads `vercel.json` automatically):
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

4. **Environment Variables**:
   Add the following under **Environment Variables** in the Vercel project setup:

   | Variable | Value | Description |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://kxirdoacrphluervussu.supabase.co` | Your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | *(Your Supabase anon key)* | Your Supabase public API key |
   | `DATABASE_URL` *(optional)* | `postgresql://...` | Supabase Postgres URI for serverless database queries & auto-migrations |
   | `JWT_SECRET` *(optional)* | *(random 32-char string)* | Session encryption key |
   | `JWT_REFRESH_SECRET` *(optional)* | *(random 32-char string)* | Refresh token encryption key |
   | `ADMIN_EMAIL` *(optional)* | `brainchildgamesin@gmail.com` | Primary studio admin email |

5. Click **"Deploy"**!

---

### Method 2: Deploy via Vercel CLI

If you prefer terminal deployment:

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy to preview
vercel

# 4. Deploy to production
vercel --prod
```

---

## 🛠 How It Works on Vercel

1. **Vite Single Page Application (SPA)**:
   - Compiled into static assets in `dist/`.
   - Served via Vercel's Edge Network with caching.
   - Client-side routing is handled via SPA rewrite rules in `vercel.json`.

2. **Serverless API Backend (`/api/*`)**:
   - The Express backend is compiled into Node.js serverless functions located at `api/[...path].ts`.
   - All `/api/*` requests (authentication, games CRUD, news, subscribers, customer inquiries, etc.) route directly to the serverless function.
   - The `/health` route is accessible at `https://your-app.vercel.app/health` or `https://your-app.vercel.app/api/health`.

3. **Automated Database Migrations**:
   - When you provide `DATABASE_URL`, Vercel runs database migrations during the deployment build.
   - If `DATABASE_URL` is omitted, the build skips migrations gracefully without failing.

4. **Admin Dashboard**:
   - Access the studio console at `https://your-domain.vercel.app/admin`.
   - Default credentials:
     - **Email**: `brainchildgamesin@gmail.com`
     - **Password**: `Brainchild@2026`
