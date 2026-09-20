/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://xxxxxxxxxxxx.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key — safe to expose in the browser bundle. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Where the Vite dev server proxies /api and /uploads to (Express backend). */
  readonly VITE_API_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
