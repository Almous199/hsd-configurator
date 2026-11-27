// Локальная проверка онлайн-версии без Catalyst: отдаёт catalyst/client/ по /app/ и функцию api по /server/api/
// с хранилищем в памяти (или в папке --dir). Вход имитируется: роль — ?as=admin|manager|warehouse в первом запросе
// (запоминается в cookie), по умолчанию admin. Только для разработки.
// Запуск: node scripts/serve-catalyst.js [--port 8790] [--dir <папка с forms/ calcs/ catalog.json>]
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handle, memoryStore } = require('../catalyst/functions/api/lib/handler.js');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const port = +arg('--port', 8790);
const client = join(root, 'catalyst/client');

/** Начальные данные: все *.json из папки (как Door calculation tool). */
export function loadDir(dir) {
  const init = {};
  const walk = (d) => readdirSync(d).forEach((n) => {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.json')) init[relative(dir, p).replaceAll('\\', '/')] = JSON.parse(readFileSync(p, 'utf8'));
  });
  if (dir && existsSync(dir)) walk(dir);
  return init;
}

export function startServer({ port: p = port, dir = arg('--dir') } = {}) {
  const store = memoryStore(loadDir(dir));
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
  const srv = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const asQ = u.searchParams.get('as');
    const cookie = /(?:^|; )as=(\w+)/.exec(req.headers.cookie || '');
    const role = asQ || (cookie && cookie[1]) || 'admin';
    const headers = asQ ? { 'Set-Cookie': `as=${asQ}; Path=/` } : {};
    if (u.pathname.startsWith('/server/api')) {
      let body;
      if (req.method === 'PUT') { const ch = []; for await (const c of req) ch.push(c); body = JSON.parse(Buffer.concat(ch).toString('utf8') || 'null'); }
      const user = role === 'none' ? null : { email: `${role}@local`, role };
      const r = await handle({ method: req.method, path: u.pathname.slice('/server/api'.length), body }, { user, store });
      res.writeHead(r.status, { ...headers, 'Content-Type': 'application/json' }); res.end(JSON.stringify(r.body)); return;
    }
    let f = u.pathname.replace(/^\/app\/?/, '') || 'index.html';
    if (u.pathname === '/') { res.writeHead(302, { Location: '/app/' }); res.end(); return; }
    f = join(client, decodeURIComponent(f));
    if (!f.startsWith(client) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { ...headers, 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  return new Promise((ok) => srv.listen(p, () => ok({ srv, store, url: `http://localhost:${p}/app/` })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().then(({ url }) => console.log(`Онлайн-версия локально: ${url}?as=admin | manager | warehouse`));
}
