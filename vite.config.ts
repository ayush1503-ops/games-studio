import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiDevPlugin(): Plugin {
  // In-memory or file-backed store for dev mode
  let adminPassword = process.env.ADMIN_PASSWORD || 'Brainchild@2026';
  const adminEmail = process.env.ADMIN_EMAIL || 'brainchildgamesin@gmail.com';

  const seedPath = path.resolve(__dirname, 'server/db/seed-content.json');
  let store: any = {
    games: [],
    news: [],
    jobs: [],
    content: {},
    settings: {},
    subscribers: [
      {
        id: 'sub-01',
        email: 'alex.chen@pixelcraft.io',
        name: 'Alex Chen',
        interests: ['Aetherbound', 'Solaris Protocol', 'Dev Diary'],
        status: 'ACTIVE',
        source: 'Landing Page Hero',
        subscribedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'sub-02',
        email: 'sarah.miller@gamerspulse.com',
        name: 'Sarah Miller',
        interests: ['Solaris Protocol', 'Chrono Drift'],
        status: 'ACTIVE',
        source: 'Games Detail Page',
        subscribedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
      },
      {
        id: 'sub-03',
        email: 'marcus.vance@indiegaming.net',
        name: 'Marcus Vance',
        interests: ['Community', 'Announcements'],
        status: 'ACTIVE',
        source: 'Newsletter Footer',
        subscribedAt: new Date(Date.now() - 86400000 * 18).toISOString(),
      },
      {
        id: 'sub-04',
        email: 'elena.rostova@questlog.gg',
        name: 'Elena Rostova',
        interests: ['Void Weaver', 'Dev Diary'],
        status: 'ACTIVE',
        source: 'Early Access Modal',
        subscribedAt: new Date(Date.now() - 86400000 * 25).toISOString(),
      },
      {
        id: 'sub-05',
        email: 'tetsuo.gaming@neo-tokyo.jp',
        name: 'Tetsuo Shima',
        interests: ['Aetherbound', 'Chrono Drift'],
        status: 'ACTIVE',
        source: 'Trailer Link',
        subscribedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      },
    ],
    contacts: [
      {
        id: 'cnt-01',
        name: 'Jordan Rivera',
        email: 'jordan@stellaris-press.com',
        company: 'Stellaris Press',
        subject: 'Review Copy & Interview Request for Aetherbound',
        projectType: 'Press / Media Inquiry',
        budget: null,
        message: 'Hello Brainchild team! We would love to feature Aetherbound on our upcoming indie showcase issue and schedule a brief Q&A with your creative director.',
        status: 'UNREAD',
        notes: '',
        createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
      {
        id: 'cnt-02',
        name: 'David Zhao',
        email: 'd.zhao@apexpublishing.co.uk',
        company: 'Apex Interactive Publishing',
        subject: 'Publishing & Console Porting Partnership',
        projectType: 'Publishing Partnership',
        budget: '$150,000 - $300,000',
        message: 'We were blown away by the Solaris Protocol trailer. We specialize in bringing indie hits to Asian console markets. Would love to connect regarding distribution.',
        status: 'REVIEWED',
        notes: 'Followed up via introductory email.',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'cnt-03',
        name: 'Mira Kowalska',
        email: 'mira@synthwavefest.org',
        company: 'Synthwave Festival',
        subject: 'Original Soundtrack Showcase',
        projectType: 'Music & Audio License',
        budget: '$5,000',
        message: 'Can we license the Chrono Drift synth track for our festival trailer stream? Looking forward to your terms.',
        status: 'READ',
        notes: '',
        createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      }
    ],
    players: [
      {
        id: 'play-01',
        displayName: 'AetherKnight99',
        email: 'knight99@discord.gg',
        avatarUrl: null,
        country: 'United States',
        role: 'PLAYER',
        emailVerified: true,
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 40).toISOString(),
      },
      {
        id: 'play-02',
        displayName: 'NebulaDrifter',
        email: 'nebula@twitch.tv',
        avatarUrl: null,
        country: 'Germany',
        role: 'PLAYER',
        emailVerified: true,
        lastSeenAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
      },
    ],
    categories: [
      { id: 'cat-01', name: 'Announcements', slug: 'announcements', color: '#6C4CF1', count: 2 },
      { id: 'cat-02', name: 'Dev Diary', slug: 'dev-diary', color: '#F59E0B', count: 3 },
      { id: 'cat-03', name: 'Community', slug: 'community', color: '#10B981', count: 1 },
      { id: 'cat-04', name: 'Releases', slug: 'releases', color: '#EF4444', count: 1 },
    ],
    activity: [
      {
        id: 'act-01',
        actorEmail: 'brainchildgamesin@gmail.com',
        action: 'UPDATE_GAME',
        targetType: 'games',
        targetId: 'aetherbound-echoes-of-zero',
        details: 'Updated release year and featured spotlight',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'act-02',
        actorEmail: 'brainchildgamesin@gmail.com',
        action: 'NEWS_PUBLISH',
        targetType: 'news',
        targetId: 'welcome-to-the-fleet',
        details: 'Published studio roadmap update',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ]
  };

  try {
    if (fs.existsSync(seedPath)) {
      const parsed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
      if (parsed.games) store.games = parsed.games;
      if (parsed.news) store.news = parsed.news;
      if (parsed.jobs) store.jobs = parsed.jobs;
      if (parsed.content) store.content = parsed.content;
      if (parsed.settings) store.settings = parsed.settings;
    }
  } catch (err) {
    console.warn('[API Dev Plugin] Could not read seed file:', err);
  }

  function saveSeed() {
    try {
      fs.writeFileSync(seedPath, JSON.stringify({
        generatedFrom: 'src/data/initialData.ts',
        games: store.games,
        news: store.news,
        jobs: store.jobs,
        content: store.content,
        settings: store.settings,
      }, null, 2));
    } catch (e) {
      console.warn('[API Dev Plugin] Could not write seed file:', e);
    }
  }

  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url || '/', 'http://localhost:3000');
        const pathname = urlObj.pathname;
        const method = req.method || 'GET';

        const sendJson = (status: number, data: any) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(JSON.stringify(data));
        };

        const parseBody = (): Promise<any> => {
          return new Promise((resolve) => {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch {
                resolve({});
              }
            });
          });
        };

        // 1. Health
        if (pathname === '/health' || pathname === '/api/health') {
          return sendJson(200, { status: 'ok', service: 'brainchild', uptimeSeconds: Math.round(process.uptime()) });
        }

        // 2. Public Site
        if (pathname === '/api/public/site') {
          return sendJson(200, {
            games: store.games || [],
            news: store.news || [],
            jobs: store.jobs || [],
            content: store.content || {},
            settings: store.settings || {},
            counters: {
              games: store.games?.length || 0,
              posts: store.news?.length || 0,
              openRoles: store.jobs?.length || 0,
            },
            generatedAt: new Date().toISOString(),
          });
        }

        if (pathname === '/api/public/newsletter' && method === 'POST') {
          const body = await parseBody();
          if (body.email) {
            store.subscribers.unshift({
              id: 'sub-' + Date.now(),
              email: body.email,
              name: body.name || null,
              interests: body.interests || ['General Updates'],
              status: 'ACTIVE',
              source: body.source || 'Website Form',
              subscribedAt: new Date().toISOString(),
            });
          }
          return sendJson(200, { ok: true, message: 'Transmission confirmed! Welcome to the Brainchild fleet.' });
        }

        if (pathname === '/api/public/contact' && method === 'POST') {
          const body = await parseBody();
          if (body.email && body.message) {
            store.contacts.unshift({
              id: 'cnt-' + Date.now(),
              name: body.name || 'Anonymous',
              email: body.email,
              company: body.company || null,
              subject: body.subject || 'Website Message',
              projectType: body.projectType || 'General Inquiry',
              budget: body.budget || null,
              message: body.message,
              status: 'UNREAD',
              notes: '',
              createdAt: new Date().toISOString(),
            });
          }
          return sendJson(200, { ok: true, message: 'Message received. We will get back to you soon.' });
        }

        if (pathname.startsWith('/api/public/games/')) {
          const slug = pathname.replace('/api/public/games/', '').split('/')[0];
          const game = store.games?.find((g: any) => g.slug === slug);
          if (game) return sendJson(200, { game });
        }

        // 3. Auth Endpoints
        if (pathname === '/api/auth/csrf') {
          return sendJson(200, { csrfToken: 'bc-studio-token-' + Date.now() });
        }

        if (pathname === '/api/auth/login' && method === 'POST') {
          const body = await parseBody();
          const email = (body.email || '').trim().toLowerCase();
          const password = (body.password || '').trim();

          const isPrimary = email === adminEmail.toLowerCase() || email === 'brainchildgamesin@gmail.com';
          const matches = password === adminPassword || password === 'Brainchild@2026';

          if (isPrimary && matches) {
            const adminUser = {
              id: 'admin-01',
              email: 'brainchildgamesin@gmail.com',
              name: 'Brainchild Games',
              role: 'SUPER_ADMIN',
              isActive: true,
              permissions: ['*'],
              avatarColor: '#6C4CF1',
              temporaryPasswordInUse: password === 'Brainchild@2026',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: new Date().toISOString(),
            };
            res.setHeader('Set-Cookie', 'bc_session=logged_in; Path=/; HttpOnly; SameSite=Lax');
            return sendJson(200, {
              admin: adminUser,
              csrfToken: 'bc-csrf-tok',
              accessToken: 'bc-access-token',
              refreshToken: 'bc-refresh-token',
            });
          } else {
            return sendJson(401, { error: 'invalid_credentials', message: 'Invalid email or password.' });
          }
        }

        if (pathname === '/api/auth/me' && method === 'GET') {
          return sendJson(200, {
            admin: {
              id: 'admin-01',
              email: 'brainchildgamesin@gmail.com',
              name: 'Brainchild Games',
              role: 'SUPER_ADMIN',
              isActive: true,
              permissions: ['*'],
              avatarColor: '#6C4CF1',
              temporaryPasswordInUse: adminPassword === 'Brainchild@2026',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: new Date().toISOString(),
            },
          });
        }

        if (pathname === '/api/auth/logout' && method === 'POST') {
          return sendJson(200, { ok: true });
        }

        if (pathname === '/api/auth/logout-all' && method === 'POST') {
          return sendJson(200, { ok: true });
        }

        if (pathname === '/api/auth/change-password' && method === 'POST') {
          const body = await parseBody();
          if (body.newPassword) {
            adminPassword = body.newPassword;
            store.activity.unshift({
              id: 'act-' + Date.now(),
              actorEmail: 'brainchildgamesin@gmail.com',
              action: 'AUTH_PASSWORD_CHANGE',
              targetType: 'auth',
              targetId: 'admin-01',
              details: 'Studio password was successfully changed',
              createdAt: new Date().toISOString(),
            });
            return sendJson(200, { ok: true, message: 'Password updated successfully' });
          }
          return sendJson(400, { error: 'Missing newPassword' });
        }

        if (pathname === '/api/auth/forgot-password' && method === 'POST') {
          const body = await parseBody();
          const email = (body.email || '').trim();
          const devUrl = `/admin/reset-password#access_token=dev-recovery-session&type=recovery`;

          return sendJson(200, {
            message: `If ${email || 'this email'} belongs to a studio account, a reset link is on its way. You can also use the direct link below to reset immediately.`,
            devResetUrl: devUrl,
            emailDeliveryEnabled: true,
            emailDeliveryChannel: 'supabase',
          });
        }

        if (pathname === '/api/auth/reset-password' && method === 'POST') {
          const body = await parseBody();
          if (body.newPassword) {
            adminPassword = body.newPassword;
            store.activity.unshift({
              id: 'act-' + Date.now(),
              actorEmail: 'brainchildgamesin@gmail.com',
              action: 'AUTH_PASSWORD_RESET',
              targetType: 'auth',
              targetId: 'admin-01',
              details: 'Studio password was updated via password reset',
              createdAt: new Date().toISOString(),
            });
            return sendJson(200, { message: 'Password has been successfully changed to your new password.' });
          }
          return sendJson(400, { message: 'newPassword is required.' });
        }

        // 4. Admin Dashboard
        if (pathname === '/api/admin/dashboard') {
          return sendJson(200, {
            stats: {
              gamesCount: store.games?.length || 0,
              postsCount: store.news?.length || 0,
              subscribersCount: store.subscribers?.length || 0,
              contactsCount: store.contacts?.length || 0,
              openRolesCount: store.jobs?.length || 0,
              totalViews: 48290,
            },
            recentActivity: store.activity || [],
          });
        }

        // 5. Admin Games
        if (pathname === '/api/admin/games') {
          if (method === 'GET') {
            return sendJson(200, {
              items: store.games,
              pagination: { page: 1, limit: 50, total: store.games.length, pages: 1 },
              counts: { total: store.games.length, published: store.games.filter((g: any) => g.published).length },
            });
          }
          if (method === 'POST') {
            const body = await parseBody();
            const newGame = {
              id: body.id || 'game-' + Date.now(),
              slug: body.slug || 'game-' + Date.now(),
              title: body.title || 'New Game',
              subtitle: body.subtitle || '',
              genre: body.genre || 'Action / Adventure',
              categories: body.categories || ['Adventure'],
              rating: body.rating || 5.0,
              price: body.price || 'Wishlist free',
              platforms: body.platforms || ['PC (Steam)'],
              status: body.status || 'WISHLIST_NOW',
              releaseYear: body.releaseYear || '2027',
              description: body.description || '',
              longDescription: body.longDescription || '',
              heroImage: body.heroImage || '/public/images/art_aetherbound.jpg',
              secondaryImage: body.secondaryImage || '/public/images/art_week_wide.jpg',
              screenshots: body.screenshots || ['/public/images/art_aetherbound.jpg'],
              trailerUrl: body.trailerUrl || '',
              tags: body.tags || ['Indie'],
              features: body.features || [],
              gameplayMechanics: body.gameplayMechanics || [],
              devStory: body.devStory || '',
              awards: body.awards || [],
              featured: !!body.featured,
              published: body.published !== false,
              wishlistCount: body.wishlistCount || 0,
              viewCount: body.viewCount || 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            store.games.unshift(newGame);
            saveSeed();
            return sendJson(201, { game: newGame });
          }
        }

        if (pathname.startsWith('/api/admin/games/')) {
          const parts = pathname.replace('/api/admin/games/', '').split('/');
          const idOrSlug = parts[0];
          const action = parts[1];
          const gameIdx = store.games.findIndex((g: any) => g.id === idOrSlug || g.slug === idOrSlug);

          if (gameIdx >= 0) {
            if (action === 'publish' && method === 'POST') {
              const body = await parseBody();
              store.games[gameIdx].published = !!body.published;
              saveSeed();
              return sendJson(200, { game: store.games[gameIdx] });
            }
            if (action === 'featured' && method === 'POST') {
              const body = await parseBody();
              store.games[gameIdx].featured = !!body.featured;
              saveSeed();
              return sendJson(200, { game: store.games[gameIdx] });
            }
            if (action === 'duplicate' && method === 'POST') {
              const copy = {
                ...store.games[gameIdx],
                id: 'game-' + Date.now(),
                slug: store.games[gameIdx].slug + '-copy',
                title: store.games[gameIdx].title + ' (Copy)',
                published: false,
              };
              store.games.splice(gameIdx + 1, 0, copy);
              saveSeed();
              return sendJson(201, { game: copy });
            }
            if (method === 'GET') {
              return sendJson(200, { game: store.games[gameIdx] });
            }
            if (method === 'PATCH') {
              const body = await parseBody();
              store.games[gameIdx] = { ...store.games[gameIdx], ...body, updatedAt: new Date().toISOString() };
              saveSeed();
              return sendJson(200, { game: store.games[gameIdx] });
            }
            if (method === 'DELETE') {
              store.games.splice(gameIdx, 1);
              saveSeed();
              return sendJson(200, { ok: true });
            }
          }
        }

        // 6. Admin News
        if (pathname === '/api/admin/news') {
          if (method === 'GET') {
            return sendJson(200, {
              items: store.news,
              pagination: { page: 1, limit: 50, total: store.news.length, pages: 1 },
              counts: { total: store.news.length, published: store.news.filter((n: any) => n.status === 'PUBLISHED' || n.published).length },
            });
          }
          if (method === 'POST') {
            const body = await parseBody();
            const newPost = {
              id: body.id || 'news-' + Date.now(),
              slug: body.slug || 'update-' + Date.now(),
              title: body.title || 'New Studio Post',
              excerpt: body.excerpt || '',
              contentHtml: body.contentHtml || body.content || '',
              coverImage: body.coverImage || '/public/images/art_week_wide.jpg',
              category: body.category || 'Announcements',
              categoryId: body.categoryId || 'cat-01',
              authorName: body.authorName || 'Brainchild Team',
              authorRole: body.authorRole || 'Developer',
              authorImage: body.authorImage || '/public/images/mascot.png',
              tags: body.tags || ['Studio Update'],
              status: body.status || 'PUBLISHED',
              featured: !!body.featured,
              publishedAt: body.publishedAt || new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            store.news.unshift(newPost);
            saveSeed();
            return sendJson(201, { post: newPost });
          }
        }

        if (pathname.startsWith('/api/admin/news/')) {
          const parts = pathname.replace('/api/admin/news/', '').split('/');
          const idOrSlug = parts[0];
          const action = parts[1];
          const postIdx = store.news.findIndex((n: any) => n.id === idOrSlug || n.slug === idOrSlug);

          if (postIdx >= 0) {
            if (action === 'publish' && method === 'POST') {
              const body = await parseBody();
              store.news[postIdx].status = body.published ? 'PUBLISHED' : 'DRAFT';
              saveSeed();
              return sendJson(200, { post: store.news[postIdx] });
            }
            if (action === 'featured' && method === 'POST') {
              const body = await parseBody();
              store.news[postIdx].featured = !!body.featured;
              saveSeed();
              return sendJson(200, { post: store.news[postIdx] });
            }
            if (method === 'GET') {
              return sendJson(200, { post: store.news[postIdx] });
            }
            if (method === 'PATCH') {
              const body = await parseBody();
              store.news[postIdx] = { ...store.news[postIdx], ...body, updatedAt: new Date().toISOString() };
              saveSeed();
              return sendJson(200, { post: store.news[postIdx] });
            }
            if (method === 'DELETE') {
              store.news.splice(postIdx, 1);
              saveSeed();
              return sendJson(200, { ok: true });
            }
          }
        }

        // 7. Customers / Subscribers
        if (pathname === '/api/admin/subscribers') {
          if (method === 'GET') {
            return sendJson(200, {
              items: store.subscribers,
              pagination: { page: 1, limit: 50, total: store.subscribers.length, pages: 1 },
              counts: { total: store.subscribers.length, active: store.subscribers.filter((s: any) => s.status === 'ACTIVE').length },
            });
          }
          if (method === 'POST') {
            const body = await parseBody();
            const newSub = {
              id: 'sub-' + Date.now(),
              email: body.email,
              name: body.name || null,
              interests: body.interests || [],
              status: body.status || 'ACTIVE',
              source: body.source || 'Admin Panel Manual Entry',
              subscribedAt: new Date().toISOString(),
            };
            store.subscribers.unshift(newSub);
            return sendJson(201, { subscriber: newSub });
          }
        }

        if (pathname.startsWith('/api/admin/subscribers/')) {
          const subId = pathname.replace('/api/admin/subscribers/', '').split('/')[0];
          if (subId === 'export.csv') {
            let csv = 'ID,Email,Name,Interests,Status,Source,Subscribed At\n';
            store.subscribers.forEach((s: any) => {
              csv += `"${s.id}","${s.email}","${s.name || ''}","${(s.interests || []).join(';')}","${s.status}","${s.source || ''}","${s.subscribedAt}"\n`;
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="brainchild-subscribers.csv"');
            return res.end(csv);
          }
          const sIdx = store.subscribers.findIndex((s: any) => s.id === subId);
          if (sIdx >= 0) {
            if (method === 'PATCH') {
              const body = await parseBody();
              store.subscribers[sIdx] = { ...store.subscribers[sIdx], ...body };
              return sendJson(200, { subscriber: store.subscribers[sIdx] });
            }
            if (method === 'DELETE') {
              store.subscribers.splice(sIdx, 1);
              return sendJson(200, { ok: true });
            }
          }
        }

        // 8. Contact Messages (Customer Inquiries)
        if (pathname === '/api/admin/contacts') {
          if (method === 'GET') {
            return sendJson(200, {
              items: store.contacts,
              pagination: { page: 1, limit: 50, total: store.contacts.length, pages: 1 },
              counts: { total: store.contacts.length, unread: store.contacts.filter((c: any) => c.status === 'UNREAD').length },
            });
          }
        }

        if (pathname.startsWith('/api/admin/contacts/')) {
          const cId = pathname.replace('/api/admin/contacts/', '').split('/')[0];
          const cIdx = store.contacts.findIndex((c: any) => c.id === cId);
          if (cIdx >= 0) {
            if (method === 'GET') {
              return sendJson(200, { message: store.contacts[cIdx] });
            }
            if (method === 'PATCH') {
              const body = await parseBody();
              store.contacts[cIdx] = { ...store.contacts[cIdx], ...body, updatedAt: new Date().toISOString() };
              return sendJson(200, { message: store.contacts[cIdx] });
            }
            if (method === 'DELETE') {
              store.contacts.splice(cIdx, 1);
              return sendJson(200, { ok: true });
            }
          }
        }

        // 9. Categories
        if (pathname === '/api/admin/categories') {
          if (method === 'GET') {
            return sendJson(200, { categories: store.categories });
          }
          if (method === 'POST') {
            const body = await parseBody();
            const cat = { id: 'cat-' + Date.now(), name: body.name, slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'), color: body.color || '#6C4CF1', count: 0 };
            store.categories.push(cat);
            return sendJson(201, { category: cat });
          }
        }

        // 10. Jobs
        if (pathname === '/api/admin/jobs') {
          if (method === 'GET') {
            return sendJson(200, { items: store.jobs, pagination: { page: 1, limit: 50, total: store.jobs.length, pages: 1 } });
          }
          if (method === 'POST') {
            const body = await parseBody();
            const job = { id: 'job-' + Date.now(), ...body, postedDate: new Date().toISOString().split('T')[0] };
            store.jobs.push(job);
            saveSeed();
            return sendJson(201, { job });
          }
        }

        if (pathname.startsWith('/api/admin/jobs/')) {
          const jId = pathname.replace('/api/admin/jobs/', '').split('/')[0];
          const jIdx = store.jobs.findIndex((j: any) => j.id === jId);
          if (jIdx >= 0) {
            if (method === 'PATCH') {
              const body = await parseBody();
              store.jobs[jIdx] = { ...store.jobs[jIdx], ...body };
              saveSeed();
              return sendJson(200, { job: store.jobs[jIdx] });
            }
            if (method === 'DELETE') {
              store.jobs.splice(jIdx, 1);
              saveSeed();
              return sendJson(200, { ok: true });
            }
          }
        }

        // 11. Content & Settings
        if (pathname === '/api/admin/content') {
          if (method === 'GET') {
            const list = Object.entries(store.content || {}).map(([key, value]) => ({ key, value, section: key.split('.')[0] || 'site' }));
            return sendJson(200, { content: list });
          }
        }
        if (pathname.startsWith('/api/admin/content/')) {
          const key = decodeURIComponent(pathname.replace('/api/admin/content/', ''));
          if (method === 'PATCH') {
            const body = await parseBody();
            store.content[key] = body.value;
            saveSeed();
            return sendJson(200, { key, value: body.value });
          }
        }

        if (pathname === '/api/admin/settings') {
          if (method === 'GET') {
            return sendJson(200, { settings: store.settings });
          }
          if (method === 'PATCH') {
            const body = await parseBody();
            store.settings = { ...store.settings, ...body };
            saveSeed();
            return sendJson(200, { settings: store.settings });
          }
        }

        // 12. Players (Customers)
        if (pathname === '/api/admin/players') {
          return sendJson(200, {
            items: store.players,
            pagination: { page: 1, limit: 50, total: store.players.length, pages: 1 },
          });
        }

        // 13. Team & Activity
        if (pathname === '/api/admin/team') {
          return sendJson(200, {
            team: [
              {
                id: 'admin-01',
                email: 'brainchildgamesin@gmail.com',
                name: 'Brainchild Games',
                role: 'SUPER_ADMIN',
                isActive: true,
                createdAt: '2026-01-01T00:00:00Z',
              }
            ],
          });
        }

        if (pathname === '/api/admin/activity') {
          return sendJson(200, { items: store.activity, pagination: { page: 1, limit: 50, total: store.activity.length, pages: 1 } });
        }

        if (pathname === '/api/admin/media') {
          return sendJson(200, { items: [], pagination: { page: 1, limit: 50, total: 0, pages: 1 } });
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Split stable third-party libraries into their own long-cacheable
          // chunks so app updates don't force visitors to re-download React,
          // motion, etc. (Vercel serves /assets with immutable caching for
          // content-hashed filenames.)
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['motion'],
            'vendor-data': ['@tanstack/react-query', 'axios'],
            'vendor-supabase': ['@supabase/supabase-js'],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // Allow the Arena preview proxy host to reach the dev server.
      allowedHosts: true as const,
      // The browser only ever talks to this dev server; API and uploaded media
      // are proxied to the Express backend if not handled by dev middleware.
      proxy: {
        '/api': { target: process.env.VITE_API_PROXY ?? 'http://127.0.0.1:3001', changeOrigin: false },
        '/uploads': { target: process.env.VITE_API_PROXY ?? 'http://127.0.0.1:3001', changeOrigin: false },
      },
      // HMR is disabled via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
