/**
 * Local simulation of Vercel's serverless runtime.
 *
 * Vercel's @vercel/node runtime invokes the exported handler with raw Node
 * (IncomingMessage, ServerResponse) pairs — this harness does the same thing
 * on a plain HTTP server so the exact function entry (api/[...path].ts) can
 * be exercised end-to-end, including JSON bodies, cookies and multipart
 * uploads.
 *
 *   cd server && npx tsx ../scripts/vercel-sim.ts
 */
import http from 'node:http';
import handler from '../api/[...path].ts';

const PORT = Number(process.env.SIM_PORT || 3999);

const server = http.createServer((req, res) => {
  handler(req as never, res as never);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Vercel simulation listening on http://127.0.0.1:${PORT}`);
});
