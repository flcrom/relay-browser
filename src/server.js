import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Coordinator } from './coordinator.js';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const token = process.env.RELAY_TOKEN || 'dev-only-token';
const browserUrl = process.env.BROWSER_URL || 'http://localhost:6080/vnc.html?autoconnect=1&resize=scale';
const coordinator = new Coordinator({ ttlMs: Number(process.env.LEASE_TTL_MS || 300_000) });
const clients = new Set();
coordinator.subscribe(state => {
  const event = `data: ${JSON.stringify(state)}\n\n`;
  for (const client of clients) client.write(event);
});

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw Object.assign(new Error('Request too large'), { status: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}
function authorized(req) {
  return req.headers.authorization === `Bearer ${token}` || new URL(req.url, 'http://local').searchParams.get('token') === token;
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local');
      if (url.pathname.startsWith('/api/') && !authorized(req)) return json(res, 401, { error: 'Unauthorized' });
      if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, { ...coordinator.snapshot(), browserUrl });
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        res.write(`data: ${JSON.stringify(coordinator.snapshot())}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/takeover') {
        const data = await body(req);
        return json(res, 200, coordinator.requestTakeover(data.reason));
      }
      if (req.method === 'POST' && url.pathname === '/api/renew') {
        const data = await body(req);
        return json(res, 200, coordinator.renew(data.leaseId));
      }
      if (req.method === 'POST' && url.pathname === '/api/release') {
        const data = await body(req);
        return json(res, 200, coordinator.release(data.leaseId));
      }
      if (req.method === 'GET') {
        const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        if (requested.includes('..')) return json(res, 400, { error: 'Bad path' });
        const file = await readFile(join(root, requested));
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
        res.writeHead(200, { 'content-type': types[extname(requested)] || 'application/octet-stream' });
        return res.end(file);
      }
      json(res, 404, { error: 'Not found' });
    } catch (error) {
      json(res, error.status || 500, { error: error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, '0.0.0.0', () => console.log(`Relay Browser: http://localhost:${port}/?token=${token}`));
}
