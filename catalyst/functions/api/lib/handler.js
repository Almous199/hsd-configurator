'use strict';
// Виртуальная рабочая папка «Door calculation tool» в облаке (Zoho Catalyst Stratus).
// Страницы работают с теми же путями, что и в папке на ПК: forms/index.json, forms/<id>.json,
// calcs/index.json, calcs/<id>.json, catalog.json, orders.json. Сервер добавляет только проверку роли
// и аккуратное обновление индексов (несколько пользователей пишут одновременно).
//
// Роли (план 27.11, согласован Alex):
//   admin     — всё (в т.ч. права инженера);
//   manager   — формы заказа: читать, создавать, править до заморозки, удалять; из calcs/index.json — только номера
//               (по ним справочник форм видит заморозку); спецификации и каталог не видит;
//   warehouse — спецификации, каталог, заказы и список форм только чтение.
// Заморозка (Alex 25.11): форму нельзя править, пока есть спецификация с тем же номером. Админ может (калькулятор
// сам помечает форму замороженной при сохранении спецификации).
//
// Индексы: страница присылает индекс целиком (читает → меняет свою строку → пишет). Сервер перечитывает текущий
// индекс и сливает: строки из присланного заменяют свои строки, новые добавляются только если файл есть,
// отсутствующие в присланном НЕ удаляются (их удаляет только DELETE файла). Так одновременные сохранения
// не стирают чужие строки.

const KINDS = { forms: 'forms', calcs: 'calcs' };
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const ROOT_FILES = new Set(['catalog.json', 'orders.json']);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Разбор пути: { type: 'index'|'doc'|'root', kind?, id?, key } или HttpError 404. */
function parsePath(p) {
  const path = String(p || '').replace(/^\/+/, '');
  if (ROOT_FILES.has(path)) return { type: 'root', key: path };
  const m = /^(forms|calcs)\/([^/]+)\.json$/.exec(path);
  if (!m) throw new HttpError(404, `Unknown path: ${path}`);
  const kind = KINDS[m[1]];
  if (m[2] === 'index') return { type: 'index', kind, key: `${kind}/index.json` };
  if (!ID_RE.test(m[2])) throw new HttpError(400, `Bad document id: ${m[2]}`);
  return { type: 'doc', kind, id: m[2], key: `${kind}/${m[2]}.json` };
}

/** Роль Catalyst → роль приложения. App Administrator → admin; роль с «warehouse»/«склад» → warehouse; иначе manager. */
function appRole(roleName) {
  const r = String(roleName || '').toLowerCase();
  if (r.includes('admin')) return 'admin';
  if (r.includes('warehouse') || r.includes('склад') || r.includes('store')) return 'warehouse';
  return 'manager';
}

function allowed(role, method, t) {
  if (role === 'admin') return true;
  const read = method === 'GET';
  if (role === 'manager') {
    if (t.kind === 'forms') return true;
    if (t.type === 'index' && t.kind === 'calcs') return read;
    return false;
  }
  if (role === 'warehouse') {
    if (!read) return false;
    // forms/index.json — справочник спецификаций (specs.html) показывает формы без спецификации; сами формы не нужны.
    return t.kind === 'calcs' || t.key === 'forms/index.json' || t.key === 'catalog.json' || t.key === 'orders.json';
  }
  return false;
}

const listKey = (kind) => (kind === 'forms' ? 'forms' : 'calcs');
const emptyIndex = (kind) => (kind === 'forms'
  ? { app: 'hsd-configurator', kind: 'forms-index', forms: [] }
  : { app: 'door_calculator', kind: 'index', calcs: [] });

async function readIndex(store, kind) {
  const ix = (await store.getDoc(`${kind}/index.json`)) || emptyIndex(kind);
  const k = listKey(kind);
  if (!Array.isArray(ix[k])) ix[k] = [];
  return ix;
}

function stamp() {
  const d = new Date();
  // Время Бангкока (UTC+7), как у страниц: «ГГГГ-ММ-ДД чч:мм».
  const b = new Date(d.getTime() + 7 * 3600e3).toISOString();
  return `${b.slice(0, 10)} ${b.slice(11, 16)}`;
}

