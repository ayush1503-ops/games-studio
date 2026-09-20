import { createRequire } from 'node:module';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { redact } from '../utils/logger.js';

interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

type Nodemailer = typeof import('nodemailer');

/**
 * Loads nodemailer at runtime with a bundler-opaque module name.
 *
 * Why: a static `import('nodemailer')` would make the serverless bundler inline
 * nodemailer + iconv-lite (~700 KB) into the Vercel function. Requiring it by a
 * computed name keeps it out of the bundle graph, while `nodemailer` still
 * lives in the root `package.json` `dependencies`, so `npm ci` installs it and
 * Vercel's function tracing ships it in `node_modules` alongside the handler.
 *
 * If the package is somehow not resolvable, the mailer degrades gracefully
 * (logged, no crash) rather than taking the request down with it.
 */
function loadNodemailer(): Nodemailer | null {
  try {
    const require = createRequire(import.meta.url);
    const moduleName = ['node', 'mailer'].join('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = require(moduleName) as any;
    return (mod?.default ?? mod) ?? null;
  } catch {
    return null;
  }
}

/**
 * Can this deployment actually put mail on the wire?
 *
 * This is a property of the *deployment* (env vars + package availability), not
 * of the address being mailed, so it is safe to return to an anonymous caller
 * without leaking which emails have accounts.
 *
 * It exists because `sendMail` deliberately never tells a caller that delivery
 * failed for a specific address: without this, a misconfigured deployment makes
 * the reset form promise an email that will never arrive, and the only evidence
 * is a server-side log line nobody is watching.
 */
export function mailTransportReady(): { ready: boolean; transport: string; reason?: string } {
  const transport = config.mail.transport;

  if (transport === 'console') {
    // Dev prints the message (and the link) to the server log.
    return {
      ready: !config.isProduction,
      transport,
      reason: config.isProduction ? 'console_transport_in_production' : undefined,
    };
  }

  if (!config.mail.smtpHost) {
    return { ready: false, transport, reason: 'smtp_not_configured' };
  }
  if (!loadNodemailer()) {
    return { ready: false, transport, reason: 'nodemailer_missing' };
  }
  return { ready: true, transport };
}

/**
 * Pluggable mail transport.
 *
 * - `console` (development default): prints the message server-side so a reset
 *   link can be picked up from the API logs without any SMTP account.
 * - `smtp`: lazy-loads nodemailer when credentials are configured. If SMTP is
 *   requested in production but not configured, the mailer reports failure and
 *   the caller responds with the same generic success message (no enumeration).
 */
export async function sendMail(message: MailMessage): Promise<{ delivered: boolean; reason?: string }> {
  if (config.mail.transport === 'console') {
    logger.info('Outbound email (console transport)', {
      to: message.to,
      subject: message.subject,
      body: String(redact(message.text)).slice(0, 1000),
    });
    return { delivered: !config.isProduction, reason: 'console_transport' };
  }

  if (!config.mail.smtpHost) {
    logger.warn('SMTP transport selected but SMTP_HOST is not configured; email dropped', {
      subject: message.subject,
    });
    return { delivered: false, reason: 'smtp_not_configured' };
  }

  try {
    const nodemailer = loadNodemailer();
    if (!nodemailer) {
      logger.error('nodemailer is not available in this runtime; SMTP mail disabled (local dev: `npm install nodemailer` in server/)');
      return { delivered: false, reason: 'nodemailer_missing' };
    }

    const transporter = nodemailer.createTransport({
      host: config.mail.smtpHost,
      port: config.mail.smtpPort,
      secure: config.mail.smtpPort === 465,
      auth:
        config.mail.smtpUser && config.mail.smtpPassword
          ? { user: config.mail.smtpUser, pass: config.mail.smtpPassword }
          : undefined,
    });

    await transporter.sendMail({
      from: config.mail.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { delivered: true };
  } catch (error) {
    logger.error('SMTP delivery failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { delivered: false, reason: 'smtp_error' };
  }
}

export function passwordResetEmail(resetUrl: string, minutes: number) {
  return {
    subject: 'Reset your Brainchild Studio password',
    text: [
      'A password reset was requested for your Brainchild Studio account.',
      '',
      `Open this link to choose a new password (valid for ${minutes} minutes):`,
      resetUrl,
      '',
      'If you did not request this, you can safely ignore this email — your password stays unchanged.',
    ].join('\n'),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6">
        <h2 style="margin:0 0 12px">Reset your studio password</h2>
        <p>A password reset was requested for your Brainchild Studio account.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#6C4CF1;color:#fff;text-decoration:none;font-weight:700">
            Choose a new password
          </a>
        </p>
        <p style="color:#6d6577;font-size:13px">The link is valid for ${minutes} minutes and can be used once.
        If you did not request this, ignore this email — your password stays unchanged.</p>
      </div>
    `,
  };
}

export function newAdminInviteEmail(loginUrl: string, role: string, inviter: string) {
  return {
    subject: 'You have been added to the Brainchild Studio console',
    text: [
      `${inviter} added you to the Brainchild Studio console as ${role}.`,
      '',
      `Sign in here: ${loginUrl}`,
      '',
      'Ask them for your temporary password, then change it after your first sign-in.',
    ].join('\n'),
  };
}
