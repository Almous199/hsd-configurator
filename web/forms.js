// Справочник форм заказа (экран менеджера). Схема Alex 25.11.2026:
//  · один справочник для всех изделий (SDA, SDA-DS, ISD01, RSD02, список расширяется);
//  · Create new → диалог выбора изделия → форма этого изделия (пока только SDA; SDA-DS — галочка Own production в форме);
//  · номер формы = DSO из Zoho (+ номер изделия, если в заказе разные изделия);
//  · форма заморожена, пока есть спецификация с тем же номером (calcs/index.json); разморозить = удалить спецификацию в specs.html.
// Хранение — общая рабочая папка Door calculation tool (web/storage.js): forms/index.json + forms/<id>.json.
import { FS, fsInit, fsPick, fsReconnect, readForms, specIds, deleteForm } from './storage.js';

const VERSION = '1.0';
// Онлайн (Catalyst) все страницы лежат рядом: specs.html — общий справочник спецификаций.
const SPECS_URL = window.HSD ? 'specs.html' : '../../Web%20constructor/Door%20calculation%20tool/specs.html';
const FORM_URL = 'sda-order-form.html';
const CALC_URL = 'sda-calculator.html';

// Изделия диалога Create new. form — страница формы заказа; null — формы пока нет (Alex 25.11: ISD01/RSD02 позже).
// В диалоге только SDA (Alex 26.11): SDA-DS получается галочкой Own production в самой форме.
export const PRODUCTS = [
  { code: 'SDA', category: 'highspeed', form: FORM_URL,
    en: 'High speed roll-up door · tick «Own production» in the form for SDA-DS', th: 'ประตูม้วนความเร็วสูง · ติ๊ก «ผลิตเอง» ในฟอร์มสำหรับ SDA-DS' },
  { code: 'ISD01', category: 'sectional', form: null, en: 'Industrial sectional door', th: 'ประตูเซกชันอุตสาหกรรม' },
  { code: 'RSD02', category: 'sectional', form: null, en: 'Sectional door, finger-safe panels', th: 'ประตูเซกชัน แผงกันหนีบนิ้ว' },
];
const CATEGORIES = { highspeed: { en: 'High speed doors', th: 'ประตูความเร็วสูง' }, sectional: { en: 'Sectional doors', th: 'ประตูเซกชัน' } };

