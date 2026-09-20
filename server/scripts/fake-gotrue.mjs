#!/usr/bin/env node
/**
 * Minimal stand-in for Supabase Auth (GoTrue) used to exercise the password
 * reset flow offline. NOT a test double for production — it only implements
 * the handful of routes `server/src/services/supabase-auth.ts` calls, with the
 * same status codes and error bodies the hosted service returns.
 *
 *   node scripts/fake-gotrue.mjs            # listens on 127.0.0.1:54321
 *   SUPABASE_URL=http://127.0.0.1:54321 …    # point the API at it
 *
 * Test hooks (never exist on real GoTrue):
 *   POST /__mint   { email, method, ageSeconds }  → { access_token } signed like a
 *                  Supabase session JWT (unverified HS256, claims only)
 *   GET  /__state  → { users, recoverEmails, revoked }
 *   POST /__reset  → wipes state
 *   POST /__fail   { recover: 429 | 500 | 0 }      → next /recover OR
 *                  /admin/generate_link call fails with that status
 */
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.FAKE_GOTRUE_PORT || 54321);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-key';

const state = { users: new Map(), recoverEmails: [], generated: [], revoked: [], failNextRecover: 0 };
const b64url = (s) => Buffer.from(s).toString('base64url');
const mintToken = ({ email, method = 'recovery', ageSeconds = 0, userId }) => {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: `http://127.0.0.1:${PORT}/auth/v1`,
    sub: userId,
    aud: 'authenticated',
    exp: now + 3600,
    iat: now,
    email,
    role: 'authenticated',
    aal: 'aal1',
    amr: [{ method, timestamp: now - ageSeconds }],
    session_id: crypto.randomUUID(),
  };
  const token = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}.${b64url('sig')}`;
  state.tokens ??= new Map();
  state.tokens.set(token, claims);
  return token;
};

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const findUser = (email) => [...state.users.values()].find((u) => u.email === email.toLowerCase());

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname.replace(/^\/auth\/v1/, '');
  const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : {};

  /* ---- test hooks ---- */
  if (path === '/__mint') {
    const user = findUser(body.email) ?? { id: crypto.randomUUID(), email: body.email.toLowerCase() };
    return json(res, 200, { access_token: mintToken({ ...body, userId: user.id }) });
  }
  if (path === '/__state') return json(res, 200, { ...state, users: [...state.users.values()], tokens: undefined });
  if (path === '/__reset') {
    state.users.clear();
    state.recoverEmails = [];
    state.generated = [];
    state.revoked = [];
    state.failNextRecover = 0;
    return json(res, 200, { ok: true });
  }
  if (path === '/__fail') {
    state.failNextRecover = Number(body.recover || 0);
    return json(res, 200, { ok: true });
  }

  /* ---- gateway: every real route needs an apikey ---- */
  if (!req.headers.apikey) return json(res, 401, { message: 'No API key found in request' });

  /* ---- admin: create user ---- */
  if (path === '/admin/users' && req.method === 'POST') {
    if (bearer(req) !== SERVICE_KEY) return json(res, 401, { code: 401, error_code: 'no_authorization', msg: 'This endpoint requires a Bearer token' });
    const email = String(body.email || '').toLowerCase();
    if (!email) return json(res, 422, { code: 422, error_code: 'validation_failed', msg: 'Cannot create a user without either an email or phone' });
    if (findUser(email)) return json(res, 422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' });
    const user = { id: crypto.randomUUID(), email, email_confirmed_at: body.email_confirm ? new Date().toISOString() : null, user_metadata: body.user_metadata ?? {} };
    state.users.set(user.id, user);
    return json(res, 200, user);
  }

  /* ---- admin: generate link ---- */
  if (path === '/admin/generate_link' && req.method === 'POST') {
    if (bearer(req) !== SERVICE_KEY) return json(res, 401, { code: 401, error_code: 'no_authorization', msg: 'This endpoint requires a Bearer token' });
    if (state.failNextRecover) {
      const status = state.failNextRecover;
      state.failNextRecover = 0;
      if (status === 429) return json(res, 429, { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' });
      return json(res, 500, { code: 500, error_code: 'unexpected_failure', msg: 'Database error generating link' });
    }
    const user = findUser(String(body.email || ''));
    if (!user) return json(res, 404, { code: 404, error_code: 'user_not_found', msg: 'User with this email not found' });
    const hashed = crypto.randomBytes(24).toString('hex');
    const link = `http://127.0.0.1:${PORT}/auth/v1/verify?token=${hashed}&type=${body.type}&redirect_to=${encodeURIComponent(body.redirect_to || '')}`;
    state.generated.push({ email: user.email, type: body.type, redirect_to: body.redirect_to });
    return json(res, 200, { ...user, action_link: link, hashed_token: hashed, verification_type: body.type, redirect_to: body.redirect_to });
  }

  /* ---- public: recover ---- */
  if (path === '/recover' && req.method === 'POST') {
    if (state.failNextRecover) {
      const status = state.failNextRecover;
      state.failNextRecover = 0;
      if (status === 429) return json(res, 429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this once every 60 seconds' });
      return json(res, 500, { code: 500, error_code: 'unexpected_failure', msg: 'Error sending recovery email' });
    }
    const email = String(body.email || '').toLowerCase();
    if (!email) return json(res, 400, { code: 400, error_code: 'validation_failed', msg: 'Password recovery requires an email' });
    if (findUser(email)) state.recoverEmails.push({ email, redirect_to: url.searchParams.get('redirect_to') });
    return json(res, 200, {}); // unknown emails also 200, like the real thing
  }

  /* ---- user: validate access token ---- */
  if (path === '/user' && req.method === 'GET') {
    const claims = state.tokens?.get(bearer(req));
    if (!claims) return json(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT: unable to parse or verify signature' });
    if (state.revoked.includes(claims.session_id)) return json(res, 403, { code: 403, error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' });
    const user = findUser(claims.email) ?? { id: claims.sub, email: claims.email };
    return json(res, 200, { ...user, aud: 'authenticated', role: 'authenticated' });
  }

  /* ---- logout ---- */
  if (path === '/logout' && req.method === 'POST') {
    const claims = state.tokens?.get(bearer(req));
    if (!claims) return json(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    state.revoked.push(claims.session_id);
    return json(res, 204);
  }

  json(res, 404, { code: 404, msg: `fake-gotrue: no route for ${req.method} ${path}` });
});

server.listen(PORT, '127.0.0.1', () => console.log(`fake-gotrue listening on http://127.0.0.1:${PORT}`));
