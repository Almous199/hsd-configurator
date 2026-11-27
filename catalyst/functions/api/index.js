'use strict';
// Функция api (Advanced I/O, Zoho Catalyst). Адрес: /server/api/…  · /me — кто вошёл · /fs/<путь> — рабочая папка.
// Логика и права — lib/handler.js (покрыт тестами в репозитории), здесь только Catalyst: вход и Stratus.
const catalyst = require('zcatalyst-sdk-node');
const { handle, appRole } = require('./lib/handler');

const MAX_BODY = 20 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('Request too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function streamText(s) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    s.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    s.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    s.on('error', reject);
  });
}

const notFound = (e) => e && (e.statusCode === 404 || e.status === 404 || /not ?found|NoSuchKey|does not exist/i.test(String(e.message || e.code || '')));

function stratusStore(app) {
  const bucket = app.stratus().bucket(process.env.STRATUS_BUCKET || 'hsd-docs');
  return {
    async getDoc(key) {
      try { const txt = await streamText(await bucket.getObject(key)); return txt ? JSON.parse(txt) : null; }
      catch (e) { if (notFound(e)) return null; throw e; }
    },
    async hasDoc(key) { return bucket.headObject(key, { throwErr: false }); },
    async putDoc(key, obj) { await bucket.putObject(key, JSON.stringify(obj, null, 1), { contentType: 'application/json', overwrite: 'true' }); },
    async delDoc(key) { try { await bucket.deleteObject(key); } catch (e) { if (!notFound(e)) throw e; } },
  };
}

module.exports = async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  try {
    let user = null;
    try {
      const me = await catalyst.initialize(req, { scope: 'user' }).userManagement().getCurrentUser();
      if (me && me.email_id) {
        user = { email: me.email_id, name: [me.first_name, me.last_name].filter(Boolean).join(' '), role: appRole(me.role_details && me.role_details.role_name), catalystRole: me.role_details && me.role_details.role_name };
      }
    } catch (e) { user = null; }

    const method = (req.method || 'GET').toUpperCase();
    let body;
    if (method === 'PUT' || method === 'POST') {
      const txt = await readBody(req);
      try { body = txt ? JSON.parse(txt) : undefined; } catch (e) { return send(400, { error: 'Invalid JSON' }); }
    }
    const store = user ? stratusStore(catalyst.initialize(req, { scope: 'admin' })) : null;
    const r = await handle({ method, path: req.url, body }, { user, store });
    send(r.status, r.body);
  } catch (e) {
    send(500, { error: (e && e.message) || String(e) });
  }
};
