import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, MailCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { ApiError, authApi } from '../utils/api';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext';
import { describeAuthCallbackError, supabase } from '../../lib/supabase';

/**
 * Reset Password — the landing page of the reset email.
 *
 * Two kinds of link arrive here, and both end in the same API call:
 *
 * 1. Supabase Auth (default when the API has SUPABASE_URL + service key).
 *    `POST /api/auth/forgot-password` asks Supabase to email its recovery
 *    link. Opening it verifies the token at Supabase, which redirects back to
 *    `/admin/reset-password#access_token=…&type=recovery`. The Supabase SDK
 *    turns that into a session (`useSupabaseAuth().session`) and we send its
 *    access token to `POST /api/auth/reset-password` as
 *    `{ supabaseAccessToken, newPassword }`. The API checks the session with
 *    Supabase, confirms it was created from a recovery email, matches the
 *    email to an admin account and rotates `admin_users.password_hash`.
 *
 * 2. SMTP / console mailer (when Supabase is not configured on the API).
 *    The link looks like `/admin/reset-password?token=<48-byte token>` and
 *    we post `{ token, newPassword }` instead.
 *
 * Either way the server enforces the password policy (12+ chars, a letter and
 * a number — see `checkPasswordPolicy`), and revokes every existing session.
 * The checks below mirror that policy so the user gets feedback before a round
 * trip, but the server remains the authority.
 */
const MIN_PASSWORD_LENGTH = 12;

