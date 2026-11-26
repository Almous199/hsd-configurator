// Общая рабочая папка справочника спецификаций (до переезда на Zoho Catalyst).
// Папка `Web constructor\Door calculation tool`: calcs/index.json + calcs/<id>.json (пишут оба калькулятора),
// forms/index.json + forms/<id>.json (формы заказа скоростных). Доступ — File System Access API (Chrome / Edge).
// Дескриптор папки хранится в IndexedDB doorCalcFS / dir — так же, как у specs.html и секционного калькулятора,
// поэтому папку, выбранную в справочнике, калькулятор SDA видит сам (если браузер разрешит).
// Без папки — localStorage с префиксом dcfs: (только этот браузер).
// Индекс всегда перечитывается перед записью: меняется только своя строка (договорённость с проектом секционных).

const LS_PREFIX = 'dcfs:';
export const FS = { dir: null, state: 'init', name: '' };

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('doorCalcFS', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  const db = await idbOpen();
  return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
async function idbSet(k, v) {
  const db = await idbOpen();
  return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function fsInit() {
  if (!window.showDirectoryPicker) { FS.state = 'unsupported'; return FS.state; }
  try {
    const h = await idbGet('dir');
    if (h) {
      FS.dir = h; FS.name = h.name;
      FS.state = (await h.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'ok' : 'reconnect';
    } else FS.state = 'none';
  } catch (e) { FS.state = 'none'; }
  return FS.state;
}
export async function fsPick() {
  const h = await window.showDirectoryPicker({ id: 'doorcalc', mode: 'readwrite' });
  FS.dir = h; FS.name = h.name; FS.state = 'ok';
  try { await idbSet('dir', h); } catch (e) { /* без IndexedDB — только на эту сессию */ }
  return FS.state;
}
export async function fsReconnect() {
  if (!FS.dir) return fsPick();
  if ((await FS.dir.requestPermission({ mode: 'readwrite' })) === 'granted') FS.state = 'ok';
  return FS.state;
}

async function dirOf(path, create) {
  const parts = path.split('/');
  let d = FS.dir;
  for (let i = 0; i < parts.length - 1; i++) d = await d.getDirectoryHandle(parts[i], { create: !!create });
  return { d, name: parts[parts.length - 1] };
}
export async function stGet(path) {
  if (FS.state === 'ok') {
    try {
      const { d, name } = await dirOf(path, false);
      const f = await (await d.getFileHandle(name)).getFile();
      return JSON.parse(await f.text());
    } catch (e) {
      if (e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')) return null;
      throw e;
    }
  }
  try { const s = localStorage.getItem(LS_PREFIX + path); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
export async function stPut(path, obj) {
  const txt = JSON.stringify(obj, null, 1);
  if (FS.state === 'ok') {
    const { d, name } = await dirOf(path, true);
    const w = await (await d.getFileHandle(name, { create: true })).createWritable();
    await w.write(txt); await w.close();
    return;
  }
  localStorage.setItem(LS_PREFIX + path, txt);
}

export function nowStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function readIndex() {
  const ix = await stGet('calcs/index.json');
  return { head: ix || { app: 'door_calculator', kind: 'index' }, rows: ix && Array.isArray(ix.calcs) ? ix.calcs : [] };
}

/** Записать спецификацию и свою строку индекса (индекс перечитывается перед записью). */
export async function saveCalc(rec, row) {
  await stPut(`calcs/${rec.id}.json`, rec);
  const ix = await readIndex();
  const rows = ix.rows.filter((r) => r.id !== row.id);
  rows.push(row);
  await stPut('calcs/index.json', { ...ix.head, kind: 'index', updated: nowStr(), calcs: rows });
}

/** Заморозить форму заказа с тем же номером, если она есть (форма → спецификация, Alex 25.11). */
export async function freezeForm(id) {
  const form = await stGet(`forms/${id}.json`);
  if (!form) return false;
  if (form.status !== 'frozen') {
    form.status = 'frozen'; form.specId = id; form.edited = nowStr();
    await stPut(`forms/${id}.json`, form);
  }
  const fx = await stGet('forms/index.json');
  if (fx && Array.isArray(fx.forms)) {
    const r = fx.forms.find((x) => x.id === id);
    if (r && r.status !== 'frozen') { r.status = 'frozen'; await stPut('forms/index.json', { ...fx, updated: nowStr() }); }
  }
  return true;
}

// ───────────── Справочник форм заказа (forms/) ─────────────
// Строка forms/index.json → forms[]: id, order, pos, customer, category, product, W, H, qty, created, edited, status.
// Статус «заморожена» в справочнике считается по наличию спецификации с тем же id в calcs/index.json (Alex 25.11:
// разморозить = удалить спецификацию); поле status в файле — только подсказка для других программ.

export async function stDel(path) {
  if (FS.state === 'ok') {
    try { const { d, name } = await dirOf(path, false); await d.removeEntry(name); } catch (e) {
      if (!(e && e.name === 'NotFoundError')) throw e;
    }
    return;
  }
  try { localStorage.removeItem(LS_PREFIX + path); } catch (e) { /* */ }
}

export async function readForms() {
  const ix = await stGet('forms/index.json');
  return { head: ix || { app: 'hsd-configurator', kind: 'forms-index' }, rows: ix && Array.isArray(ix.forms) ? ix.forms : [] };
}

/** id спецификаций из calcs/index.json — по ним форма считается замороженной. */
export async function specIds() {
  const ix = await readIndex();
  return new Set(ix.rows.map((r) => r.id));
}

/** Записать форму и свою строку индекса форм (индекс перечитывается перед записью). */
export async function saveForm(rec, row) {
  await stPut(`forms/${rec.id}.json`, rec);
  const ix = await readForms();
  const rows = ix.rows.filter((r) => r.id !== row.id);
  rows.push(row);
  await stPut('forms/index.json', { ...ix.head, kind: 'forms-index', updated: nowStr(), forms: rows });
}

/** Удалить форму (только черновик — проверяет вызывающий код). */
export async function deleteForm(id) {
  await stDel(`forms/${id}.json`);
  const ix = await readForms();
  await stPut('forms/index.json', { ...ix.head, kind: 'forms-index', updated: nowStr(), forms: ix.rows.filter((r) => r.id !== id) });
}
