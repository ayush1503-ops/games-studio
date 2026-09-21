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
      return { message: 'This account is not enabled for the studio console.', hint: 'Ask a studio owner or check the admin_users table in Supabase.' };
    }
    if (error.code === 'invalid_credentials') {
      return { message: error.message || 'Email or password is incorrect.', hint: 'Use Forgot password? to request a Supabase Auth recovery email.' };
    }
    if (error.code === 'network_error' || error.status === 0) {
      return { message: 'Unable to reach the Supabase server.', hint: 'Check your network connection and Supabase project status.' };
    }
    return { message: error.message || 'Sign-in failed. Please try again.' };
  }
  if (error instanceof Error && error.message) {
    if (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('networkerror')) {
      return { message: 'Unable to reach the Supabase server.', hint: 'Check your internet connection and Supabase project status.' };
    }
    return { message: error.message };
  }
  return { message: 'Sign-in failed. Please try again.' };
}
