/**
 * End-to-end test of the admin password-reset flow with Supabase Auth as the
 * email carrier — runs fully offline against the fake GoTrue in
 * `scripts/fake-gotrue.mjs`.
 *
 *   # terminal 1 — the stand-in for Supabase Auth
 *   SUPABASE_SERVICE_ROLE_KEY=test-service-role-key npm run dev:fake-auth --prefix server
 *
 *   # terminal 2 — the API pointed at it (dev database must be up + seeded)
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=test-service-role-key \
 *   STORAGE_DRIVER=local RATE_LIMIT_RESET_MAX=200 npm run dev --prefix server
 *
 *   # terminal 3
 *   npm run reset-flow:test --prefix server
 *
 * What it proves:
 *   - the API creates the Supabase auth user and requests the recovery email
 *     (dev: mints the link) for a known admin, and does nothing for unknown ones
 *   - the response body is identical for known and unknown addresses
 *   - a recovery session rotates `admin_users.password_hash` (old password dies,
 *     new one signs in) and is revoked at Supabase afterwards
 *   - password-login sessions, stale (>1 h) recovery sessions, sessions for
 *     non-admin emails, forged JWTs and replayed sessions are all rejected
 *   - Supabase send failures (429 / 500) never change the response, only logs
 */
import { Actor, DEMO, apiReachable, BASE, check, expectStatus, format, section, summarize } from './testkit.js';

const FAKE = process.env.FAKE_GOTRUE_URL || 'http://127.0.0.1:54321';
const EMAIL = DEMO.primary.email;
const ORIGINAL_PASSWORD = DEMO.primary.password;

async function fake<T = any>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${FAKE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await response.json()) as T;
}

