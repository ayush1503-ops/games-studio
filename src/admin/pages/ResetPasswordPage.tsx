import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, MailCheck, KeyRound, ArrowRight, HelpCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { ApiError, authApi, parseRecoveryInput } from '../utils/api';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext';
import { useAuth } from '../context/AuthContext';
import { describeAuthCallbackError } from '../../lib/supabase';
import { SupabaseSetupNotice } from '../components/SupabaseSetupNotice';
import { notify } from '../utils/toast';

const MIN_PASSWORD_LENGTH = 12;

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading: supabaseLoading, configured: supabaseConfigured, passwordRecovery } = useSupabaseAuth();
  const { setUserState } = useAuth();

  // URL parameters that could have been delivered
  const urlToken = searchParams.get('token') || searchParams.get('token_hash') || '';
  const urlCode = searchParams.get('code') || '';
  const initialEmail = searchParams.get('email') || session?.user?.email || '';

  const callbackError = useMemo(() => describeAuthCallbackError(), []);

  // Form states
  const [email, setEmail] = useState(initialEmail);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showVercelHelp, setShowVercelHelp] = useState(false);

  // Sync email if session becomes available
  useEffect(() => {
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (callbackError) {
      setError(callbackError);
    }
  }, [callbackError]);

  // Determine if we already have an active verified session
  const hasActiveSession = Boolean(session?.access_token);
  const hasUrlProof = Boolean(urlToken || urlCode);

  const policyHint = useMemo(() => {
    if (!newPassword) return null;
    const problems: string[] = [];
    if (newPassword.length < MIN_PASSWORD_LENGTH) problems.push(`at least ${MIN_PASSWORD_LENGTH} characters`);
    if (!/[a-z]/i.test(newPassword)) problems.push('a letter');
    if (!/[0-9]/.test(newPassword)) problems.push('a number');
    return problems.length ? `Needs ${problems.join(', ')}.` : 'Strong password.';
  }, [newPassword]);

  const handleResendLink = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first.');
      return;
    }
    setIsResending(true);
    setError(null);
    setResendSuccess(null);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setResendSuccess(res.message || 'A new reset link has been dispatched to your email.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to resend reset link.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // If there is no active session, ensure they gave us a recovery code/link or url code
    const rawInput = recoveryInput.trim();
    if (!hasActiveSession && !hasUrlProof && !rawInput) {
      setError('Please paste the reset link or enter the 6-digit code from your email.');
      return;
    }

    setIsLoading(true);

    try {
      const proofPayload = {
        token: urlToken || undefined,
        code: urlCode || undefined,
        rawInput: rawInput || undefined,
        supabaseAccessToken: session?.access_token || undefined,
        email: email.trim() || undefined,
      };

      const result = await authApi.resetPassword(proofPayload, newPassword);

      setIsSuccess(true);
      notify('Password updated successfully! Redirecting to Admin Panel...', 'success');

      // Immediately sync AuthContext so ProtectedRoute lets them in
      if (result.admin) {
        setUserState(result.admin);
      }

      // Automatically navigate to Admin Panel
      setTimeout(() => {
        navigate('/admin', { replace: true });
      }, 1000);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'not_configured') {
          setNotConfigured(true);
        } else if (err.status === 429) {
          setError('Too many attempts. Please wait a minute and try again.');
        } else if (err.fields && err.fields.length > 0) {
          setError(err.fields.map((f) => f.message).join(' '));
        } else {
          setError(err.message || 'Failed to update password. Please check your reset code or link.');
        }
      } else {
        setError('Failed to update password. Please check your reset code or link.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-12">
      <div className="relative w-full max-w-lg">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10">
          <img
            src="/images/mascot_pix.png"
            alt="Pix"
            className="h-20 w-20 object-cover rounded-2xl border-2 border-ink shadow-lift"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 rounded-[28px] border-2 border-ink bg-cream p-7 sm:p-9 shadow-lift"
        >
          <div className="text-center mb-6 pt-4">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-ink">
              Reset Admin Password
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm font-semibold text-inksoft">
              Set your new password to enter the studio admin panel
            </p>
          </div>

          {(!supabaseConfigured || notConfigured) && <SupabaseSetupNotice />}

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border-2 border-coral bg-coral/10 px-4 py-3 text-xs sm:text-sm font-semibold text-coral"
            >
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {resendSuccess && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border-2 border-moss bg-moss/10 px-4 py-3 text-xs sm:text-sm font-semibold text-moss">
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              <div className="flex-1">{resendSuccess}</div>
            </div>
          )}

          {isSuccess ? (
            <div className="space-y-4 text-center py-4">
              <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-moss bg-moss/15 px-4 py-3 text-sm font-bold text-moss">
                <CheckCircle2 size={20} />
                Password updated successfully!
              </div>
              <p className="text-xs font-semibold text-inksoft">
                Opening your Admin Dashboard now…
              </p>
              <button
                type="button"
                onClick={() => navigate('/admin', { replace: true })}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-coral px-6 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker hover:bg-coraldeep cursor-pointer"
              >
                Go to Admin Panel <ArrowRight size={16} />
              </button>
            </div>
          ) : supabaseLoading && !hasUrlProof ? (
            <div className="flex flex-col items-center gap-3 py-8 text-sm font-semibold text-inksoft">
              <Loader2 className="animate-spin text-grape" size={30} />
              Checking authentication session…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Verified session banner */}
              {hasActiveSession ? (
                <div className="flex items-start gap-2.5 rounded-xl border-2 border-moss/40 bg-moss/10 px-4 py-3 text-xs font-semibold text-ink">
                  <MailCheck size={17} className="mt-0.5 shrink-0 text-moss" />
                  <div>
                    <span className="font-bold text-moss">Verified Recovery Session</span>
                    <p className="text-inksoft mt-0.5">
                      Account: <span className="font-bold text-grape">{session?.user?.email}</span>. Choose your new password below.
                    </p>
                  </div>
                </div>
              ) : (
                /* Non-session input fields */
                <div className="space-y-3.5 bg-paper/60 p-4 rounded-2xl border-2 border-ink/10">
                  <div className="space-y-1">
                    <label htmlFor="reset-email" className="text-[10px] font-extrabold uppercase tracking-widest text-inksoft">
                      Admin Email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@brainchild.games"
                      className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-ink focus:border-grape focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="recovery-input" className="text-[10px] font-extrabold uppercase tracking-widest text-inksoft">
                        Email Link or 6-Digit Code
                      </label>
                      <button
                        type="button"
                        onClick={handleResendLink}
                        disabled={isResending}
                        className="text-[10px] font-bold text-grape hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isResending ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                        Send new email
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-inksoft" />
                      <input
                        id="recovery-input"
                        type="text"
                        value={recoveryInput}
                        onChange={(e) => setRecoveryInput(e.target.value)}
                        placeholder="Paste link from email OR 6-digit code"
                        className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3.5 py-2.5 pl-10 text-xs sm:text-sm font-semibold text-ink placeholder-inksoft/60 focus:border-grape focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-inksoft font-medium">
                      If the email button opened Vercel, long-press or right-click &quot;Reset Password&quot; in your email, select <strong>Copy link address</strong>, and paste it here.
                    </p>
                  </div>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-1.5 pt-1">
                <label htmlFor="new-password" className="text-[10px] font-extrabold uppercase tracking-widest text-inksoft">
                  New Password (min {MIN_PASSWORD_LENGTH} chars)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-inksoft" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3.5 py-2.5 pl-10 pr-10 text-xs sm:text-sm font-semibold text-ink placeholder-inksoft/60 focus:border-grape focus:outline-none"
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    disabled={isLoading}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-inksoft hover:text-ink cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {policyHint && (
                  <p className={`text-[11px] font-bold ${policyHint === 'Strong password.' ? 'text-moss' : 'text-inksoft'}`}>
                    {policyHint}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="text-[10px] font-extrabold uppercase tracking-widest text-inksoft">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-inksoft" />
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border-2 border-ink/15 bg-cream px-3.5 py-2.5 pl-10 text-xs sm:text-sm font-semibold text-ink placeholder-inksoft/60 focus:border-grape focus:outline-none"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    disabled={isLoading}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-coral px-6 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker hover:bg-coraldeep cursor-pointer disabled:opacity-60 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Updating &amp; Opening Admin Panel…
                  </>
                ) : (
                  <>
                    Set Password &amp; Open Admin Panel <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Help accordion about Vercel redirect */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowVercelHelp(!showVercelHelp)}
                  className="w-full text-center text-[11px] font-bold text-inksoft hover:text-ink flex items-center justify-center gap-1 cursor-pointer"
                >
                  <HelpCircle size={13} />
                  {showVercelHelp ? 'Hide Supabase URL setup instructions' : 'Why did the email open a Vercel page? (Click here)'}
                </button>

                {showVercelHelp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2.5 text-left rounded-xl border-2 border-ink/10 bg-paper/80 p-3.5 text-[11px] text-ink leading-relaxed space-y-2"
                  >
                    <p className="font-bold text-ink">
                      In your Supabase Dashboard:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-inksoft font-medium">
                      <li>Go to <strong>Authentication → URL Configuration</strong>.</li>
                      <li>Change <strong>Site URL</strong> to: <br /><code className="bg-cream px-1.5 py-0.5 rounded border border-ink/15 font-mono text-[10px] text-grape">{window.location.origin}/admin/reset-password</code></li>
                      <li>Under <strong>Redirect URLs</strong>, add: <br /><code className="bg-cream px-1.5 py-0.5 rounded border border-ink/15 font-mono text-[10px] text-grape">{window.location.origin}/**</code></li>
                    </ol>
                    <p className="text-[10px] text-inksoft">
                      Once saved, all future reset emails will open directly on your active domain instead of the old Vercel URL.
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="text-center pt-1">
                <Link
                  to="/admin/login"
                  className="text-xs font-bold uppercase tracking-wider text-inksoft hover:text-ink"
                >
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};
