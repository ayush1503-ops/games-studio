import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const DEFAULT_SUPABASE_URL = 'https://gwmljctpddazmjmrrqjy.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3bWxqY3RwZGRhem1qbXJycWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDgwMzcsImV4cCI6MjEwNTQ4NDAzN30.8_HDN_B70TmcfMZtUcOkIDfoY-SCbvzHho7IC4JS73w';

function getCleanSupabaseUrl(): string {
  const raw = process.env.VITE_SUPABASE_URL;
  if (!raw || raw.includes('YOUR-PROJECT-REF') || raw.includes('placeholder')) {
    return DEFAULT_SUPABASE_URL;
  }
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

function getSupabaseAnonKey(): string {
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key || key.includes('your-publishable-key') || key.includes('placeholder')) {
    return DEFAULT_SUPABASE_ANON_KEY;
  }
  return key;
}

function supabaseAuthPlugin(): Plugin {
  const handler = (req: any, res: any, next: any) => {
    const url = getCleanSupabaseUrl();
    const key = getSupabaseAnonKey();

    if (req.url?.startsWith('/api/auth/forgot-password') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const { email, redirectTo } = parsed;
          const targetUrl = `${url}/auth/v1/recover`;
          const resp = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'apikey': key,
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, redirect_to: redirectTo }),
          });
          const text = await resp.text();
          res.statusCode = resp.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text || '{}');
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Failed to process forgot password request' }));
        }
      });
      return;
    }

    if (req.url?.startsWith('/api/auth/login') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const { email, password } = parsed;
          const targetUrl = `${url}/auth/v1/token?grant_type=password`;
          const resp = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'apikey': key,
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });
          const text = await resp.text();
          res.statusCode = resp.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text || '{}');
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Login request failed' }));
        }
      });
      return;
    }

    if (req.url?.startsWith('/api/auth/verify-otp') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const targetUrl = `${url}/auth/v1/verify`;
          const resp = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'apikey': key,
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(parsed),
          });
          const text = await resp.text();
          res.statusCode = resp.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text || '{}');
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'OTP verification failed' }));
        }
      });
      return;
    }

    if (req.url?.startsWith('/api/auth/update-password') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const authHeader = req.headers['authorization'] || `Bearer ${parsed.accessToken}`;
          const targetUrl = `${url}/auth/v1/user`;
          const resp = await fetch(targetUrl, {
            method: 'PUT',
            headers: {
              'apikey': key,
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: parsed.password }),
          });
          const text = await resp.text();
          res.statusCode = resp.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text || '{}');
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Password update failed' }));
        }
      });
      return;
    }

    next();
  };

  return {
    name: 'supabase-auth-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), supabaseAuthPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api/supabase-proxy': {
        target: DEFAULT_SUPABASE_URL,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/supabase-proxy/, ''),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api/supabase-proxy': {
        target: DEFAULT_SUPABASE_URL,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/supabase-proxy/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react', 'canvas-confetti'],
        },
      },
    },
  },
});
