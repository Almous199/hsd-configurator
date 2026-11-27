// Функция api (Catalyst): права ролей, заморозка форм, слияние индексов.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handle, appRole, memoryStore } = require('../catalyst/functions/api/lib/handler.js');

const ADMIN = { email: 'admin@x', role: 'admin' };
const MGR = { email: 'mgr@x', role: 'manager' };
const WH = { email: 'wh@x', role: 'warehouse' };
const call = (store, user, method, path, body) => handle({ method, path, body }, { user, store });

function seed() {
  return memoryStore({
    'calcs/index.json': { app: 'door_calculator', kind: 'index', calcs: [
      { id: 'DSO-1', order: 'DSO-1', customer: 'ACME', doorType: 'Therm industrial', category: 'sectional', product: 'ISD01' },
    ] },
    'calcs/DSO-1.json': { id: 'DSO-1', spec: { lines: [1, 2] } },
    'forms/index.json': { app: 'hsd-configurator', kind: 'forms-index', forms: [{ id: 'DSO-1', customer: 'ACME' }, { id: 'DSO-2' }] },
    'forms/DSO-1.json': { id: 'DSO-1', status: 'frozen' },
    'forms/DSO-2.json': { id: 'DSO-2', status: 'draft' },
    'catalog.json': { saved: 'x' },
  });
}

test('роль Catalyst → роль приложения', () => {
  assert.equal(appRole('App Administrator'), 'admin');
  assert.equal(appRole('App User'), 'manager');
  assert.equal(appRole('Warehouse'), 'warehouse');
});

test('без входа — 401, /me отдаёт роль', async () => {
  const s = seed();
  assert.equal((await call(s, null, 'GET', '/me')).status, 401);
  const r = await call(s, MGR, 'GET', '/me');
  assert.deepEqual(r.body, { email: 'mgr@x', name: '', role: 'manager' });
});

test('менеджер: формы да, спецификации и каталог нет, из индекса спецификаций — только номера', async () => {
  const s = seed();
  assert.equal((await call(s, MGR, 'GET', '/fs/forms/index.json')).status, 200);
  assert.equal((await call(s, MGR, 'GET', '/fs/calcs/DSO-1.json')).status, 403);
  assert.equal((await call(s, MGR, 'GET', '/fs/catalog.json')).status, 403);
  assert.equal((await call(s, MGR, 'PUT', '/fs/calcs/DSO-9.json', { id: 'DSO-9' })).status, 403);
  const ix = await call(s, MGR, 'GET', '/fs/calcs/index.json');
  assert.equal(ix.status, 200);
  assert.deepEqual(Object.keys(ix.body.calcs[0]).sort(), ['app', 'category', 'id', 'product']);
});

test('склад: спецификации и каталог только чтение, формы — только список', async () => {
  const s = seed();
  assert.equal((await call(s, WH, 'GET', '/fs/calcs/DSO-1.json')).status, 200);
  assert.equal((await call(s, WH, 'GET', '/fs/catalog.json')).status, 200);
  assert.equal((await call(s, WH, 'PUT', '/fs/calcs/DSO-1.json', { id: 'DSO-1' })).status, 403);
  assert.equal((await call(s, WH, 'GET', '/fs/forms/index.json')).status, 200);
  assert.equal((await call(s, WH, 'GET', '/fs/forms/DSO-2.json')).status, 403);
});

test('замороженную форму менеджер не правит, админ может; черновик правится', async () => {
  const s = seed();
  assert.equal((await call(s, MGR, 'PUT', '/fs/forms/DSO-1.json', { id: 'DSO-1', x: 1 })).status, 409);
  assert.equal((await call(s, ADMIN, 'PUT', '/fs/forms/DSO-1.json', { id: 'DSO-1', x: 1 })).status, 200);
  assert.equal((await call(s, MGR, 'PUT', '/fs/forms/DSO-2.json', { id: 'DSO-2', x: 2 })).status, 200);
  assert.equal((await call(s, MGR, 'PUT', '/fs/forms/DSO-2.json', { id: 'DSO-3' })).status, 400);
});

test('индекс: запись со старой копией не стирает чужие строки; новая строка — только если файл есть', async () => {
  const s = seed();
  // Пользователь A прочитал индекс форм раньше, чем B добавил DSO-5.
  const stale = (await call(s, MGR, 'GET', '/fs/forms/index.json')).body;
  await call(s, MGR, 'PUT', '/fs/forms/DSO-5.json', { id: 'DSO-5' });
  const fresh = (await call(s, MGR, 'GET', '/fs/forms/index.json')).body;
  fresh.forms.push({ id: 'DSO-5', customer: 'B' });
  await call(s, MGR, 'PUT', '/fs/forms/index.json', fresh);
  // A пишет свою правку DSO-2 поверх старой копии
  stale.forms = stale.forms.map((r) => (r.id === 'DSO-2' ? { ...r, customer: 'A' } : r));
  stale.forms.push({ id: 'DSO-GHOST' }); // файла нет — строка не появится
  await call(s, MGR, 'PUT', '/fs/forms/index.json', stale);
  const ix = (await call(s, MGR, 'GET', '/fs/forms/index.json')).body;
  assert.deepEqual(ix.forms.map((r) => r.id).sort(), ['DSO-1', 'DSO-2', 'DSO-5']);
  assert.equal(ix.forms.find((r) => r.id === 'DSO-2').customer, 'A');
  assert.equal(ix.updatedBy, 'mgr@x');
});

test('удаление файла убирает строку индекса; удаление спецификации размораживает форму', async () => {
  const s = seed();
  assert.equal((await call(s, MGR, 'DELETE', '/fs/forms/DSO-2.json')).status, 200);
  assert.deepEqual((await call(s, MGR, 'GET', '/fs/forms/index.json')).body.forms.map((r) => r.id), ['DSO-1']);
  assert.equal((await call(s, MGR, 'DELETE', '/fs/calcs/DSO-1.json')).status, 403);
  assert.equal((await call(s, ADMIN, 'DELETE', '/fs/calcs/DSO-1.json')).status, 200);
  assert.equal((await call(s, ADMIN, 'GET', '/fs/calcs/DSO-1.json')).status, 404);
  assert.equal((await call(s, MGR, 'PUT', '/fs/forms/DSO-1.json', { id: 'DSO-1', x: 3 })).status, 200);
});

test('пути: неизвестные и опасные отклоняются', async () => {
  const s = seed();
  assert.equal((await call(s, ADMIN, 'GET', '/fs/../secret.json')).status, 404);
  assert.equal((await call(s, ADMIN, 'GET', '/fs/calcs/a%2Fb.json')).status, 404);
  assert.equal((await call(s, ADMIN, 'GET', '/fs/calcs/..json')).status, 400);
  assert.equal((await call(s, ADMIN, 'DELETE', '/fs/catalog.json')).status, 400);
  assert.equal((await call(s, ADMIN, 'GET', '/fs/forms/none.json')).status, 404);
});