const TH = {
  forms: 'ฟอร์มคำสั่งซื้อ', specs: 'รายการสเปค', title: 'ฟอร์มคำสั่งซื้อ', sub: 'คำสั่งซื้อที่ฝ่ายขายกรอกพร้อมแบบร่างเพื่ออนุมัติ · คลิกแถวเพื่อเปิดฟอร์ม',
  new: 'สร้างใหม่', fAll: 'ทั้งหมด', fDraft: 'ฉบับร่าง', fFrozen: 'ล็อกแล้ว',
  hCreated: 'สร้างเมื่อ', hOrder: 'คำสั่งซื้อ / ลำดับ', hCust: 'ลูกค้า', hProd: 'สินค้า', hSize: 'W × H, มม.', hQty: 'จำนวน', hStatus: 'สถานะ',
  hSpec: 'สเปค', hEdited: 'แก้ไขล่าสุด', dlgTitle: 'ฟอร์มคำสั่งซื้อใหม่', dlgSub: 'เลือกสินค้า เลขที่คำสั่งซื้อ (DSO) กรอกในฟอร์ม', cancel: 'ยกเลิก',
};
const TXT = {
  en: {
    search: 'Search order / customer', draft: 'draft', frozen: 'frozen', later: 'form later', none: 'No saved order forms',
    noMatch: 'Nothing found', of: 'of', del: 'Delete form',
    confirmDelFrozen: (id) => `Delete order form ${id}? The specification ${id} stays in Specifications. This cannot be undone.`,
    confirmDel: (id) => `Delete order form ${id}? This cannot be undone.`,
    frozenTip: 'Frozen: the specification with this number exists. Delete it in Specifications to unfreeze.',
    folderNone: 'Working folder is not selected — forms are kept in this browser only and are not visible in Specifications. Click «Choose working folder» and pick «Door calculation tool» (Web constructor → Door calculation tool).',
    folderRe: (n) => `The browser needs permission again for the working folder «${n}».`, allow: 'Allow',
    unsupported: 'This browser cannot open a working folder. Use Chrome or Edge.',
    readErr: (m) => `Cannot read the working folder: ${m}`,
    fsOk: (n) => `Folder: ${n} ✓`, fsRe: (n) => `Reconnect folder (${n})`, fsNo: 'Choose working folder', fsUns: 'Browser: no folder access',
  },
  th: {
    search: 'ค้นหาคำสั่งซื้อ / ลูกค้า', draft: 'ฉบับร่าง', frozen: 'ล็อกแล้ว', later: 'ฟอร์มภายหลัง', none: 'ยังไม่มีฟอร์มคำสั่งซื้อ',
    noMatch: 'ไม่พบข้อมูล', of: 'จาก', del: 'ลบฟอร์ม',
    confirmDelFrozen: (id) => `ลบฟอร์มคำสั่งซื้อ ${id}? สเปค ${id} ยังคงอยู่ในรายการสเปค ไม่สามารถย้อนกลับได้`,
    confirmDel: (id) => `ลบฟอร์มคำสั่งซื้อ ${id}? ไม่สามารถย้อนกลับได้`,
    frozenTip: 'ล็อกแล้ว: มีสเปคเลขนี้อยู่ ลบสเปคในรายการสเปคเพื่อปลดล็อก',
    folderNone: 'ยังไม่ได้เลือกโฟลเดอร์ทำงาน — ฟอร์มจะถูกเก็บในเบราว์เซอร์นี้เท่านั้น และไม่แสดงในรายการสเปค คลิก «Choose working folder» แล้วเลือก «Door calculation tool»',
    folderRe: (n) => `เบราว์เซอร์ต้องการสิทธิ์เข้าถึงโฟลเดอร์ «${n}» อีกครั้ง`, allow: 'อนุญาต',
    unsupported: 'เบราว์เซอร์นี้เปิดโฟลเดอร์ทำงานไม่ได้ ใช้ Chrome หรือ Edge',
    readErr: (m) => `อ่านโฟลเดอร์ทำงานไม่ได้: ${m}`,
    fsOk: (n) => `โฟลเดอร์: ${n} ✓`, fsRe: (n) => `เชื่อมต่อโฟลเดอร์ใหม่ (${n})`, fsNo: 'เลือกโฟลเดอร์ทำงาน', fsUns: 'เบราว์เซอร์: ไม่รองรับโฟลเดอร์',
  },
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let LANG = 'en';
try { LANG = new URLSearchParams(location.search).get('lang') || localStorage.getItem('dh.lang') || 'en'; } catch (e) { /* */ }
if (!['en', 'th'].includes(LANG)) LANG = 'en';
const t = (k) => TXT[LANG][k];

const ST = { rows: [], specs: new Set(), filter: 'all', q: '', error: '' };

function applyLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i]').forEach((e) => {
    if (!e.dataset.en) e.dataset.en = e.textContent;
    e.textContent = LANG === 'th' && TH[e.dataset.i] ? TH[e.dataset.i] : e.dataset.en;
  });
  $('q').placeholder = t('search');
  document.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === LANG));
  $('lnkSpecs').href = `${SPECS_URL}?lang=${LANG}`;
}
document.querySelectorAll('.lang button').forEach((b) => b.onclick = () => {
  LANG = b.dataset.lang; try { localStorage.setItem('dh.lang', LANG); } catch (e) { /* */ }
  const u = new URL(location.href); u.searchParams.set('lang', LANG); history.replaceState(null, '', u);
  applyLang(); fsUi(); render(); renderDialog();
});

// ───────────── рабочая папка ─────────────
function fsUi() {
  const b = $('fsBtn'); const s = FS.state;
  b.textContent = s === 'ok' ? (FS.server ? FS.name : t('fsOk')(FS.name)) : s === 'reconnect' ? t('fsRe')(FS.name) : s === 'unsupported' ? t('fsUns') : t('fsNo');
  b.className = 'btn btn-sm ' + (s === 'ok' ? 'btn-ok' : '');
  const info = $('info');
  info.className = 'infobox'; info.hidden = false;
  if (ST.error) { info.className = 'infobox err'; info.textContent = t('readErr')(ST.error); }
  else if (s === 'ok') info.hidden = true;
  else if (s === 'reconnect') {
    info.className = 'infobox warn';
    info.innerHTML = `${esc(t('folderRe')(FS.name))} <button class="btn btn-sm" id="infoBtn">${esc(t('allow'))}</button>`;
    $('infoBtn').onclick = () => $('fsBtn').click();
  } else if (s === 'unsupported') { info.className = 'infobox warn'; info.textContent = t('unsupported'); }
  else info.textContent = t('folderNone');
}
$('fsBtn').onclick = async () => {
  try {
    if (FS.state === 'reconnect') await fsReconnect(); else if (FS.state !== 'unsupported') await fsPick();
    await load();
  } catch (e) { if (e && e.name !== 'AbortError') alert(e.message); }
};

// ───────────── данные ─────────────
async function load() {
  ST.error = '';
  try {
    if (FS.state === 'reconnect') { ST.rows = []; ST.specs = new Set(); }
    else {
      const [fx, sp] = await Promise.all([readForms(), specIds()]);
      ST.rows = fx.rows; ST.specs = sp;
    }
  } catch (e) { ST.error = e.message || String(e); ST.rows = []; }
  fsUi(); render();
}
const isFrozen = (r) => ST.specs.has(r.id);
const orderOf = (r) => `${r.order || r.id}${r.pos ? ' / ' + r.pos : ''}`;
const linkLang = (url) => `${url}${url.includes('?') ? '&' : '?'}lang=${LANG}`;

