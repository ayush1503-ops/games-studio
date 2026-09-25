/**
 * Base-aware URL helper for files that live in `public/` (images, favicon…).
 *
 * Vite serves the app from `import.meta.env.BASE_URL`, which is `/` for a
 * domain-root install and `/subfolder/` when the site is deployed under a
 * subdirectory (common on cPanel: `public_html/studio/`). Building every
 * public-asset URL through this helper keeps images working in both cases,
 * on every client-side route depth (`/`, `/admin/login`, …).
 *
 * Remote (`http…`), `data:` and `blob:` URLs pass through untouched.
 */
export const assetUrl = (path: string): string => {
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return path;
  const base = import.meta.env.BASE_URL ?? '/';
  const clean = path.replace(/^\/+/, '');
  return `${base.replace(/\/?$/, '/')}${clean}`;
};

export default assetUrl;
