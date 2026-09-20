import { ApiError } from './api';

export interface LoginErrorInfo {
  message: string;
  hint?: string;
}

export function describeLoginError(error: unknown): LoginErrorInfo {
  if (error instanceof ApiError) {
    if (error.code === 'not_configured') {
      return { message: 'Supabase is not configured.', hint: 'Add the project URL and publishable key to the Vercel or local environment.' };
    }
    if (error.code === 'not_admin') {
      return { message: 'This account is not enabled for the studio console.', hint: 'Promote it with the SQL block in supabase/editor_setup.sql.' };
    }
    if (error.code === 'invalid_credentials') {
      return { message: error.message || 'Email or password is incorrect.', hint: 'Use Forgot password? to request a Supabase Auth recovery email.' };
    }
    return { message: error.message || 'Sign-in failed. Please try again.' };
  }
  if (error instanceof Error && error.message) return { message: error.message };
  return { message: 'Sign-in failed. Please try again.' };
}
