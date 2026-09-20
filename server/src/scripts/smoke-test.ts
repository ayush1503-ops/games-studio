/**
 * End-to-end smoke test: boots nothing, talks to a running API.
 *
 *   npm run smoke:test            # expects the API on :3001
 *   TEST_BASE_URL=http://host npm run smoke:test
 *
 * It exercises the full admin surface (auth, CRUD, publish, media, exports,
 * audit, backup) plus the public endpoints the website depends on.
 */
import { Actor, DEMO, apiReachable, BASE, check, expectStatus, format, section, summarize } from './testkit.js';

const stamp = Date.now().toString(36);

/** 1×1 transparent PNG — a real image so magic-byte sniffing has to accept it. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

function pngBlob(): Blob {
  return new Blob([Buffer.from(PNG_BASE64, 'base64')], { type: 'image/png' });
}

async function main(): Promise<void> {
  if (!(await apiReachable())) {
    console.error(`\n  ✗ No API responding at ${BASE}. Start it with: npm run dev\n`);
    process.exit(1);
  }
  console.log(`\n  API under test: ${BASE}\n`);

  const owner = new Actor('owner');
  const manager = new Actor('manager');
  const editor = new Actor('editor');
  const visitor = new Actor('visitor');

  /* ------------------------------- public site ------------------------------ */
  section('Health & public site');

  const health = await visitor.get('/health');
  expectStatus(health, 200, 'GET /health');
  check('health reports a connected database', health.body?.database === 'connected', health.body);

  const site = await visitor.get('/api/public/site');
  expectStatus(site, 200, 'GET /api/public/site');
  check('returns games', Array.isArray(site.body?.games) && site.body.games.length > 0, site.body?.games?.length);
  check('returns news', Array.isArray(site.body?.news) && site.body.news.length > 0);
  check('returns jobs', Array.isArray(site.body?.jobs) && site.body.jobs.length > 0);
  check('returns editable content blocks', Object.keys(site.body?.content ?? {}).length >= 8);
  check('returns site settings', Boolean(site.body?.settings?.['site.brand']));
  check('does not leak admin fields', !site.text.includes('passwordHash') && !site.text.includes('admin_users'));

  const firstGame = site.body.games[0];
  const bySlug = await visitor.get(`/api/public/games/${firstGame.slug}`);
  expectStatus(bySlug, 200, 'GET /api/public/games/:slug');

  /* ------------------------------ public writes ----------------------------- */
  section('Public forms');

  const subscribe = await visitor.post('/api/public/newsletter', {
    email: `smoke.${stamp}@example.com`,
    name: 'Smoke Tester',
    interests: ['Beta access'],
  });
  expectStatus(subscribe, 201, 'newsletter sign-up');

  const duplicate = await visitor.post('/api/public/newsletter', { email: `smoke.${stamp}@example.com` });
  expectStatus(duplicate, 200, 'duplicate sign-up is idempotent');

  const honeypot = await visitor.post('/api/public/newsletter', {
    email: `bot.${stamp}@example.com`,
    website: 'http://spam.example',
  });
  check('honeypot submissions are accepted but discarded', honeypot.status === 202, honeypot.status);

  const contact = await visitor.post('/api/public/contact', {
    name: 'Smoke Tester',
    email: `smoke.${stamp}@example.com`,
    subject: `Smoke test ${stamp}`,
    projectType: 'Press',
    message: 'This is an automated smoke-test message that should land in the studio inbox.',
  });
  expectStatus(contact, 201, 'contact form');

  const invalidContact = await visitor.post('/api/public/contact', {
    name: 'x',
    email: 'not-an-email',
    message: 'short',
  });
  expectStatus(invalidContact, 400, 'contact form validates input');

  /* --------------------------------- auth ---------------------------------- */
  section('Authentication');

  const csrf = await owner.primeCsrf();
  check('CSRF token issued', typeof csrf === 'string' && csrf.length >= 20);

  expectStatus(await owner.login(DEMO.owner.email, DEMO.owner.password), 200, 'owner sign-in');
  expectStatus(await manager.login(DEMO.manager.email, DEMO.manager.password), 200, 'manager sign-in');
  expectStatus(await editor.login(DEMO.editor.email, DEMO.editor.password), 200, 'editor sign-in');

  const me = await owner.get('/api/auth/me');
  expectStatus(me, 200, 'GET /api/auth/me');
  check('owner has wildcard permission', me.body?.admin?.permissions?.includes('*'));
  check('me never returns a password hash', !me.text.includes('passwordHash') && !me.text.includes('$2'));

  const refresh = await owner.post('/api/auth/refresh');
  expectStatus(refresh, 200, 'POST /api/auth/refresh rotates the session');

  const sessions = await owner.get('/api/auth/sessions');
  expectStatus(sessions, 200, 'GET /api/auth/sessions');
  check('session list flags the current device', Boolean(sessions.body?.sessions?.some((s: any) => s.current)));

  /* --------------------------------- games --------------------------------- */
  section('Game management');

  const gamesList = await owner.get('/api/admin/games?limit=5');
  expectStatus(gamesList, 200, 'GET /api/admin/games');
  check('pagination envelope present', typeof gamesList.body?.pagination?.total === 'number');
  check('serialised games expose status labels', typeof gamesList.body.items[0]?.status === 'string');

  const createGame = await owner.post('/api/admin/games', {
    title: `Smoke World ${stamp}`,
    subtitle: 'Automated test world',
    genre: 'Indie',
    categories: ['Indie', 'Adventure'],
    price: '$19.99',
    salePrice: '$14.99',
    platforms: ['PC (Steam)'],
    status: 'IN_DEVELOPMENT',
    releaseYear: '2027',
    description: 'A world created by the smoke test.',
    longDescription: 'Created by the API smoke test to verify the full game lifecycle.',
    tags: ['smoke', 'test'],
    features: ['Runs headless'],
    gameplayMechanics: [{ title: 'Testing', description: 'Automated verification of the studio API.' }],
    storeLinks: [{ name: 'Steam', url: 'https://store.steampowered.com/app/999999', badge: 'Wishlist' }],
  });
  expectStatus(createGame, 201, 'POST /api/admin/games');
  const game = createGame.body.game;
  check('slug generated', typeof game?.slug === 'string' && game.slug.length > 0, game?.slug);
  check('store link saved', game?.storeLinks?.length === 1);
  check('mechanics saved', game?.gameplayMechanics?.length === 1);

  const patched = await owner.patch(`/api/admin/games/${game.id}`, { salePrice: '$9.99', tags: ['smoke'] });
  expectStatus(patched, 200, 'PATCH /api/admin/games/:id');
  check('patch applied', patched.body?.game?.salePrice === '$9.99', patched.body?.game?.salePrice);

  expectStatus(await owner.post(`/api/admin/games/${game.id}/publish`, { published: true }), 200, 'publish game');
  expectStatus(await owner.post(`/api/admin/games/${game.id}/featured`, { featured: true }), 200, 'feature game');

  const featuredList = await owner.get('/api/admin/games/featured');
  expectStatus(featuredList, 200, 'GET /api/admin/games/featured');
  const order = [
    game.id,
    ...featuredList.body.games.filter((entry: any) => entry.id !== game.id).map((entry: any) => entry.id),
  ];
  expectStatus(await owner.post('/api/admin/games/reorder-featured', { gameIds: order }), 200, 'reorder featured games');

  const duplicateGame = await owner.post(`/api/admin/games/${game.id}/duplicate`);
  expectStatus(duplicateGame, 201, 'duplicate game');
  check('duplicates start unpublished', duplicateGame.body?.game?.published === false);

  expectStatus(await owner.post(`/api/admin/games/${duplicateGame.body.game.id}/publish`, { published: false }), 200, 'unpublish game');

  expectStatus(await owner.del(`/api/admin/games/${duplicateGame.body.game.id}`, { confirm: 'wrong-slug' }), 400, 'delete demands slug confirmation');
  expectStatus(
    await owner.del(`/api/admin/games/${duplicateGame.body.game.id}`, { confirm: duplicateGame.body.game.slug }),
    200,
    'delete game with confirmation'
  );

  /* --------------------------------- news ---------------------------------- */
  section('Newsroom');

  const categories = await owner.get('/api/admin/categories');
  expectStatus(categories, 200, 'GET /api/admin/categories');
  const categoryId = categories.body.categories[0].id;

  const createPost = await owner.post('/api/admin/news', {
    title: `Smoke Post ${stamp}`,
    content: `<p>Automated post body with a safe <strong>bold</strong> run.</p><script>alert(1)</script><img src=x onerror=alert(2)>`,
    contentFormat: 'html',
    categoryId,
    authorName: 'Smoke Bot',
    authorRole: 'Automation',
    status: 'PUBLISHED',
    featured: true,
    tags: ['smoke'],
  });
  expectStatus(createPost, 201, 'POST /api/admin/news');
  const post = createPost.body.post;
  check('script tags stripped', !/script/i.test(post?.contentHtml ?? ''), post?.contentHtml);
  check('event handlers stripped', !/onerror/i.test(post?.contentHtml ?? ''));
  check('excerpt auto-generated', typeof post?.excerpt === 'string' && post.excerpt.length > 10, post?.excerpt);
  check('read time calculated', typeof post?.readTime === 'string' && post.readTime.includes('READ'), post?.readTime);

  expectStatus(await owner.patch(`/api/admin/news/${post.id}`, { title: `Smoke Post ${stamp} (edited)` }), 200, 'PATCH /api/admin/news/:id');
  expectStatus(await owner.post(`/api/admin/news/${post.id}/publish`, { published: false }), 200, 'unpublish post');
  const republished = await owner.post(`/api/admin/news/${post.id}/publish`, { published: true });
  expectStatus(republished, 200, 're-publish post');
  check('featured is exclusive', republished.body?.post?.featured === false, 'unpublish clears featured');

  expectStatus(await owner.del(`/api/admin/news/${post.id}`, { confirm: 'nope' }), 400, 'post delete demands slug confirmation');
  expectStatus(await owner.del(`/api/admin/news/${post.id}`, { confirm: post.slug }), 200, 'delete post');

  const newCategory = await owner.post('/api/admin/categories', { name: `Smoke ${stamp}`, color: '#123456' });
  expectStatus(newCategory, 201, 'POST /api/admin/categories');
  expectStatus(
    await owner.patch(`/api/admin/categories/${newCategory.body.category.id}`, { color: '#654321' }),
    200,
    'PATCH /api/admin/categories/:id'
  );
  expectStatus(await owner.del(`/api/admin/categories/${newCategory.body.category.id}`), 200, 'DELETE /api/admin/categories/:id');
  expectStatus(await owner.del(`/api/admin/categories/${categoryId}`), 409, 'category in use cannot be deleted');

  /* --------------------------------- jobs ---------------------------------- */
  section('Careers');

  const createJob = await owner.post('/api/admin/jobs', {
    title: `Smoke Role ${stamp}`,
    department: 'Engineering',
    location: 'Montreal / Remote',
    type: 'FULL_TIME',
    experience: 'Senior',
    description: 'Automated role created by the smoke test.',
    responsibilities: ['Write tests'],
    requirements: ['Patience'],
    perks: ['4-day work week'],
    status: 'OPEN',
    postedDate: 'SEPTEMBER 2026',
  });
  expectStatus(createJob, 201, 'POST /api/admin/jobs');
  const job = createJob.body.job;
  expectStatus(await owner.patch(`/api/admin/jobs/${job.id}`, { status: 'CLOSED' }), 200, 'PATCH /api/admin/jobs/:id');
  expectStatus(await owner.del(`/api/admin/jobs/${job.id}`, { confirm: 'wrong' }), 400, 'role delete needs title confirmation');
  expectStatus(await owner.del(`/api/admin/jobs/${job.id}`, { confirm: job.title }), 200, 'delete role');

  /* -------------------------------- media ---------------------------------- */
  section('Media library');

  const uploadForm = new FormData();
  uploadForm.append('images', pngBlob(), `smoke-${stamp}.png`);
  const upload = await owner.request('POST', '/api/admin/media/upload', { body: uploadForm });
  expectStatus(upload, 201, 'POST /api/admin/media/upload');
  const asset = upload.body?.assets?.[0];
  check('image stored with a generated name', /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9a-f]{24}\.png$/.test(asset?.filename ?? ''), asset?.filename);
  check('reported dimensions read from the file', asset?.width === 1 && asset?.height === 1, `${asset?.width}x${asset?.height}`);

  const servedAsset = await visitor.get(`/uploads/${asset.filename}`, { raw: true });
  expectStatus(servedAsset, 200, 'uploaded image is served');

  const mediaList = await owner.get('/api/admin/media');
  expectStatus(mediaList, 200, 'GET /api/admin/media');
  check('media list never exposes disk paths', !mediaList.text.includes('\\.\\./') && !mediaList.text.includes('/home/'));

  expectStatus(await owner.del(`/api/admin/media/${asset.id}`), 200, 'DELETE /api/admin/media/:id');

  /* -------------------------------- players -------------------------------- */
  section('Player accounts');

  const players = await owner.get('/api/admin/players?limit=5');
  expectStatus(players, 200, 'GET /api/admin/players');
  check('player list hides password hashes', !players.text.includes('passwordHash') && !players.text.includes('$2a$'));
  check('player list exposes emails', typeof players.body.items[0]?.email === 'string');

  if (players.body.items[0]) {
    const playerId = players.body.items[0].id;
    const detail = await owner.get(`/api/admin/players/${playerId}`);
    expectStatus(detail, 200, 'GET /api/admin/players/:id');
    check('detail hides password hashes', !detail.text.includes('passwordHash'));
    expectStatus(await owner.patch(`/api/admin/players/${playerId}`, { status: 'ACTIVE' }), 200, 'PATCH /api/admin/players/:id');
  }

  /* ------------------------------ subscribers ------------------------------ */
  section('Newsletter & subscribers');

  const subscribers = await owner.get('/api/admin/subscribers?limit=5');
  expectStatus(subscribers, 200, 'GET /api/admin/subscribers');
  check('subscriber counts returned', typeof subscribers.body?.counts?.active === 'number');

  const addSubscriber = await owner.post('/api/admin/subscribers', {
    email: `added.${stamp}@example.com`,
    name: 'Added By Test',
    interests: ['Smoke'],
  });
  expectStatus(addSubscriber, 201, 'POST /api/admin/subscribers');
  const subscriberId = addSubscriber.body.subscriber.id;
  expectStatus(await owner.post('/api/admin/subscribers', { email: `added.${stamp}@example.com` }), 409, 'duplicate subscriber rejected');
  expectStatus(await owner.patch(`/api/admin/subscribers/${subscriberId}`, { status: 'UNSUBSCRIBED' }), 200, 'PATCH subscriber status');
  expectStatus(await owner.del(`/api/admin/subscribers/${subscriberId}`), 200, 'DELETE subscriber');

  const csv = await owner.get('/api/admin/subscribers/export.csv', { raw: true });
  expectStatus(csv, 200, 'GET /api/admin/subscribers/export.csv');
  check('CSV starts with a UTF-8 BOM', csv.text.startsWith('\uFEFF'));
  check('CSV header row present', csv.text.includes('email,name,status'));
  check('CSV neutralises spreadsheet formulas', !/,=/.test(csv.text) && !/,@/.test(csv.text));

  const json = await owner.get('/api/admin/subscribers/export.json');
  expectStatus(json, 200, 'GET /api/admin/subscribers/export.json');
  check('JSON export carries a timestamp', typeof json.body?.exportedAt === 'string');

  /* -------------------------------- contacts ------------------------------- */
  section('Inbox');

  const contacts = await owner.get('/api/admin/contacts?limit=5');
  expectStatus(contacts, 200, 'GET /api/admin/contacts');
  if (contacts.body.items[0]) {
    const messageId = contacts.body.items[0].id;
    expectStatus(await owner.get(`/api/admin/contacts/${messageId}`), 200, 'GET /api/admin/contacts/:id');
    expectStatus(await owner.patch(`/api/admin/contacts/${messageId}`, { status: 'REVIEWED', notes: 'Handled in smoke test' }), 200, 'PATCH contact status');
  }

  /* ---------------------------------- team --------------------------------- */
  section('Team management');

  const team = await owner.get('/api/admin/team');
  expectStatus(team, 200, 'GET /api/admin/team');
  check('team list hides password hashes', !team.text.includes('passwordHash') && !team.text.includes('$2'));

  const invite = await owner.post('/api/admin/team', {
    email: `smoke.editor.${stamp}@brainchild.games`,
    name: 'Smoke Editor',
    role: 'EDITOR',
  });
  expectStatus(invite, 201, 'POST /api/admin/team');
  check('temporary password returned once', typeof invite.body?.temporaryPassword === 'string' && invite.body.temporaryPassword.length >= 12);

  const memberId = invite.body.member.id;
  expectStatus(await owner.patch(`/api/admin/team/${memberId}`, { role: 'ADMIN' }), 200, 'PATCH /api/admin/team/:id');
  expectStatus(await owner.post(`/api/admin/team/${memberId}/reset-password`), 200, 'POST /api/admin/team/:id/reset-password');
  expectStatus(await owner.post(`/api/admin/team/${memberId}/unlock`), 200, 'POST /api/admin/team/:id/unlock');
  expectStatus(await owner.del(`/api/admin/team/${memberId}`, { confirm: 'wrong@example.com' }), 400, 'team delete needs email confirmation');
  expectStatus(
    await owner.del(`/api/admin/team/${memberId}`, { confirm: invite.body.member.email }),
    200,
    'DELETE /api/admin/team/:id'
  );

  /* --------------------------------- content ------------------------------- */
  section('Editable content & settings');

  const content = await owner.get('/api/admin/content');
  expectStatus(content, 200, 'GET /api/admin/content');
  check('content blocks include defaults', content.body.content.every((block: any) => block.defaultValue !== undefined));
  check('settings include brand', Boolean(content.body.settings.find((s: any) => s.key === 'site.brand')));

  const brandBefore = content.body.settings.find((s: any) => s.key === 'site.brand');
  const brandUpdate = await owner.put('/api/admin/content/settings/site.brand', {
    value: { ...brandBefore.value, tagline: 'Play. Discover. Repeat.' },
  });
  expectStatus(brandUpdate, 200, 'PUT /api/admin/content/settings/:key');
  expectStatus(await owner.post('/api/admin/content/settings/site.brand/reset'), 200, 'reset setting to default');
  expectStatus(await owner.put('/api/admin/content/nope.nope', { value: {} }), 404, 'unknown content key rejected');

  const hero = content.body.content.find((block: any) => block.key === 'about.hero');
  expectStatus(await owner.put('/api/admin/content/about.hero', { value: hero.value }), 200, 'PUT /api/admin/content/:key');
  expectStatus(await owner.post('/api/admin/content/about.hero/reset'), 200, 'reset content block');

  const siteAfter = await visitor.get('/api/public/site');
  check('public site still serves content after edits', Object.keys(siteAfter.body.content).length >= 8);

  /* -------------------------------- activity ------------------------------- */
  section('Audit trail & dashboard');

  const activity = await owner.get('/api/admin/activity?limit=10');
  expectStatus(activity, 200, 'GET /api/admin/activity');
  check('audit records were written', activity.body.items.length > 0, activity.body.items.length);
  check('audit exposes action filters', Array.isArray(activity.body.filters.actions));

  expectStatus(await owner.get('/api/admin/activity/stats'), 200, 'GET /api/admin/activity/stats');
  expectStatus(await owner.get('/api/admin/dashboard'), 200, 'GET /api/admin/dashboard');

  const backup = await owner.get('/api/admin/backup/export', { raw: true });
  expectStatus(backup, 200, 'GET /api/admin/backup/export');
  check('backup excludes admin accounts', !backup.text.includes('admin_users') && !backup.text.includes('passwordHash'));
  check('backup includes content', backup.text.includes('websiteContent'.slice(0, 8)) || backup.text.includes('"games"'));

  expectStatus(await owner.get('/api/admin/backup/system'), 200, 'GET /api/admin/backup/system');
  expectStatus(await owner.get('/api/admin/backup/roles'), 200, 'GET /api/admin/backup/roles');

  /* --------------------------- session termination -------------------------- */
  section('Sign-out');

  // A throwaway account is used so the demo logins are never disturbed.
  const deviceInvite = await owner.post('/api/admin/team', {
    email: `device.${stamp}@brainchild.games`,
    name: 'Second Device',
    role: 'EDITOR',
  });
  expectStatus(deviceInvite, 201, 'throwaway account for device session test');

  const temp = new Actor('temp-device');
  const tempCsrf = await temp.primeCsrf();
  check('fresh device receives a CSRF cookie', Boolean(tempCsrf));
  expectStatus(
    await temp.login(`device.${stamp}@brainchild.games`, deviceInvite.body.temporaryPassword),
    200,
    'second device signs in'
  );
  const tempSessions = await temp.get('/api/auth/sessions');
  const tempSession = tempSessions.body.sessions.find((s: any) => s.current);
  expectStatus(await temp.del(`/api/auth/sessions/${tempSession.id}`), 200, 'revoke own device session');
  expectStatus(await temp.get('/api/auth/me'), 401, 'revoked session can no longer act');

  expectStatus(
    await owner.del(`/api/admin/team/${deviceInvite.body.member.id}`, { confirm: `device.${stamp}@brainchild.games` }),
    200,
    'clean up the throwaway account'
  );

  expectStatus(await editor.post('/api/auth/logout'), 200, 'sign out');
  expectStatus(await editor.get('/api/auth/me'), 401, 'signed-out session rejected');

  const failed = summarize('Smoke test');
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error('\n  Smoke test crashed:', error instanceof Error ? error.stack : format(error));
  process.exit(1);
});
