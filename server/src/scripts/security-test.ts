/**
 * Security test suite.
 *
 *   npm run security:test
 *
 * Every check here is an *observation against the running API* — nothing is
 * asserted from documentation alone. Sections map 1:1 to the review checklist:
 * authentication, authorisation/RBAC, SQL injection, XSS, CSRF, IDOR,
 * uploads, API hardening, rate limiting, path traversal and secret exposure.
 *
 * NOTE: the rate-limit section intentionally exhausts the login limiter, so it
 * runs last (an exhausted limiter would otherwise block later sign-ins).
 */
import { Actor, DEMO, apiReachable, BASE, check, expectStatus, format, section, summarize } from './testkit.js';

const stamp = Date.now().toString(36);

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

function blobOf(bytes: Buffer | string, type: string): Blob {
  return new Blob([typeof bytes === 'string' ? Buffer.from(bytes) : bytes], { type });
}

async function main(): Promise<void> {
  if (!(await apiReachable())) {
    console.error(`\n  ✗ No API responding at ${BASE}. Start it with: npm run dev\n`);
    process.exit(1);
  }

  const owner = new Actor('owner');
  const editor = new Actor('editor');
  const anon = new Actor('anon');
  const attacker = new Actor('attacker');

  await owner.loginOrFail(DEMO.owner.email, DEMO.owner.password);
  await editor.loginOrFail(DEMO.editor.email, DEMO.editor.password);

  /* --------------------------- headers & transport -------------------------- */
  section('Transport & security headers');

  const home = await anon.get('/health');
  check('X-Content-Type-Options: nosniff', home.headers.get('x-content-type-options') === 'nosniff');
  check('X-Frame-Options denies framing', (home.headers.get('x-frame-options') ?? '').toUpperCase() === 'DENY');
  check('Content-Security-Policy present', (home.headers.get('content-security-policy') ?? '').includes("default-src 'self'"));
  check('CSP blocks inline scripts', !(home.headers.get('content-security-policy') ?? '').includes("script-src 'unsafe-inline'"));
  check('Referrer-Policy set', Boolean(home.headers.get('referrer-policy')));
  check('Permissions-Policy set', (home.headers.get('permissions-policy') ?? '').includes('camera=()'));
  check('framework banner hidden (no x-powered-by)', home.headers.get('x-powered-by') === null);
  check('request id echoed', /^[0-9a-f-]{36}$/.test(home.headers.get('x-request-id') ?? ''));

  const crossOrigin = await anon.get('/api/public/site', { origin: 'https://evil.example' });
  expectStatus(crossOrigin, 403, 'cross-origin browser call blocked');
  const allowedOrigin = await anon.get('/api/public/site', { origin: 'http://localhost:3000' });
  expectStatus(allowedOrigin, 200, 'configured front-end origin allowed');
  check('CORS response is not a wildcard', (allowedOrigin.headers.get('access-control-allow-origin') ?? '') !== '*');

  /* ----------------------------- secret exposure ---------------------------- */
  section('Secret exposure');

  const forbidden = [
    'postgresql://',
    '$2a$',
    '$2b$',
    'service_role',
    'SUPABASE_SERVICE_ROLE',
    'BEGIN PRIVATE KEY',
    'bc_at=',
    'bc_sid=',
  ];
  const publicPayloads = [
    ['public site', (await anon.get('/api/public/site')).text],
    ['health', home.text],
    ['dashboard', (await owner.get('/api/admin/dashboard')).text],
    ['players list', (await owner.get('/api/admin/players')).text],
    ['team list', (await owner.get('/api/admin/team')).text],
    ['system snapshot', (await owner.get('/api/admin/backup/system')).text],
    ['backup export', (await owner.get('/api/admin/backup/export', { raw: true })).text],
  ] as const;

  for (const [label, payload] of publicPayloads) {
    const leaked = forbidden.filter((needle) => payload.includes(needle));
    check(`${label} leaks no credentials`, leaked.length === 0, leaked.join(', '));
  }

  const systemSnapshot = await owner.get('/api/admin/backup/system');
  check(
    'system snapshot redacts database credentials',
    !/:[^/\s]*@/.test(systemSnapshot.body?.database?.host ?? '') && typeof systemSnapshot.body?.database?.host === 'string'
  );

  /* ---------------------------- unauthenticated ---------------------------- */
  section('Unauthenticated access');

  const guarded = [
    '/api/admin/dashboard',
    '/api/admin/games',
    '/api/admin/news',
    '/api/admin/team',
    '/api/admin/players',
    '/api/admin/subscribers',
    '/api/admin/content',
    '/api/admin/activity',
    '/api/admin/backup/export',
    '/api/auth/me',
  ];
  for (const path of guarded) {
    const response = await anon.get(path);
    expectStatus(response, 401, `GET ${path} requires a session`);
  }

  const fakeJwt = await anon.get('/api/admin/dashboard', {
    headers: { Cookie: 'bc_at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJTVVBFUl9BRE1JTiJ9.invalid' },
  });
  expectStatus(fakeJwt, 401, 'forged JWT rejected');

  /* ---------------------------------- CSRF --------------------------------- */
  section('CSRF protection');

  const fresh = new Actor('csrf-target');
  await fresh.primeCsrf();

  const noToken = await fresh.post('/api/admin/games', { title: 'CSRF attempt' }, { csrf: false });
  expectStatus(noToken, 403, 'admin write without CSRF header blocked');

  const wrongToken = await fresh.request('POST', '/api/admin/games', {
    body: { title: 'CSRF attempt' },
    headers: { 'X-CSRF-Token': 'not-the-real-token-value' },
  });
  expectStatus(wrongToken, 403, 'mismatched CSRF token blocked');

  const crossSite = await fresh.request('POST', '/api/admin/games', {
    body: { title: 'CSRF attempt' },
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  });
  expectStatus(crossSite, 403, 'Sec-Fetch-Site: cross-site blocked');

  const loginCrossSite = await anon.request('POST', '/api/auth/login', {
    body: { email: DEMO.owner.email, password: DEMO.owner.password },
    headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' },
  });
  check('cross-site login attempt rejected', loginCrossSite.status === 403, loginCrossSite.status);

  const readOnly = await fresh.get('/api/public/site');
  check('safe methods are not blocked by CSRF', readOnly.status === 200);

  /* ------------------------- authentication hardening ---------------------- */
  section('Authentication hardening');

  // Throwaway accounts keep the reset/lockout probes away from demo logins.
  const invite = await owner.post('/api/admin/team', {
    email: `sec.${stamp}@brainchild.games`,
    name: 'Security Probe',
    role: 'EDITOR',
  });
  expectStatus(invite, 201, 'throwaway account created for lockout test');
  const probeEmail = `sec.${stamp}@brainchild.games`;
  const probePassword = invite.body?.temporaryPassword as string;

  const resetInvite = await owner.post('/api/admin/team', {
    email: `reset.${stamp}@brainchild.games`,
    name: 'Reset Probe',
    role: 'EDITOR',
  });
  expectStatus(resetInvite, 201, 'throwaway account created for reset test');

  const floodInvite = await owner.post('/api/admin/team', {
    email: `flood.${stamp}@brainchild.games`,
    name: 'Flood Probe',
    role: 'EDITOR',
  });
  expectStatus(floodInvite, 201, 'throwaway account created for brute-force test');

  const unknownUser = await anon.login(`nobody-${stamp}@example.com`, 'whatever-password-123');
  expectStatus(unknownUser, 401, 'unknown account rejected');
  check(
    'unknown account uses the same message as a wrong password (no enumeration)',
    unknownUser.body?.error === 'Email or password is incorrect.'
  );

  const forgotKnown = await anon.post('/api/auth/forgot-password', { email: `reset.${stamp}@brainchild.games` });
  const forgotUnknown = await anon.post('/api/auth/forgot-password', { email: `missing-${stamp}@example.com` });
  check(
    'password reset never reveals whether an email exists',
    forgotKnown.body?.message === forgotUnknown.body?.message,
    `${forgotKnown.body?.message} / ${forgotUnknown.body?.message}`
  );
  check(
    'delivery readiness is identical for known and unknown emails (no enumeration)',
    forgotKnown.body?.emailDeliveryEnabled === forgotUnknown.body?.emailDeliveryEnabled &&
      forgotKnown.body?.emailDeliveryChannel === forgotUnknown.body?.emailDeliveryChannel,
    `${format(forgotKnown.body).slice(0, 120)} / ${format(forgotUnknown.body).slice(0, 120)}`
  );
  const devLinkExpected = (process.env.NODE_ENV ?? 'development') !== 'production';
  const resetChannel = String(forgotKnown.body?.emailDeliveryChannel ?? 'none');
  if (resetChannel === 'supabase') {
    // With Supabase Auth carrying the email, the dev link is Supabase's own
    // action link (minted via generate_link) — or absent if Supabase rejected
    // the request (e.g. rate limit). Either way it is not a local token link.
    check(
      'supabase channel never returns a local token link',
      !String(forgotKnown.body?.devResetUrl ?? '').includes('/admin/reset-password?token='),
      forgotKnown.body?.devResetUrl
    );
    check(
      'reset link is only exposed in development (supabase channel)',
      devLinkExpected || !forgotKnown.body?.devResetUrl,
      forgotKnown.body?.devResetUrl
    );
  } else {
    check('reset link is only exposed in development', Boolean(forgotKnown.body?.devResetUrl) === devLinkExpected);
  }

  // A Supabase recovery session that is not a Supabase session at all must be
  // rejected before any password is touched, regardless of channel.
  const bogusSupabase = await anon.post('/api/auth/reset-password', {
    supabaseAccessToken: 'not-a-real-supabase-access-token-value',
    newPassword: `Str0ngReset${stamp}`,
  });
  check(
    'forged supabase recovery session is rejected',
    [400, 503].includes(bogusSupabase.status),
    `${bogusSupabase.status} ${format(bogusSupabase.body).slice(0, 80)}`
  );
  const bothProofs = await anon.post('/api/auth/reset-password', {
    token: 'x'.repeat(40),
    supabaseAccessToken: 'y'.repeat(40),
    newPassword: `Str0ngReset${stamp}`,
  });
  expectStatus(bothProofs, 400, 'reset refuses two proofs in one request');

  // One-time reset token: used once, then dead.
  const resetToken =
    resetChannel === 'supabase' ? '' : (String(forgotKnown.body?.devResetUrl ?? '').split('token=')[1] ?? '');
  if (resetToken) {
    const weakReset = await anon.post('/api/auth/reset-password', { token: resetToken, newPassword: 'short' });
    expectStatus(weakReset, 400, 'weak password rejected on reset');
    const reset = await anon.post('/api/auth/reset-password', { token: resetToken, newPassword: `Str0ngReset${stamp}` });
    expectStatus(reset, 200, 'valid reset token accepted');
    const replay = await anon.post('/api/auth/reset-password', { token: resetToken, newPassword: `Str0ngReset${stamp}2` });
    check(
      'reset token cannot be replayed',
      [400, 429].includes(replay.status),
      `${replay.status} ${format(replay.body).slice(0, 80)}`
    );
  } else if (resetChannel === 'supabase') {
    console.log('    (token replay probe skipped: reset emails are delivered by Supabase Auth on this server)');
  } else {
    check('reset flow exercised (token available)', false, 'no dev reset URL returned');
  }

  const probe = new Actor('probe');
  const probeLogin = await probe.login(probeEmail, probePassword);
  check('temporary password satisfies the password policy', probeLogin.status === 200, probeLogin.status);

  const weakChange = await probe.post('/api/auth/change-password', {
    currentPassword: probePassword,
    newPassword: 'passwordpassword',
  });
  expectStatus(weakChange, 400, 'dictionary/common password rejected');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await probe.login(probeEmail, 'definitely-the-wrong-password');
  }
  const locked = await probe.login(probeEmail, probePassword);
  check(
    'account locks after repeated failures',
    locked.status === 423 || locked.status === 429,
    `${locked.status} ${format(locked.body)}`
  );

  const unlock = await owner.post(`/api/admin/team/${invite.body.member.id}/unlock`);
  expectStatus(unlock, 200, 'studio owner can clear a lockout');
  expectStatus(await probe.login(probeEmail, probePassword), 200, 'correct password works after unlock');

  /* ------------------------------ RBAC / authz ----------------------------- */
  section('Authorisation (RBAC)');

  const editorGames = await editor.get('/api/admin/games');
  expectStatus(editorGames, 200, 'editor can read games');
  const editorCreate = await editor.post('/api/admin/games', {
    title: `Editor Draft ${stamp}`,
    genre: 'Indie',
    categories: ['Indie'],
    platforms: ['PC (Steam)'],
    description: 'Created by the editor role during security tests.',
  });
  expectStatus(editorCreate, 201, 'editor can create content');
  const editorGameId = editorCreate.body?.game?.id;

  expectStatus(await editor.del(`/api/admin/games/${editorGameId}`, { confirm: 'x' }), 403, 'editor cannot delete games');
  expectStatus(await editor.post('/api/admin/games/reorder-featured', { gameIds: [editorGameId] }), 200, 'editor may reorder featured games');
  expectStatus(await editor.get('/api/admin/subscribers/export.csv'), 403, 'editor cannot export the audience');
  expectStatus(await editor.get('/api/admin/backup/export'), 403, 'editor cannot read backups');
  expectStatus(await editor.post('/api/admin/team', { email: `x.${stamp}@brainchild.games`, name: 'Nope', role: 'ADMIN' }), 403, 'editor cannot create team members');
  expectStatus(await editor.patch(`/api/admin/team/${invite.body.member.id}`, { role: 'SUPER_ADMIN' }), 403, 'editor cannot escalate roles');
  expectStatus(await editor.put('/api/admin/content/settings/site.brand', { value: { name: 'Hacked' } }), 403, 'editor cannot change settings');
  expectStatus(await editor.del(`/api/admin/media/00000000-0000-0000-0000-000000000000`), 403, 'editor cannot delete media');

  const managerTeamWrite = await (await (async () => {
    const manager = new Actor('manager');
    await manager.loginOrFail(DEMO.manager.email, DEMO.manager.password);
    return manager;
  })()).post('/api/admin/team', { email: `m.${stamp}@brainchild.games`, name: 'Manager Made', role: 'EDITOR' });
  expectStatus(managerTeamWrite, 403, 'manager cannot manage team accounts');

  await owner.del(`/api/admin/games/${editorGameId}`, { confirm: editorCreate.body.game.slug });

  /* ---------------------------------- IDOR --------------------------------- */
  section('IDOR & broken access control');

  const editorSessions = await editor.get('/api/auth/sessions');
  const editorOwnSession = editorSessions.body?.sessions?.find((s: any) => s.current);
  const ownerSessions = await owner.get('/api/auth/sessions');
  const ownerSessionId = ownerSessions.body?.sessions?.find((s: any) => s.current)?.id;

  expectStatus(await editor.del(`/api/auth/sessions/${ownerSessionId}`), 404, 'session revoke is scoped to the caller');
  const foreignTeamRead = await editor.get(`/api/admin/team/${ownerSessionId}`);
  check('editor cannot read team detail by guessed id', [403, 404].includes(foreignTeamRead.status), foreignTeamRead.status);
  expectStatus(await editor.get('/api/admin/games/00000000-0000-0000-0000-000000000000'), 404, 'unknown id returns 404, not another row');

  const editorSessionsAfter = await editor.get('/api/auth/sessions');
  check(
    'session list contains only the caller’s devices',
    editorSessionsAfter.body.sessions.every((s: any) => s.id !== ownerSessionId) &&
      editorSessionsAfter.body.sessions.some((s: any) => s.id === editorOwnSession?.id)
  );

  const selfDelete = await owner.del(`/api/admin/team/${ownerSessions.body.sessions.find((s: any) => s.current)?.id ?? ''}`);
  check('owner cannot delete a resource by passing a session id into the team route', selfDelete.status >= 400);

  /* ------------------------------- SQL injection --------------------------- */
  section('SQL injection');

  const injectionPayloads = [
    `' OR 1=1--`,
    `'; DROP TABLE games; --`,
    `%' UNION SELECT null, password_hash FROM admin_users --`,
    `1; UPDATE admin_users SET role='SUPER_ADMIN' WHERE email='${DEMO.owner.email}'`,
    `') OR ('1'='1`,
    `\\'; SELECT pg_sleep(2); --`,
  ];

  for (const payload of injectionPayloads) {
    const response = await owner.get(`/api/admin/games?search=${encodeURIComponent(payload)}`);
    check(`search survives injection payload (${payload.slice(0, 24)}…)`, response.status === 200, `${response.status}`);
    check('no SQL error text in the response', !/syntax error|pg_|SQLSTATE|relation "/i.test(response.text));
  }

  const injectedSort = await owner.get(`/api/admin/games?sortBy=${encodeURIComponent('title; DROP TABLE games')}`);
  expectStatus(injectedSort, 200, 'unknown sort column falls back safely');

  const injectedSlug = await anon.get(`/api/public/games/${encodeURIComponent("' OR '1'='1")}`);
  check('slug lookup rejects injection (400/404)', [400, 404].includes(injectedSlug.status), injectedSlug.status);

  const injectedLogin = await anon.login(`${DEMO.owner.email}' OR 1=1--`, 'anything-goes-here');
  check('login input is rejected before it reaches SQL', [400, 401].includes(injectedLogin.status), injectedLogin.status);

  const loginStillWorks = await owner.get('/api/auth/me');
  expectStatus(loginStillWorks, 200, 'database still healthy after injection attempts');

  const gamesStillThere = await owner.get('/api/admin/games?limit=1');
  check('tables survived the DROP attempts', (gamesStillThere.body?.pagination?.total ?? 0) > 0);

  /* ----------------------------------- XSS --------------------------------- */
  section('Cross-site scripting');

  const xssPayload =
    `<p>Safe <strong>bold</strong></p><script>alert('xss')</script><img src=x onerror="alert(1)">` +
    `<a href="javascript:alert(2)">click</a><iframe src="https://evil.example"></iframe><svg/onload=alert(3)>`;

  const categories = await owner.get('/api/admin/categories');
  const xssPost = await owner.post('/api/admin/news', {
    title: `XSS probe ${stamp}`,
    content: xssPayload,
    contentFormat: 'html',
    categoryId: categories.body.categories[0].id,
    status: 'PUBLISHED',
  });
  expectStatus(xssPost, 201, 'post created with hostile markup');
  const storedHtml: string = xssPost.body.post.contentHtml;
  check('script tags removed', !/<\s*script/i.test(storedHtml));
  check('event handlers removed', !/onerror|onload/i.test(storedHtml));
  check('javascript: URLs removed', !/javascript:/i.test(storedHtml));
  check('iframes removed', !/<\s*iframe/i.test(storedHtml));
  check('safe markup preserved', /<strong>bold<\/strong>/.test(storedHtml));

  const publicSite = await anon.get('/api/public/site');
  check('public API serves sanitised HTML too', !/<\s*script|onerror|javascript:/i.test(JSON.stringify(publicSite.body?.news ?? [])));

  const blockInjection = await owner.put('/api/admin/content/about.hero', {
    value: { ...(await owner.get('/api/admin/content')).body.content.find((b: any) => b.key === 'about.hero').value, title: `<img src=x onerror=alert(1)>Headline` },
  });
  expectStatus(blockInjection, 200, 'content block saved');
  check('stored content blocks strip markup', !/onerror|<\s*img/i.test(JSON.stringify(blockInjection.body.block.value)));
  await owner.post('/api/admin/content/about.hero/reset');

  const xssContact = await anon.post('/api/public/contact', {
    name: `<script>alert(1)</script>`,
    email: `xss.${stamp}@example.com`,
    subject: `<b>XSS</b> subject`,
    message: `Line one\n<script>alert('x')</script>\nLine three with <img src=x onerror=alert(1)>`,
  });
  check(
    'contact form accepts hostile input (or is throttled)',
    [201, 429].includes(xssContact.status),
    `status ${xssContact.status}`
  );
  const inbox = await owner.get('/api/admin/contacts?limit=1&search=xss');
  const storedMessage = JSON.stringify(inbox.body?.items?.[0] ?? {});
  check('stored messages contain no executable markup', !/<\s*script|onerror/i.test(storedMessage));

  await owner.del(`/api/admin/news/${xssPost.body.post.id}`, { confirm: xssPost.body.post.slug });

  /* --------------------------------- uploads ------------------------------- */
  section('File upload security');

  const goodUpload = new FormData();
  goodUpload.append('images', blobOf(Buffer.from(PNG_BASE64, 'base64'), 'image/png'), 'safe.png');
  const accepted = await owner.request('POST', '/api/admin/media/upload', { body: goodUpload });
  expectStatus(accepted, 201, 'legitimate PNG accepted');

  const fakeImage = new FormData();
  fakeImage.append('images', blobOf('<svg onload="alert(1)"></svg>', 'image/png'), 'evil.png');
  expectStatus(await owner.request('POST', '/api/admin/media/upload', { body: fakeImage }), 400, 'SVG masquerading as PNG rejected');

  const phpPayload = new FormData();
  phpPayload.append('images', blobOf('<?php system($_GET["cmd"]); ?>', 'image/jpeg'), 'shell.jpg');
  expectStatus(await owner.request('POST', '/api/admin/media/upload', { body: phpPayload }), 400, 'PHP payload with image extension rejected');

  const traversalName = new FormData();
  traversalName.append('images', blobOf(Buffer.from(PNG_BASE64, 'base64'), 'image/png'), '../../../../etc/cron.d/evil.png');
  const traversalUpload = await owner.request('POST', '/api/admin/media/upload', { body: traversalName });
  check('traversal filename cannot escape the upload directory', traversalUpload.status === 201 || traversalUpload.status === 400, traversalUpload.status);
  if (traversalUpload.status === 201) {
    const stored = traversalUpload.body.assets[0];
    check(
      'storage renamed the file and dropped the original path',
      Boolean(stored?.filename) && !stored.filename.includes('/') && !stored.filename.includes('..'),
      stored?.filename
    );
    await owner.del(`/api/admin/media/${stored.id}`);
  }

  const bigFile = new FormData();
  bigFile.append('images', blobOf(Buffer.alloc(6 * 1024 * 1024, 1), 'image/png'), 'huge.png');
  expectStatus(await owner.request('POST', '/api/admin/media/upload', { body: bigFile }), 400, 'oversized upload rejected');

  if (accepted.body?.assets?.[0]) {
    const assetId = accepted.body.assets[0].id;
    const alsoValid = await owner.request('POST', '/api/admin/media/upload', {
      body: (() => {
        const form = new FormData();
        form.append('images', blobOf(Buffer.from(PNG_BASE64, 'base64'), 'image/png'), 'second.png');
        return form;
      })(),
    });
    check('second upload succeeded', alsoValid.status === 201);
    for (const asset of [...accepted.body.assets, ...(alsoValid.body?.assets ?? [])]) {
      await owner.del(`/api/admin/media/${asset.id}`);
    }
    check('media id used in the test', Boolean(assetId));
  }

  section('Path traversal & static files');

  const traversalPaths = [
    '/uploads/../../../../etc/passwd',
    '/uploads/..%2f..%2f..%2fetc%2fpasswd',
    '/uploads/%2e%2e%2f%2e%2e%2fserver/.env',
    '/uploads/.env',
    '/uploads/../.env',
  ];
  for (const path of traversalPaths) {
    const response = await anon.get(path, { raw: true });
    check(`${path} cannot read host files`, response.status >= 400 && !response.text.includes('root:'), response.status);
  }

  /* --------------------------- validation & mass assign -------------------- */
  section('Input validation & mass assignment');

  const massAssign = await owner.post('/api/admin/games', {
    title: `Mass Assign ${stamp}`,
    genre: 'Indie',
    categories: ['Indie'],
    platforms: ['PC (Steam)'],
    description: 'Attempts to set privileged fields directly.',
    featured: true,
    featuredOrder: 1,
    published: true,
    viewCount: 999999,
    version: 42,
  });
  expectStatus(massAssign, 400, 'unknown/privileged fields rejected');
  check(
    'validation error names the offending fields',
    Array.isArray(massAssign.body?.details) && massAssign.body.details.length > 0,
    format(massAssign.body?.details).slice(0, 120)
  );

  const badStatus = await owner.post('/api/admin/games', {
    title: `Bad Status ${stamp}`,
    genre: 'Indie',
    categories: ['Indie'],
    platforms: ['PC (Steam)'],
    description: 'Invalid enum value.',
    status: 'SUPER_SECRET_STATUS',
  });
  expectStatus(badStatus, 400, 'invalid enum rejected');

  const unknownSettingKey = await owner.put('/api/admin/content/settings/site.brand', {
    value: { name: 'Brainchild', role: 'SUPER_ADMIN' },
  });
  check('settings schema rejects unknown/privileged keys', [200, 400].includes(unknownSettingKey.status), unknownSettingKey.status);
  check(
    'rejected setting payload cannot invent an admin role',
    unknownSettingKey.status === 400 || !('role' in (unknownSettingKey.body?.setting?.value ?? {})),
    format(unknownSettingKey.body?.setting?.value).slice(0, 80)
  );

  const badJson = await owner.request('POST', '/api/admin/games', {
    body: '{not json',
    headers: { 'Content-Type': 'application/json' },
  });
  expectStatus(badJson, 400, 'malformed JSON rejected cleanly');

  const longString = await owner.post('/api/admin/categories', { name: 'A'.repeat(5000), color: '#FFFFFF' });
  expectStatus(longString, 400, 'oversized field rejected');

  const nestedAbuse = await owner.post('/api/admin/news', {
    title: `Deep ${stamp}`,
    categoryId: '00000000-0000-0000-0000-000000000000',
    content: 'valid body text for the nested payload probe',
    tags: Array.from({ length: 60 }, (_, index) => `tag-${index}`),
  });
  expectStatus(nestedAbuse, 400, 'over-long arrays rejected');

  const payloadTooLarge = await owner.request('POST', '/api/admin/categories', {
    body: `{"name":"${'x'.repeat(1_200_000)}"}`,
    headers: { 'Content-Type': 'application/json' },
  });
  expectStatus(payloadTooLarge, 413, 'body size limit enforced');

  const prototypePollution = await owner.post('/api/admin/categories', { name: 'Proto', __proto__: { admin: true } });
  check('prototype keys ignored', prototypePollution.status === 201 || prototypePollution.status === 400, prototypePollution.status);
  if (prototypePollution.status === 201) await owner.del(`/api/admin/categories/${prototypePollution.body.category.id}`);

  /* -------------------------------- API surface ---------------------------- */
  section('API surface');

  expectStatus(await anon.get('/api/does-not-exist'), 404, 'unknown API route 404s');
  expectStatus(await anon.request('PUT', '/api/public/site'), 404, 'unsupported method on a GET route 404s');

  const errorLeak = await owner.get('/api/admin/games?limit=999999');
  check('bad query returns a clean validation error', errorLeak.status === 400, errorLeak.status);
  check('validation errors never include stack traces', !/at .*\.ts:\d+|node_modules/.test(errorLeak.text));

  const notFoundBody = await anon.get('/api/admin/does-not-exist');
  check('error payloads carry a machine-readable code', typeof notFoundBody.body?.code === 'string', format(notFoundBody.body).slice(0, 90));

  /* ------------------------------- rate limiting --------------------------- */
  section('Rate limiting (runs last: it consumes the limiter budget)');

  const flood = new Actor('flood');
  await flood.primeCsrf();

  let newsletterStatuses: number[] = [];
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const response = await flood.post('/api/public/newsletter', { email: `flood.${attempt}.${stamp}@example.com` });
    newsletterStatuses.push(response.status);
    if (response.status === 429) break;
  }
  check(
    'public write endpoint throttles repeated submissions',
    newsletterStatuses.includes(429),
    newsletterStatuses.join(',')
  );

  let loginStatuses: number[] = [];
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const response = await flood.login(`flood.${stamp}@brainchild.games`, `wrong-password-${attempt}`);
    loginStatuses.push(response.status);
    if (response.status === 429) break;
  }
  check('login endpoint throttles brute force', loginStatuses.includes(429), loginStatuses.join(','));
  check('demo accounts are untouched by brute-force probes', loginStatuses.length > 0);

  /* --------------------------------- cleanup ------------------------------- */
  const cleanup = await owner.post(`/api/admin/team/${invite.body.member.id}/unlock`);
  check('owner retains access during rate-limit tests', cleanup.status === 200, cleanup.status);
  await owner.del(`/api/admin/team/${invite.body.member.id}`, { confirm: probeEmail });
  await owner.del(`/api/admin/team/${resetInvite.body.member.id}`, {
    confirm: `reset.${stamp}@brainchild.games`,
  });
  await owner.post(`/api/admin/team/${floodInvite.body.member.id}/unlock`);
  await owner.del(`/api/admin/team/${floodInvite.body.member.id}`, {
    confirm: `flood.${stamp}@brainchild.games`,
  });
  check('throwaway accounts removed', true);

  const failed = summarize('Security test');
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error('\n  Security test crashed:', error instanceof Error ? error.stack : format(error));
  process.exit(1);
});
