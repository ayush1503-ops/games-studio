import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Session, User, AuthError, AuthResponse } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  isPasswordRecoveryCallback,
  hasAuthCallbackError,
} from '../lib/supabase';

/**
 * React context that wraps the Supabase Auth client.
 *
 * Gives every component in the tree access to:
 *   - current Supabase user/session (null when signed out or not configured)
 *   - loading state (true while initial session is being resolved)
 *   - helpers: signIn, signUp, signOut, signInWithOAuth, resetPasswordForEmail
 *
 * When Supabase is not configured (missing env vars) the provider renders as a
 * safe no-op: `user`/`session` are null, helpers are no-ops that reject with a
 * descriptive error, and the rest of the app keeps working.
 */

export interface SupabaseAuthContextValue {
  /** True once we've finished reading the initial session from storage. */
  loading: boolean;
  /** Currently signed-in Supabase user, or null. */
  user: User | null;
  /** Current Supabase session (access token, refresh token, etc.), or null. */
  session: Session | null;
  /** True if VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set. */
  configured: boolean;
  /**
   * True when the current session was created by opening a password-recovery
   * email link (Supabase's `PASSWORD_RECOVERY` event, or a recovery callback
   * in the URL on this page load). Cleared on sign-out.
   */
  passwordRecovery: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signInWithOAuth: (
    provider: 'google' | 'github' | 'discord' | 'apple',
    redirectTo?: string
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPasswordForEmail: (email: string, redirectTo?: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
}

const NotConfiguredError = new Error(
  'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.'
);

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(configured);
  const [user, setUser] = useState<User | null>(null);
  // Seeded from the URL so the flag is correct even if the SDK's
  // PASSWORD_RECOVERY event fires before this provider subscribes.
  const [passwordRecovery, setPasswordRecovery] = useState<boolean>(() => configured && isPasswordRecoveryCallback());

  // First mount: pull initial session, then subscribe to auth state changes.
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback<SupabaseAuthContextValue['signUp']>(
    async (email, password, metadata) => {
      if (!supabase) return { data: { user: null, session: null }, error: NotConfiguredError as AuthError };
      return supabase.auth.signUp({
        email,
        password,
        options: { data: metadata, emailRedirectTo: window.location.origin },
      });
    },
    []
  );

  const signIn = useCallback<SupabaseAuthContextValue['signIn']>(
    async (email, password) => {
      if (!supabase) return { data: { user: null, session: null }, error: NotConfiguredError as AuthError };
      return supabase.auth.signInWithPassword({ email, password });
    },
    []
  );

  const signInWithOAuth = useCallback<SupabaseAuthContextValue['signInWithOAuth']>(
    async (provider, redirectTo) => {
      if (!supabase) return { error: NotConfiguredError as AuthError };
      return supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo ?? window.location.origin },
      });
    },
    []
  );

  const signOut = useCallback<SupabaseAuthContextValue['signOut']>(async () => {
    if (!supabase) return { error: NotConfiguredError as AuthError };
    const result = await supabase.auth.signOut();
    return result;
  }, []);

  const resetPasswordForEmail = useCallback<SupabaseAuthContextValue['resetPasswordForEmail']>(
    async (email, redirectTo) => {
      if (!supabase) return { error: NotConfiguredError as AuthError };
      const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
      return supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo ?? `${window.location.origin}${basePath}admin/reset-password`,
      });
    },
    []
  );

  const updatePassword = useCallback<SupabaseAuthContextValue['updatePassword']>(async (newPassword) => {
    if (!supabase) return { error: NotConfiguredError as AuthError };
    return supabase.auth.updateUser({ password: newPassword });
  }, []);

  const value = useMemo<SupabaseAuthContextValue>(
    () => ({
      loading,
      user,
      session,
      configured,
      passwordRecovery,
      signUp,
      signIn,
      signInWithOAuth,
      signOut,
      resetPasswordForEmail,
      updatePassword,
    }),
    [
      loading,
      user,
      session,
      configured,
      passwordRecovery,
      signUp,
      signIn,
      signInWithOAuth,
      signOut,
      resetPasswordForEmail,
      updatePassword,
    ]
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

/** Hook for components to read the Supabase auth context. */
export function useSupabaseAuth(): SupabaseAuthContextValue {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) {
    throw new Error('useSupabaseAuth must be used within a <SupabaseAuthProvider>');
  }
  return ctx;
}

/**
 * Sends a password-recovery landing to the reset screen, wherever it arrived.
 *
 * The link in Supabase's email redirects to `redirect_to` only when that URL
 * is on the project's redirect allow-list; otherwise Supabase falls back to the
 * project's Site URL (usually the home page). Mount this once inside the router
 * so a recovery session — or a "link expired" error — that lands on any route
 * is carried to `/admin/reset-password`, where the page knows what to do.
 */
export function PasswordRecoveryRedirect({ to = '/admin/reset-password' }: { to?: string }) {
  const { passwordRecovery, configured } = useSupabaseAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!configured) return;
    if (location.pathname.startsWith(to)) return;
    if (passwordRecovery || hasAuthCallbackError()) {
      navigate({ pathname: to, hash: window.location.hash }, { replace: true });
    }
  }, [configured, passwordRecovery, location.pathname, navigate, to]);

  return null;
}

/** Convenience hook: returns the current access token (for attaching to API calls). */
export function useSupabaseAccessToken(): string | null {
  const { session } = useSupabaseAuth();
  return session?.access_token ?? null;
}
