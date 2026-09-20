import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

/**
 * Password hashing.
 *
 * Passwords are first run through SHA-256 so that bcrypt's 72-byte input limit
 * can never silently truncate a long passphrase, then hashed with bcrypt.
 * The digest is fixed-length hex, so verification is deterministic.
 */
export function hashPassword(plain: string): Promise<string> {
  const digest = crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
  return bcrypt.hash(digest, config.bcryptRounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    const digest = crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
    return await bcrypt.compare(digest, hash);
  } catch {
    return false;
  }
}

/** Constant-time-ish dummy comparison used to avoid user-enumeration timing leaks. */
const DUMMY_HASH = bcrypt.hashSync(
  crypto.createHash('sha256').update('brainchild-dummy-password').digest('hex'),
  4
);

export async function burnPasswordTime(plain: string): Promise<void> {
  await bcrypt.compare(
    crypto.createHash('sha256').update(plain).digest('hex'),
    DUMMY_HASH
  );
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function randomId(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Strong, memorable-by-policy password rules (no arbitrary symbol soup). */
/**
 * One-time password handed to a studio owner when they add or reset a teammate
 * account. Guarantees letters *and* digits so it always satisfies the policy.
 */
export function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const pick = (set: string, count: number) =>
    Array.from({ length: count }, () => set[crypto.randomInt(0, set.length)]).join('');
  return `${pick(alphabet, 12)}${pick(digits, 4)}`;
}

export const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456789', '12345678', 'qwerty123',
  'letmein123', 'admin12345', 'changeme123', 'iloveyou123', 'welcome12345',
  'brainchild', 'brainchild123', 'gamedev123', 'studioadmin',
]);

export interface PasswordPolicyResult {
  ok: boolean;
  problems: string[];
}

export function checkPasswordPolicy(password: string, context: string[] = []): PasswordPolicyResult {
  const problems: string[] = [];
  const lower = password.toLowerCase();

  if (password.length < 12) problems.push('Use at least 12 characters.');
  if (password.length > 200) problems.push('Use at most 200 characters.');
  if (!/[a-z]/i.test(password)) problems.push('Include at least one letter.');
  if (!/[0-9]/.test(password)) problems.push('Include at least one number.');
  if (COMMON_PASSWORDS.has(lower)) problems.push('That password is too common.');
  for (const ctx of context) {
    if (ctx && ctx.length >= 4 && lower.includes(ctx.toLowerCase())) {
      problems.push('Password must not contain your name or email.');
      break;
    }
  }
  if (/^(.)\1+$/.test(password)) problems.push('Password cannot be a single repeated character.');

  return { ok: problems.length === 0, problems };
}

export function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong', 'Excellent'];
  return { score, label: labels[Math.min(score, labels.length - 1)] };
}
