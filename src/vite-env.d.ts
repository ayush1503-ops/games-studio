/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key — safe to expose in the browser bundle. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /**
   * Optional Supabase project ref, used only to build dashboard shortcut links
   * in the admin console. Derived from VITE_SUPABASE_URL when not set.
   */
  readonly VITE_SUPABASE_PROJECT_REF?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
