import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { notify } from '../utils/toast';
import { describeLoginError, type LoginErrorInfo } from '../utils/login-error';
import { ApiError } from '../utils/api';
import { isSupabaseConfigured } from '../../lib/supabase';
import { SupabaseSetupNotice } from '../components/SupabaseSetupNotice';
import { assetUrl } from '../../utils/asset';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

type LoginForm = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginErrorInfo | null>(null);
  const [notConfigured, setNotConfigured] = useState(!isSupabaseConfigured());
  const supabaseConfigured = isSupabaseConfigured();

  const from = (location.state as { from?: Location })?.from?.pathname || '/admin';

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      await login(data.email, data.password);
      notify('Welcome back!', 'success');
      navigate(from, { replace: true });
    } catch (err) {
      // Show what actually went wrong (wrong password, rate limit, lockout,
      // unreachable API) instead of always blaming the credentials.
      if (err instanceof ApiError && err.code === 'not_configured') {
        setNotConfigured(true);
        setError(null);
      } else {
        setError(describeLoginError(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="relative w-full max-w-md">
        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
          <img src={assetUrl("/images/mascot_pix.png")} alt="Pix" className="h-24 w-24 object-cover rounded-2xl border-2 border-ink shadow-lift" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 rounded-[28px] border-2 border-ink bg-cream p-8 shadow-lift"
        >
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-ink">
              Studio Admin
            </h1>
            <p className="mt-2 text-sm font-medium text-inksoft">
              Sign in to manage your game studio
            </p>
          </div>

          {(notConfigured || !supabaseConfigured) && <SupabaseSetupNotice />}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="mb-6 flex items-start gap-2 rounded-xl border-2 border-coral bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>
                {error.message}
                {error.hint && (
                  <span className="mt-1 block text-xs font-medium text-coral/80">{error.hint}</span>
                )}
              </span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-inksoft" aria-hidden="true" />
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={`w-full rounded-xl border-2 bg-cream px-4 py-3 pl-11 text-sm font-semibold text-ink placeholder-inksoft/60 transition-colors focus:border-grape focus:outline-none ${
                    errors.email ? 'border-coral' : 'border-ink/15'
                  }`}
                  placeholder="admin@brainchild.games"
                  disabled={isLoading}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                  <p id="email-error" className="mt-1 text-[11px] font-bold text-coral" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[11px] font-extrabold uppercase tracking-widest text-inksoft">
                  Password
                </label>
                <Link to="/admin/forgot-password" className="text-[11px] font-bold uppercase tracking-wider text-grape hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-inksoft" aria-hidden="true" />
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`w-full rounded-xl border-2 bg-cream px-4 py-3 pl-11 pr-11 text-sm font-semibold text-ink placeholder-inksoft/60 transition-colors focus:border-grape focus:outline-none ${
                    errors.password ? 'border-coral' : 'border-ink/15'
                  }`}
                  placeholder="••••••••"
                  disabled={isLoading}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-inksoft hover:text-ink cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                {errors.password && (
                  <p id="password-error" className="mt-1 text-[11px] font-bold text-coral" role="alert">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="group w-full flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-coral px-6 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-sticker transition-all hover:-translate-y-0.5 hover:bg-coraldeep hover:shadow-[5px_5px_0_0_var(--color-ink)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sticker cursor-pointer"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="transition-transform group-hover:translate-x-0.5" />
                  Sign in
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs font-medium text-inksoft">
              Brainchild Games — Independent Studio Admin
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ink/50">
              Secure access · httpOnly cookies · JWT tokens
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};