async function mergeIndex(store, kind, body, user) {
  const k = listKey(kind);
  const incoming = body && Array.isArray(body[k]) ? body[k] : null;
  if (!incoming) throw new HttpError(400, `Index body must have an array «${k}»`);
  const cur = await readIndex(store, kind);
  const byId = new Map(cur[k].map((r, i) => [r && r.id, i]));
  let changed = false;
  for (const row of incoming) {
    if (!row || typeof row.id !== 'string' || !ID_RE.test(row.id)) continue;
    const i = byId.get(row.id);
    if (i !== undefined) {
      if (JSON.stringify(cur[k][i]) !== JSON.stringify(row)) { cur[k][i] = row; changed = true; }
    } else if (await store.hasDoc(`${kind}/${row.id}.json`)) {
      byId.set(row.id, cur[k].length); cur[k].push(row); changed = true;
    }
  }
  if (changed) {
    const head = { ...body }; delete head[k];
    const out = { ...cur, ...head, [k]: cur[k], updated: stamp(), updatedBy: user.email };
    await store.putDoc(`${kind}/index.json`, out);
    return out;
  }
  return cur;
}

async function removeFromIndex(store, kind, id, user) {
  const k = listKey(kind);
  const cur = await readIndex(store, kind);
  const rows = cur[k].filter((r) => r && r.id !== id);
  if (rows.length !== cur[k].length) await store.putDoc(`${kind}/index.json`, { ...cur, [k]: rows, updated: stamp(), updatedBy: user.email });
}

/**
 * Обработать запрос.
 * @param {{method:string, path:string, body?:any}} req  path — без префикса функции, напр. '/fs/forms/index.json' или '/me'
 * @param {{user:{email:string, role:string, name?:string}|null, store:object}} ctx
 * @returns {Promise<{status:number, body:any}>}
 */
async function handle(req, ctx) {
  try {
    const { user, store } = ctx;
    if (!user) throw new HttpError(401, 'Sign-in required');
    const method = String(req.method || 'GET').toUpperCase();
    const url = String(req.path || '/').split('?')[0];

    if (url === '/me' || url === '/me/') {
      if (method !== 'GET') throw new HttpError(405, 'Method not allowed');
      return { status: 200, body: { email: user.email, name: user.name || '', role: user.role } };
    }
    if (!url.startsWith('/fs/')) throw new HttpError(404, `Not found: ${url}`);
    const t = parsePath(decodeURIComponent(url.slice(4)));
    if (!['GET', 'PUT', 'DELETE'].includes(method)) throw new HttpError(405, 'Method not allowed');
    if (!allowed(user.role, method, t)) throw new HttpError(403, `Role «${user.role}» cannot ${method} ${t.key}`);

    if (method === 'GET') {
      if (t.type === 'index') {
        const ix = await store.getDoc(t.key);
        if (!ix) return { status: 404, body: { error: 'Not found' } };
        if (t.kind === 'calcs' && user.role === 'manager') {
          // Менеджер видит только номера спецификаций (для статуса «заморожена»), без состава и клиентов.
          return { status: 200, body: { app: ix.app, kind: ix.kind, calcs: (ix.calcs || []).map((r) => ({ id: r.id, app: r.app, category: r.category, product: r.product })) } };
        }
        return { status: 200, body: ix };
      }
      const doc = await store.getDoc(t.key);
      return doc ? { status: 200, body: doc } : { status: 404, body: { error: 'Not found' } };
    }

    if (method === 'PUT') {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'JSON object expected');
      if (t.type === 'index') return { status: 200, body: await mergeIndex(store, t.kind, body, user) };
      if (t.type === 'doc') {
        if (body.id !== undefined && body.id !== t.id) throw new HttpError(400, `Document id «${body.id}» does not match path «${t.id}»`);
        if (t.kind === 'forms' && user.role !== 'admin') {
          const calcs = await readIndex(store, 'calcs');
          if (calcs.calcs.some((r) => r && r.id === t.id)) throw new HttpError(409, `Order form ${t.id} is frozen: specification ${t.id} exists`);
        }
      }
      await store.putDoc(t.key, body);
      return { status: 200, body: { ok: true, path: t.key } };
    }

    // DELETE
    if (t.type === 'index') throw new HttpError(400, 'Index cannot be deleted');
    if (t.type === 'root') throw new HttpError(400, `${t.key} cannot be deleted`);
    await store.delDoc(t.key);
    await removeFromIndex(store, t.kind, t.id, user);
    return { status: 200, body: { ok: true, deleted: t.key } };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
    return { status: 500, body: { error: (e && e.message) || String(e) } };
  }
}

/** Хранилище в памяти — для тестов и локального запуска. */
function memoryStore(init = {}) {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    m,
    async getDoc(key) { return m.has(key) ? JSON.parse(m.get(key)) : null; },
    async hasDoc(key) { return m.has(key); },
    async putDoc(key, obj) { m.set(key, JSON.stringify(obj)); },
    async delDoc(key) { m.delete(key); },
  };
}

module.exports = { handle, parsePath, appRole, allowed, memoryStore, HttpError };