function render() {
  const q = ST.q.trim().toLowerCase();
  const all = [...ST.rows].sort((a, b) => String(b.edited || b.created || '').localeCompare(String(a.edited || a.created || '')));
  const list = all.filter((r) => {
    if (ST.filter === 'draft' && isFrozen(r)) return false;
    if (ST.filter === 'frozen' && !isFrozen(r)) return false;
    return !q || [r.id, r.order, r.customer, r.product].some((v) => String(v || '').toLowerCase().includes(q));
  });
  $('cnt').innerHTML = `<b>${list.length}</b> ${t('of')} ${all.length}`;
  const tb = $('rows');
  if (!list.length) { tb.innerHTML = `<tr><td colspan="10" class="empty">${esc(all.length ? t('noMatch') : t('none'))}</td></tr>`; return; }
  tb.innerHTML = list.map((r) => {
    const fr = isFrozen(r);
    const size = r.W && r.H ? `${r.W} × ${r.H}` : '—';
    return `<tr data-id="${esc(r.id)}">
      <td class="dt">${esc(r.created || '')}</td>
      <td class="id">${esc(r.id)}</td>
      <td>${esc(r.customer || '')}</td>
      <td><span class="prod">${esc(r.product || '')}</span></td>
      <td class="n">${size}</td><td class="n">${esc(r.qty ?? '')}</td>
      <td><span class="st ${fr ? 'frozen' : 'draft'}" ${fr ? `title="${esc(t('frozenTip'))}"` : ''}>${fr ? '🔒 ' : ''}${esc(t(fr ? 'frozen' : 'draft'))}</span></td>
      <td>${fr ? `<a class="spec" href="${esc(linkLang(`${CALC_URL}?calc=${encodeURIComponent(r.id)}`))}">${esc(r.id)} →</a>` : ''}</td>
      <td class="dt">${esc(r.edited || '')}</td>
      <td><button class="rm" data-del="${esc(r.id)}" title="${esc(t('del'))}">×</button></td>
    </tr>`;
  }).join('');
}

$('rows').onclick = async (e) => {
  if (e.target.closest('a')) return;
  const del = e.target.closest('[data-del]');
  if (del) {
    e.stopPropagation();
    const id = del.dataset.del;
    try {
      // Удалять можно и замороженную форму (Alex 26.11; позже ограничим правами менеджеров). Спецификация остаётся.
      if (!confirm(ST.specs.has(id) ? t('confirmDelFrozen')(id) : t('confirmDel')(id))) return;
      await deleteForm(id);
    } catch (err) { alert(err.message); }
    await load();
    return;
  }
  const tr = e.target.closest('tr[data-id]');
  if (!tr || e.target.closest('button')) return;
  const row = ST.rows.find((r) => r.id === tr.dataset.id);
  const p = PRODUCTS.find((x) => x.code === row?.product);
  location.href = linkLang(`${(p && p.form) || FORM_URL}?form=${encodeURIComponent(tr.dataset.id)}`);
};
$('q').oninput = (e) => { ST.q = e.target.value; render(); };
$('flt').onclick = (e) => {
  const b = e.target.closest('button[data-f]'); if (!b) return;
  ST.filter = b.dataset.f; $('flt').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); render();
};
$('btnReload').onclick = () => load();

// ───────────── диалог Create new ─────────────
function renderDialog() {
  const cats = [...new Set(PRODUCTS.map((p) => p.category))];
  $('plist').innerHTML = cats.map((c) => `<div class="grp">${esc(CATEGORIES[c][LANG])}</div><div class="pgrid">${
    PRODUCTS.filter((p) => p.category === c).map((p) => `<button class="pcard" data-p="${p.code}" ${p.form ? '' : 'disabled'}>
      <b>${p.code}${p.form ? '' : `<em>${esc(t('later'))}</em>`}</b><span>${esc(p[LANG])}</span></button>`).join('')
  }</div>`).join('');
}
const openDlg = (on) => { $('dlg').classList.toggle('on', on); if (on) $('plist').querySelector('.pcard:not(:disabled)')?.focus(); };
$('btnNew').onclick = () => openDlg(true);
$('dlgClose').onclick = () => openDlg(false);
$('dlg').onclick = (e) => { if (e.target === $('dlg')) openDlg(false); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') openDlg(false); });
$('plist').onclick = (e) => {
  const b = e.target.closest('.pcard'); if (!b || b.disabled) return;
  const p = PRODUCTS.find((x) => x.code === b.dataset.p);
  location.href = linkLang(`${p.form}?new=1&product=${encodeURIComponent(p.code)}`);
};

// ───────────── запуск ─────────────
$('ver').textContent = `v${VERSION}`;
applyLang(); renderDialog();
await fsInit();
if (FS.server && FS.role === 'manager') $('lnkSpecs').hidden = true; // онлайн: спецификации менеджеру не показываем
await load();
if (new URLSearchParams(location.search).get('new') === '1') openDlg(true);
window.addEventListener('focus', () => { if (FS.state === 'ok') load(); }); // вернулись из формы или справочника спецификаций