async function fakeReachable(): Promise<boolean> {
  try {
    await fake('/__state');
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (!(await apiReachable())) {
    console.error(`\n  ✗ No API responding at ${BASE}. See the header of this file for how to start it.\n`);
    process.exit(1);
  }
  if (!(await fakeReachable())) {
    console.error(`\n  ✗ No fake GoTrue at ${FAKE}. Start it with: npm run dev:fake-auth --prefix server\n`);
    process.exit(1);
  }
  await fake('/__reset', {});

  const anon = new Actor('anon');
  await anon.primeCsrf();

  /* ------------------------------ request a link ----------------------------- */
  section('Forgot password → Supabase Auth carries the email');

  const known = await anon.post('/api/auth/forgot-password', { email: EMAIL });
  expectStatus(known, 200, 'known admin');
  check('channel is supabase and delivery is enabled', known.body?.emailDeliveryChannel === 'supabase' && known.body?.emailDeliveryEnabled === true, known.body);
  const devMode = Boolean(known.body?.devResetUrl);
  if (devMode) {
    check(
      'dev link is Supabase\u2019s recovery action link pointing back to /admin/reset-password',
      /\/auth\/v1\/verify\?token=.+type=recovery.+redirect_to=.+%2Fadmin%2Freset-password/.test(known.body.devResetUrl),
      known.body.devResetUrl
    );
  }
  let state = await fake('/__state');
  const authUser = state.users.find((u: any) => u.email === EMAIL);
  check('Supabase auth user exists for the admin (email confirmed)', Boolean(authUser?.email_confirmed_at), state.users);
  check(
    devMode ? 'link minted via generate_link (dev)' : 'recovery email requested via /recover',
    devMode ? state.generated.length === 1 : state.recoverEmails.length === 1,
    { generated: state.generated, recoverEmails: state.recoverEmails }
  );

  const unknown = await anon.post('/api/auth/forgot-password', { email: `nobody-${Date.now()}@example.com` });
  expectStatus(unknown, 200, 'unknown email');
  check(
    'known and unknown emails get the same message + delivery flags',
    unknown.body?.message === known.body?.message &&
      unknown.body?.emailDeliveryChannel === known.body?.emailDeliveryChannel &&
      unknown.body?.emailDeliveryEnabled === known.body?.emailDeliveryEnabled,
    { known: known.body, unknown: unknown.body }
  );
  check('no link for unknown email', !unknown.body?.devResetUrl, unknown.body);
  state = await fake('/__state');
  check('no Supabase user created for unknown email', state.users.length === 1, state.users);

  const again = await anon.post('/api/auth/forgot-password', { email: EMAIL });
  expectStatus(again, 200, 'second request for the same admin');
  state = await fake('/__state');
  check('existing Supabase user is reused (email_exists path)', state.users.length === 1, state.users);

  /* ------------------------ Supabase send failures ------------------------ */
  section('Supabase mailer failures never leak into the response');

  await fake('/__fail', { recover: 429 });
  const limited = await anon.post('/api/auth/forgot-password', { email: EMAIL });
  check('429 from Supabase → still generic 200', limited.status === 200 && limited.body?.message === known.body?.message, limited.body);
  await fake('/__fail', { recover: 500 });
  const broken = await anon.post('/api/auth/forgot-password', { email: EMAIL });
  check('500 from Supabase → still generic 200', broken.status === 200 && broken.body?.message === known.body?.message, broken.body);

  /* ------------------------------ set password ------------------------------ */
  section('Reset with a recovery session');

  const { access_token: recovery } = await fake<{ access_token: string }>('/__mint', { email: EMAIL, method: 'recovery', ageSeconds: 90 });
  const stamp = Date.now().toString(36);
  const NEW_PASSWORD = `Reset-Flow-${stamp}-2026`;

  expectStatus(await anon.post('/api/auth/reset-password', { supabaseAccessToken: recovery, newPassword: 'short' }), 400, 'weak password rejected');
  const done = await anon.post('/api/auth/reset-password', { supabaseAccessToken: recovery, newPassword: NEW_PASSWORD });
  expectStatus(done, 200, 'recovery session accepted');
  await new Promise((resolve) => setTimeout(resolve, 300));
  state = await fake('/__state');
  check('recovery session revoked at Supabase after use', state.revoked.length === 1, state.revoked);

  const owner = new Actor('owner');
  const oldLogin = await owner.login(EMAIL, ORIGINAL_PASSWORD);
  check('old password no longer signs in', oldLogin.status === 401, `${oldLogin.status} ${format(oldLogin.body).slice(0, 80)}`);
  const newLogin = await owner.login(EMAIL, NEW_PASSWORD);
  expectStatus(newLogin, 200, 'new password signs in');

  const activity = await owner.get('/api/admin/activity?limit=20');
  const entries: any[] = activity.body?.items ?? activity.body?.data ?? [];
  const completed = entries.find((entry) => entry.action === 'PASSWORD_RESET_COMPLETED');
  check('audit trail records channel=supabase, method=recovery', completed?.metadata?.channel === 'supabase' && completed?.metadata?.method === 'recovery', completed?.metadata);
  const undelivered = entries.find((entry) => entry.action === 'PASSWORD_RESET_REQUESTED' && entry.metadata?.delivered === false);
  check('undelivered sends are audited with a reason', Boolean(undelivered?.metadata?.reason), undelivered?.metadata);

  /* -------------------------------- rejections ------------------------------- */
  section('Rejected proofs');

  const reuse = await anon.post('/api/auth/reset-password', { supabaseAccessToken: recovery, newPassword: `${NEW_PASSWORD}x` });
  expectStatus(reuse, 400, 'revoked recovery session');

  const { access_token: passwordSession } = await fake<{ access_token: string }>('/__mint', { email: EMAIL, method: 'password' });
  const viaPassword = await anon.post('/api/auth/reset-password', { supabaseAccessToken: passwordSession, newPassword: `${NEW_PASSWORD}x` });
  check('password sign-in session is not a recovery proof', viaPassword.status === 400 && /reset email/i.test(viaPassword.body?.error ?? ''), viaPassword.body);

  const { access_token: stale } = await fake<{ access_token: string }>('/__mint', { email: EMAIL, method: 'recovery', ageSeconds: 61 * 60 });
  expectStatus(await anon.post('/api/auth/reset-password', { supabaseAccessToken: stale, newPassword: `${NEW_PASSWORD}x` }), 400, 'recovery session older than 60 minutes');

  const { access_token: stranger } = await fake<{ access_token: string }>('/__mint', { email: 'stranger@example.com', method: 'recovery' });
  expectStatus(await anon.post('/api/auth/reset-password', { supabaseAccessToken: stranger, newPassword: `${NEW_PASSWORD}x` }), 400, 'recovery session for a non-admin email');

  const forgedClaims = Buffer.from(JSON.stringify({ email: EMAIL, amr: [{ method: 'recovery' }] })).toString('base64url');
  const forged = await anon.post('/api/auth/reset-password', { supabaseAccessToken: `eyJhbGciOiJIUzI1NiJ9.${forgedClaims}.forged`, newPassword: `${NEW_PASSWORD}x` });
  expectStatus(forged, 400, 'forged JWT unknown to Supabase');

  expectStatus(await anon.post('/api/auth/reset-password', { token: 'x'.repeat(40), supabaseAccessToken: 'y'.repeat(40), newPassword: `${NEW_PASSWORD}x` }), 400, 'two proofs at once');
  expectStatus(await anon.post('/api/auth/reset-password', { newPassword: `${NEW_PASSWORD}x` }), 400, 'no proof at all');

  const stillValid = await new Actor('owner2').login(EMAIL, NEW_PASSWORD);
  expectStatus(stillValid, 200, 'password unchanged by rejected attempts');

  /* --------------------------------- restore --------------------------------- */
  section('Restore the seeded password');
  const { access_token: restore } = await fake<{ access_token: string }>('/__mint', { email: EMAIL, method: 'recovery' });
  expectStatus(await anon.post('/api/auth/reset-password', { supabaseAccessToken: restore, newPassword: ORIGINAL_PASSWORD }), 200, 'seed password restored');

  process.exit(summarize('Password reset flow (Supabase Auth channel)') ? 1 : 0);
}

main().catch((error) => {
  console.error('\n  Reset flow test crashed:', error);
  process.exit(1);
});