type Proof = { kind: 'token'; token: string } | { kind: 'supabase'; accessToken: string } | { kind: 'none' };

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading: supabaseLoading, configured: supabaseConfigured, passwordRecovery, signOut } =
    useSupabaseAuth();

  const legacyToken = searchParams.get('token') ?? '';
  /** Missing or truncated tokens can never validate — say so up front. */
  const hasLegacyToken = legacyToken.length >= 20;

  /** Supabase reported a problem with the link (expired, already used…). */
  const callbackError = useMemo(() => describeAuthCallbackError(), []);

  const proof: Proof = useMemo(() => {
    if (hasLegacyToken) return { kind: 'token', token: legacyToken };
    // Any Supabase session is *offered* as proof so a page reload after the
    // link was opened still works (the SDK strips the URL fragment and keeps
    // the session in storage). The server is the authority: it only accepts a
    // session created from a recovery email within the last hour, so a plain
    // sign-in session is rejected with a clear message.
    if (session?.access_token) return { kind: 'supabase', accessToken: session.access_token };
    return { kind: 'none' };
  }, [hasLegacyToken, legacyToken, session?.access_token]);

  // While the Supabase SDK is still reading the session out of the URL we
  // don't know yet whether this page has a valid proof — show a spinner rather
  // than a premature "invalid link" screen.
  const resolvingProof = !hasLegacyToken && supabaseConfigured && supabaseLoading && !callbackError;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (callbackError) setError(callbackError);
  }, [callbackError]);

  const policyHint = useMemo(() => {
    if (!newPassword) return null;
    const problems: string[] = [];
    if (newPassword.length < MIN_PASSWORD_LENGTH) problems.push(`at least ${MIN_PASSWORD_LENGTH} characters`);
    if (!/[a-z]/i.test(newPassword)) problems.push('a letter');
    if (!/[0-9]/.test(newPassword)) problems.push('a number');
    return problems.length ? `Needs ${problems.join(', ')}.` : 'Looks good.';
  }, [newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (proof.kind === 'none') {
      setError('This reset link is invalid or has expired. Please request a new one.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (supabase && (proof.kind === 'supabase' || session)) {
        try {
          await supabase.auth.updateUser({ password: newPassword });
        } catch (supaErr) {
          console.warn('[Supabase Auth] updateUser notice:', supaErr);
        }
      }

      await authApi.resetPassword(
        proof.kind === 'token' ? { token: proof.token } : { supabaseAccessToken: proof.accessToken },
        newPassword
      );
      setIsSuccess(true);
      // The recovery session has served its purpose; drop it on this device too
      // (the API already revoked it at Supabase — this just clears local storage).
      if (proof.kind === 'supabase') void signOut();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError('Too many attempts. Please wait a minute and try again.');
        } else if (err.status === 503) {
          setError(err.message || 'The studio server cannot verify the link right now. Please try again shortly.');
        } else if (err.fields.length > 0) {
          setError(err.fields.map((field) => field.message).join(' '));
        } else {
          // 400 invalid_reset_token ⇒ the link was used, tampered with, or expired.
          setError(err.message || 'Failed to reset password. The link may be invalid or expired.');
        }
      } else {
        setError('Failed to reset password. The link may be invalid or expired.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="relative w-full max-w-md">
        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
          <img src="/images/mascot_pix.png" alt="Pix" className="h-24 w-24 object-cover rounded-2xl border-2 border-ink shadow-lift" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-12 rounded-[28px] border-2 border-ink bg-cream p-8 shadow-lift"
        >
          <div className="text-center mb-6">
            <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink">
              Create New Password
            </h1>
            <p className="mt-2 text-sm font-medium text-inksoft">
              Set a secure password for your admin account
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border-2 border-coral bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {isSuccess ? (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-moss bg-moss/10 px-4 py-3 text-sm font-semibold text-moss">
                <CheckCircle2 size={18} />
                Password reset successful! Every other device has been signed out.
              </div>
              <button
                onClick={() => navigate('/admin/login')}
                className="w-full rounded-xl border-2 border-ink bg-coral px-6 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker hover:bg-coraldeep cursor-pointer"
              >
                Go to Sign In
              </button>
            </div>
          ) : resolvingProof ? (
            <div className="flex flex-col items-center gap-3 py-6 text-sm font-semibold text-inksoft" role="status">
              <Loader2 className="animate-spin text-grape" size={28} />
              Verifying your reset link…
            </div>
          ) : proof.kind !== 'none' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {proof.kind === 'supabase' && session?.user?.email && (
                <div className="flex items-start gap-2 rounded-xl border-2 border-moss/40 bg-moss/10 px-4 py-3 text-xs font-semibold text-ink">
                  <MailCheck size={16} className="mt-0.5 shrink-0 text-moss" />
                  <span>
                    {passwordRecovery ? 'Reset link verified for ' : 'Reset session found for '}
                    <span className="text-grape">{session.user.email}</span>. Choose the new password for the studio
                    admin console below.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="new-password" className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
                  New Password (min {MIN_PASSWORD_LENGTH} chars)
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-inksoft" aria-hidden="true" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border-2 border-ink/15 bg-cream px-4 py-3 pl-11 pr-11 text-sm font-semibold text-ink placeholder-inksoft/60 focus:border-grape focus:outline-none"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={isLoading}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    aria-describedby="password-policy"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-inksoft hover:text-ink cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {policyHint && (
                  <p
                    id="password-policy"
                    className={`mt-1 text-[11px] font-bold ${policyHint === 'Looks good.' ? 'text-moss' : 'text-inksoft'}`}
                  >
                    {policyHint}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-inksoft" aria-hidden="true" />
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border-2 border-ink/15 bg-cream px-4 py-3 pl-11 text-sm font-semibold text-ink placeholder-inksoft/60 focus:border-grape focus:outline-none"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={isLoading}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-coral px-6 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker hover:bg-coraldeep cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Resetting…
                  </>
                ) : (
                  'Set New Password'
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/admin/login"
                  className="text-xs font-bold uppercase tracking-wider text-inksoft hover:text-ink"
                >
                  Cancel &amp; Return to Login
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="rounded-xl border-2 border-ink/15 bg-paper/60 px-4 py-3 text-sm font-semibold text-inksoft">
                {callbackError
                  ? 'Reset links can only be used once and expire after a short while.'
                  : 'This page needs a reset link from your email. Request a new one and open the link it sends.'}
              </div>
              <Link
                to="/admin/forgot-password"
                className="inline-flex items-center justify-center w-full rounded-xl border-2 border-ink bg-grape px-6 py-3 text-sm font-extrabold uppercase text-white shadow-sticker"
              >
                Request a new reset link
              </Link>
              <Link
                to="/admin/login"
                className="text-xs font-bold uppercase tracking-wider text-inksoft hover:text-ink"
              >
                Back to Sign In
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
