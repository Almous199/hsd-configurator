// Калькулятор SDA / SDA-DS — экран инженера (макет 08-calculator-ui, согласован Alex 26.11.2026).
// Вкладка Calculator: блоки 0 Заказ · 1 Полотно · 2 Направляющие · 3 Вал, короб и привод (поля слева, превью справа).
// Вкладка Specification: листы 1 Полотно (карта раскроя) · 2 Направляющие · 3 Вал, короб и привод; сборка Zoho и CSV.
// Весь расчёт — ядро products/hsr; здесь только ввод, отрисовка и сохранение в общий справочник (web/storage.js).
// Адреса (договорённость со справочником specs.html): ?calc=<id> просмотр · &mode=edit правка · ?copy=<id> · ?form=<id> · ?new=1 · lang=en|th.
import { calculateHsr, exportAssemblyCsv, ENGINE } from '../products/hsr/index.js';
import { windCurtain } from '../products/hsr/winding.js';
import { effectiveFromPitches } from '../products/hsr/pitch.js';
import { FS, fsInit, fsPick, fsReconnect, stGet, readIndex, saveCalc, freezeForm, nowStr } from './storage.js';

const VERSION = '1.0';
const SPECS_URL = '../../Web%20constructor/Door%20calculation%20tool/specs.html';
const CATALOG_FILES = ['items', 'guides', 'profiles', 'header', 'drives', 'space', 'frame-materials',
  'layouts', 'curtain', 'assemblies', 'accessories'];

async function loadCatalogs() {
  if (window.__CATALOGS__) return window.__CATALOGS__;
  const out = {};
  await Promise.all(CATALOG_FILES.map(async (f) => {
    const r = await fetch(`../catalogs/hsr/${f}.json`);
    out[f.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = await r.json();
  }));
  return out;
}
const CAT = await loadCatalogs();
const ITEM = new Map(CAT.items.items.map((i) => [i.sku, i]));
const CUR = CAT.curtain;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const itemName = (sku) => { const it = ITEM.get(sku); return it ? (it.zohoName || it.name) : ''; };

// ───────────────────────────── язык ─────────────────────────────
const TH = {
  specs: 'รายการสเปค', tabCalc: 'คำนวณ', tabSpec: 'สเปค', b0: 'ข้อมูลคำสั่งซื้อ', b0s: 'คำสั่งซื้อ · ลูกค้า · ประตู · ตัวเลือก — นำเข้าจากฟอร์มหรือกรอกเอง',
  order: 'คำสั่งซื้อ', created: 'สร้างเมื่อ', orderNo: 'เลขที่คำสั่งซื้อ', pos: 'ลำดับ', qty: 'จำนวน', customer: 'ลูกค้า', ref: 'อ้างอิง / ตำแหน่ง', addr: 'ที่อยู่จัดส่ง',
  door: 'ประตู', W: 'ความกว้าง W', H: 'ความสูง H', hMax: 'มม. · สูงสุด 6000', supply: 'การผลิต', supplyHint: 'SDA ก็คำนวณได้ · เปลี่ยนเป็น SDA-DS เมื่อบันทึก',
  frame: 'วัสดุโครง', fabric: 'ม่าน', colour: 'สี', driveSide: 'ด้านมอเตอร์', ctrlSide: 'ด้านตู้ควบคุม', left: 'ซ้าย', right: 'ขวา', fromInside: 'มองจากด้านใน',
  ctrlH: 'ความสูงตู้ควบคุม', fromFloor: 'มม. จากพื้น', trSection: 'เซกชันใส', accFromOrder: 'อุปกรณ์เสริม (จากคำสั่งซื้อ)', accAdd: '+ เพิ่มอุปกรณ์',
  status: 'สถานะ', frontView: 'ภาพด้านหน้า · มองจากด้านใน', b1: 'ม่าน', b1s: 'ความสูงเซกชัน · โปรไฟล์กันลม · โปรไฟล์ล่าง · ยาง · การม้วนบนเพลา',
  curW: 'ความกว้างม่าน', visH: 'ความสูงที่มองเห็น', visHint: 'H + 200 · ในราง', windbars: 'โปรไฟล์กันลม', auto: 'อัตโนมัติ', windbarProfile: 'โปรไฟล์กันลม',
  secHeights: 'ความสูงเซกชัน, มม. (บน → ล่าง, ศูนย์กลางถึงศูนย์กลางโปรไฟล์)', resetLayout: 'กลับเป็นมาตรฐาน', bottomWinding: 'ด้านล่างและการม้วน',
  bottomProfile: 'โปรไฟล์ล่าง', bottomSeal: 'ยางล่าง', tPvc: 'PVC ในม้วน', tClr: 'แผ่นใสในม้วน', tProf: 'โปรไฟล์ในม้วน', tProfHint: 'มม. · 50 ตามแนวม่าน',
  rollD: 'Ø ม้วนเมื่อเปิด', blank: 'ความยาวม่าน', wound: 'ม้วนบนเพลา', woundHint: 'ประตูเปิด', preview: 'ตัวอย่าง', winding: 'การม้วน', curtainTab: 'ม่าน',
  minAngle: 'มุมต่ำสุดระหว่างโปรไฟล์', idealAngle: 'อุดมคติ · เกณฑ์ 80 %', dragHint: 'ลากเครื่องหมายโปรไฟล์ไปตามม้วน: รอยต่อระหว่างสองเซกชันจะเลื่อน ความสูงรวมคงเดิม',
  b2: 'ราง', b2s: 'ราง · ขายึด · โฟโต้เซลล์', rail: 'ราง', railHint: 'จากวัสดุโครง บล็อก 0', railLen: 'ความยาวราง', railLenHint: 'H + 200 · 2 ชิ้น',
  sideSpace: 'พื้นที่ด้านข้าง', sideSpaceHint: 'ด้านมอเตอร์ / อีกด้าน', photocells: 'โฟโต้เซลล์', pairs: 'คู่', level1: 'ระดับ 1', level2: 'ระดับ 2', brackets: 'ขายึด',
  frameView: 'โครง · ภาพรวมจากด้านใน', b3: 'เพลา กล่อง และมอเตอร์', b3s: 'กล่องด้านบน · เพลา · แกน · ตลับลูกปืน · มอเตอร์', shaftBox: 'เพลา · กล่อง',
  reason: 'เหตุผลที่เลือกเอง', boxLen: 'ความยาวกล่อง', shaftLen: 'ความยาวเพลา', beam: 'คาน MET50x25', beamHint: 'กล่อง − 1', flanges: 'หน้าแปลน',
  axleDrive: 'แกนด้านมอเตอร์', axleOther: 'แกนอีกด้าน', bearings: 'ตลับลูกปืน', lockCup: 'ถ้วยล็อก', driveSub: 'มอเตอร์ · Powever A2 (ติดตั้งด้านนอกเท่านั้น)',
  motor: 'มอเตอร์', ctrlUnit: 'ตู้ควบคุม', driveBracket: 'ขายึดมอเตอร์', byReducer: 'ตามเกียร์มอเตอร์', motorCover: 'ฝาครอบมอเตอร์', bumper: 'ตัวกันกระแทก', cable: 'สายไฟ',
  topView: 'เพลา แกน และตลับลูกปืน · มุมมองด้านบน', boxSection: 'หน้าตัดกล่อง · ตรวจม้วน', exit: 'ออกโดยไม่บันทึก', toSpec: 'สเปค →',
  specTitle: 'สเปค', specSub: 'สร้างจากการคำนวณ · เปลี่ยนรายการ แก้จำนวน · การแก้ไขด้วยมือจะถูกไฮไลต์', backCalc: '← คำนวณ', save: 'บันทึก — เสร็จสิ้นการคำนวณ',
  edit: 'แก้ไข', copy: 'คัดลอก', backSpecs: '← รายการสเปค', zohoAsm: 'การประกอบใน Zoho', asmAll: 'ทั้งประตู · แผ่น 1–3', asmCur: 'เฉพาะม่าน · แผ่น 1',
  no: 'เลขที่', qtyAsm: 'จำนวนประกอบ', date: 'วันที่', csv: 'ส่งออก CSV สำหรับ Zoho', printSheets: 'แผ่นที่จะพิมพ์', print: 'พิมพ์ / PDF',
};
let LANG = 'en';
try { LANG = new URLSearchParams(location.search).get('lang') || localStorage.getItem('dh.lang') || 'en'; } catch (e) { /* */ }
if (!['en', 'th'].includes(LANG)) LANG = 'en';
function applyLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i]').forEach((e) => {
    if (e.dataset.en == null) e.dataset.en = e.textContent;
    e.textContent = LANG === 'th' && TH[e.dataset.i] ? TH[e.dataset.i] : e.dataset.en;
  });
  document.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === LANG));
  $('lnkSpecs').href = $('btnBack').href = `${SPECS_URL}?lang=${LANG}`;
}
document.querySelectorAll('.lang button').forEach((b) => b.onclick = () => {
  LANG = b.dataset.lang; try { localStorage.setItem('dh.lang', LANG); } catch (e) { /* */ } applyLang(); render();
});

// ───────────────────────────── состояние ─────────────────────────────
const COLORS = [['blue', 'Blue'], ['orange', 'Orange'], ['yellow', 'Yellow'], ['red', 'Red'], ['green', 'Green'], ['grey', 'Grey'], ['white', 'White']];
const ACC_TYPES = { push_button: 'Push button', pull_cord: 'Pull-cord switch', radar: 'Radar', loop: 'Induction loop' };

function emptyDoc() {
  return {
    schemaVersion: '1.0', productType: 'hsr', id: '', revision: 1,
    order: { salesorderNumber: '', salesorderItem: null, customer: { name: '' }, deliveryAddress: '', reference: '' },
    opening: { width: null, height: null, quantity: 1 },
    options: { model: 'SDA', supply: 'own', frameMaterial: 'alu-galv', pvc: 'blue', driveSide: 'L', controlSide: 'L',
      controlBoxHeight: 1200, accessories: [], photocells: { pairs: 1, levels: [CAT.accessories.photocell.levelDefault || 400] }, overrides: [] },
  };
}

const ST = {
  doc: emptyDoc(),
  form: null,          // документ формы заказа, из которой открыт расчёт (для подсветки отличий)
  formId: null,
  calcId: null,        // номер сохранённой спецификации, которую правим (null — новая)
  created: nowStr(),
  edits: { qty: {}, sku: {}, removed: [], extra: [] }, // ручные правки спецификации
  assembly: 'SDA-DS',
  asmDate: new Date().toISOString().slice(0, 10),
  view: false,
  dirty: false,
};
let R = null; // результат calculateHsr

const ov = (path) => (ST.doc.options.overrides || []).find((o) => o.path === path);
function setOv(path, value, reason) {
  const list = (ST.doc.options.overrides || []).filter((o) => o.path !== path);
  if (value !== undefined) list.push({ path, value, reason });
  ST.doc.options.overrides = list;
}
const ownDoc = () => { const d = clone(ST.doc); d.options.supply = 'own'; return d; }; // SDA тоже считается (Alex 26.11)

function idOf(doc) {
  const so = String(doc.order.salesorderNumber || '').replace(/^DSO-/i, '').trim();
  if (!so) return '';
  const pos = doc.order.salesorderItem;
  return `DSO-${so}${pos ? '-' + pos : ''}`;
}

// ───────────────────────────── расчёт и отрисовка ─────────────────────────────
function recalc() {
  ST.doc.id = idOf(ST.doc);
  R = calculateHsr(ownDoc(), CAT, { now: new Date().toISOString() });
}
function change() { ST.dirty = true; recalc(); render(); }

function render() {
  renderBlock0(); renderBlock1(); renderBlock2(); renderBlock3(); renderStatus();
  if (!$('tab-spec').classList.contains('hidden')) renderSpec();
}

// поле «как в форме» — подсветка и подпись значения формы
function mark(wrapId, cur, formVal, fmt = (v) => v) {
  const w = $(wrapId); if (!w) return;
  const diff = ST.form && formVal !== undefined && JSON.stringify(cur ?? null) !== JSON.stringify(formVal ?? null);
  w.classList.toggle('ov', !!diff);
  let f = w.querySelector('.from');
  if (diff) { if (!f) { f = document.createElement('div'); f.className = 'from'; w.appendChild(f); } f.textContent = `form: ${fmt(formVal) ?? '—'}`; }
  else if (f) f.remove();
}
const setVal = (id, v) => { const e = $(id); if (document.activeElement !== e) e.value = v ?? ''; };
function seg(id, v) { $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(v))); }

function renderBlock0() {
  const d = ST.doc; const F = ST.form;
  setVal('fCreated', ST.created);
  setVal('fSo', String(d.order.salesorderNumber || '').replace(/^DSO-/i, ''));
  setVal('fPos', d.order.salesorderItem ?? '');
  setVal('fQty', d.opening.quantity);
  setVal('fCust', d.order.customer?.name);
  setVal('fRef', d.order.reference);
  setVal('fAddr', d.order.deliveryAddress);
  setVal('fW', d.opening.width); setVal('fH', d.opening.height);
  setVal('fSupply', d.options.supply || 'own');
  setVal('fFrame', d.options.frameMaterial);
  const mesh = String(d.options.pvc || '').startsWith('mesh-');
  setVal('fFabric', mesh ? 'mesh' : 'pvc');
  $('fColor').innerHTML = (mesh ? [['mesh-yellow', 'Transparent yellow']] : COLORS)
    .map(([v, l]) => `<option value="${v}">${l}${CAT.profiles.pvc[mesh ? 'mesh' : 'colors'][v.replace('mesh-', '')] ? '' : ' · no SKU'}</option>`).join('');
  $('fColor').value = d.options.pvc;
  seg('sDrive', d.options.driveSide); seg('sCtrl', d.options.controlSide);
  setVal('fCtrlH', d.options.controlBoxHeight);
  const nSec = R.calc.curtain ? R.calc.curtain.sections.length : 3;
  $('fTr').innerHTML = `<option value="auto">auto (2nd)</option><option value="none">none</option>`
    + Array.from({ length: nSec - 1 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  const tr = d.options.transparentSections;
  $('fTr').value = !tr ? 'auto' : (tr.length ? String(tr[0]) : 'none');
  if (F) {
    const fo = F.order || {}; const fop = F.opening || {}; const fx = F.options || {};
    mark('wSo', d.order.salesorderNumber, fo.salesorderNumber); mark('wPos', d.order.salesorderItem, fo.salesorderItem);
    mark('wQty', d.opening.quantity, fop.quantity); mark('wCust', d.order.customer?.name, fo.customer?.name);
    mark('wRef', d.order.reference, fo.reference); mark('wAddr', d.order.deliveryAddress, fo.deliveryAddress);
    mark('wW', d.opening.width, fop.width); mark('wH', d.opening.height, fop.height);
    mark('wSupply', d.options.supply, fx.supply); mark('wFrame', d.options.frameMaterial, fx.frameMaterial);
    mark('wColor', d.options.pvc, fx.pvc); mark('wDrive', d.options.driveSide, fx.driveSide);
    mark('wCtrl', d.options.controlSide, fx.controlSide); mark('wCtrlH', d.options.controlBoxHeight, fx.controlBoxHeight);
  }
  $('src0').innerHTML = ST.form
    ? `📄 Imported from order form <b>${esc(ST.formId || ST.form.id)}</b> · <span style="color:var(--c-muted)">the form is frozen when the specification is saved; edits here change only the specification</span><span class="sp"></span><button class="btn btn-sm edit-only" id="btnOpen">Open order JSON…</button>`
    : `${ST.calcId ? `Specification <b>${esc(ST.calcId)}</b>` : 'New calculation without an order form'} · <span style="color:var(--c-muted)">an order number that matches a saved form offers to import it</span><span class="sp"></span><button class="btn btn-sm edit-only" id="btnOpen">Open order JSON…</button>`;
  $('btnOpen').onclick = () => $('openFile').click();
  const edited = document.querySelectorAll('#tab-calc .blk .field.ov').length;
  const p0 = $('p0');
  p0.className = 'pill ' + (edited ? 'ed' : (ST.form ? 'ok' : ''));
  p0.textContent = ST.form ? (edited ? `from form · ${edited} edit${edited > 1 ? 's' : ''}` : 'from form') : 'manual';
  $('fSo').closest('.field').classList.toggle('bad', !idOf(d));
  renderAcc();
  $('pv0').innerHTML = R.calc.frame ? frontView('order') : '<div class="legend">—</div>';
}

function renderAcc() {
  const list = ST.doc.options.accessories || [];
  const types = CAT.accessories.types;
  let h = '<tr><th>Type</th><th>Model</th><th class="n">Qty / door</th><th></th></tr>';
  list.forEach((a, i) => {
    const t = types.find((x) => x.type === a.type) || types[0];
    h += `<tr><td><select data-a="${i}" data-k="type">${types.map((x) => `<option value="${x.type}"${x.type === t.type ? ' selected' : ''}>${ACC_TYPES[x.type] || x.type}</option>`).join('')}</select></td>
      <td><select data-a="${i}" data-k="sku">${t.models.map((m) => `<option value="${m.sku || ''}"${m.sku === a.sku ? ' selected' : ''}${m.available ? '' : ' disabled'}>${esc(m.sku ? `${m.id} · ${itemName(m.sku)}` : `${m.id} · no SKU`)}</option>`).join('')}</select></td>
      <td class="n"><input class="num" data-a="${i}" data-k="qty" type="number" min="1" value="${a.qty}"></td><td><button class="btn btn-sm rm" data-rm="${i}">×</button></td></tr>`;
  });
  h += `<tr class="muted"><td>Standard</td><td>Photocells · ${CAT.accessories.standardKit.map((k) => k.sku).join(', ')}</td><td class="n">1</td><td></td></tr>`;
  $('accTbl').innerHTML = h;
  $('accTbl').querySelectorAll('[data-a]').forEach((e) => e.onchange = () => {
    const a = list[+e.dataset.a];
    if (e.dataset.k === 'type') { a.type = e.value; a.sku = (types.find((x) => x.type === e.value).models.find((m) => m.available) || {}).sku; }
    else if (e.dataset.k === 'sku') a.sku = e.value;
    else a.qty = Math.max(1, Math.round(+e.value || 1));
    change();
  });
  $('accTbl').querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { list.splice(+b.dataset.rm, 1); change(); });
}

function renderBlock1() {
  const c = R.calc.curtain; const f = R.calc.frame;
  const p1 = $('p1');
  if (!c) { p1.className = 'pill er'; p1.textContent = 'not calculated'; $('secTbl').innerHTML = ''; $('pvWind').innerHTML = ''; $('pvCur').innerHTML = ''; return; }
  setVal('cW', c.width); $('cWh').textContent = `W + ${c.width - R.calc.opening.width}`;
  setVal('cVis', R.calc.opening.height + CUR.guideAboveOpening);
  const manual = !!ov('curtain.sections');
  const extra = ST.doc.options.sections?.extraWindbars || 0;
  $('nVal').textContent = c.windbars;
  $('nHint').textContent = manual ? 'manual heights' : `Lefast table: ${c.windbars - extra}${extra ? ` · +${extra} ${extra === 1 ? 'splits bottom' : 'splits bottom and top'}` : ''}`;
  $('nPlus').disabled = manual || extra >= CUR.manualExtraWindbarsMax;
  $('nMinus').disabled = manual || extra <= 0;
  setVal('cWbp', `${c.windbarProfile.sku || 'reinforced (no SKU)'} · ${itemName(c.windbarProfile.sku)}`);
  // таблица секций: сверху вниз, высоты по центрам ветровиков
  const n = c.windbars; const P = c.pitches; const bc = c.barCentres;
  let h = `<tr><th>#</th><th>Section</th><th class="n">Height, c–c</th><th class="n">Bar centre from seal bottom</th><th>Profile above</th></tr>`;
  for (let i = c.sections.length - 1; i >= 0; i--) {
    const s = c.sections[i];
    const tag = s.top ? '<span class="tag top">top · to box bottom</span>' : s.transparent ? '<span class="tag tr">transparent</span>'
      : i === 0 ? '<span class="tag">bottom · from seal bottom</span>' : '<span class="tag">middle</span>';
    h += `<tr><td>${s.no}</td><td>${tag}</td><td class="n"><input class="num" data-p="${i}" value="${P[i]}" ${s.top ? 'readonly' : ''}></td>
      <td class="n">${i < n ? bc[i] : `box bottom ${R.calc.opening.height + CUR.guideAboveOpening}`}</td>
      <td>${i < n ? `wind bar ${i + 1} · ${c.windbarProfile.sku || ''}` : `+ ${s.h - s.visible - CUR.guideAboveOpening} under box and on shaft`}</td></tr>`;
  }
  $('secTbl').innerHTML = h;
  $('secTbl').querySelectorAll('input[data-p]').forEach((e) => e.onchange = () => {
    const pp = c.pitches.slice(); pp[+e.dataset.p] = Math.round(+e.value || 0);
    setManualPitches(pp);
  });
  $('chain').textContent = `Σ ${P.join(' + ')} = ${P.reduce((a, b) => a + b, 0)} = H + 200 · winding uses the whole top section · fabric sizes → specification`;
  setVal('cBp', `${c.bottomProfile.sku} · ${itemName(c.bottomProfile.sku)}`); $('cBph').textContent = `plugs ${c.bottomProfile.plug} · 1 pair`;
  setVal('cSeal', `${c.bottomProfile.seal} · ${itemName(c.bottomProfile.seal)}`);
  setVal('fTPvc', c.pvcThickness); setVal('fTClr', c.clearThickness); setVal('fTProf', c.profileThickness);
  setVal('cRoll', c.rollDiameter); $('cRollH').textContent = `mm · max ${f.rollDiameterMax} (box ${f.sidePlate})`;
  setVal('cLen', c.length); setVal('cWound', c.winding.woundLength);
  const w = c.winding;
  const ae = $('angNow'); ae.textContent = n > 1 ? Math.round(w.minAngle) + '°' : '—'; ae.className = w.okAngle ? 'good' : 'bad';
  $('angIdeal').textContent = `${Math.round(w.idealAngle)}° · ${Math.round(0.8 * w.idealAngle)}°`;
  if (!w.okAngle) { p1.className = 'pill wr'; p1.textContent = 'wind bars overlap on roll'; }
  else if (manual || extra) { p1.className = 'pill ed'; p1.textContent = manual ? 'manual heights' : `+${extra} wind bar`; }
  else { p1.className = 'pill ok'; p1.textContent = 'standard layout'; }
  $('pvWind').innerHTML = windView(); bindDrag();
  $('pvCur').innerHTML = curtainView();
}

function setManualPitches(pp) {
  const c = R.calc.curtain;
  const eff = effectiveFromPitches(pp, CUR);
  setOv('curtain.sections', eff, 'Section heights edited in the calculator');
  ST.doc.options.transparentSections = c.sections.filter((s) => s.transparent).map((s) => s.no);
  if (ST.doc.options.sections) ST.doc.options.sections.extraWindbars = 0;
  change();
}

function renderBlock2() {
  const f = R.calc.frame; const d = ST.doc.options;
  if (!f) return;
  const g = CAT.guides.items.find((x) => x.id === f.guide);
  setVal('gRail', `${g.name} · ${f.guideSize.w} × ${f.guideSize.d}`);
  setVal('gLen', f.guideLength);
  setVal('gSide', `${f.sketch.motorSideWidth} / ${f.sketch.nonMotorSideWidth}`);
  const pc = d.photocells || { pairs: 1, levels: [400] };
  seg('sPc', pc.pairs);
  setVal('fPc1', pc.levels[0]); setVal('fPc2', pc.levels[1] ?? 1000); $('fPc2').disabled = pc.pairs < 2;
  setVal('gPcBr', `${CAT.accessories.photocell.support} × ${pc.pairs * CAT.accessories.photocell.supportsPerPair}`);
  const p2 = $('p2'); p2.className = 'pill ok'; p2.textContent = pc.pairs > 1 ? '2 photocell pairs' : 'auto';
  $('pv2').innerHTML = frontView('frame');
}

function renderBlock3() {
  const f = R.calc.frame; const dr = R.calc.drive;
  const plateOv = ov('frame.sidePlate'); const motOv = ov('drive.motor');
  const plates = CAT.header.sidePlates.filter((p) => p.active);
  $('fPlate').innerHTML = `<option value="">auto${f ? ` · φ${CAT.header.sidePlates.find((p) => p.id === f.sidePlateAuto).shaftDia} / box ${f.sidePlateAuto}` : ''}</option>`
    + plates.map((p) => `<option value="${p.id}">φ${p.shaftDia} · box ${p.id} ${p.size.h} × ${p.size.d}</option>`).join('');
  $('fPlate').value = plateOv ? plateOv.value : '';
  $('wPlate').classList.toggle('ov', !!plateOv);
  $('wPlateR').classList.toggle('hidden', !plateOv && !motOv);
  setVal('fPlateR', (plateOv || motOv || {}).reason === '—' ? '' : (plateOv || motOv || {}).reason);
  $('plateHint').textContent = 'auto: W ≤ 4000 and H ≤ 4000 → φ114 / S, otherwise up to 28 m² → φ140 / M';
  $('fMotor').innerHTML = '<option value="">auto (Powever catalogue)</option>'
    + CAT.drives.motors.map((m) => `<option value="${m.id}">${m.sku} · ${m.kw} kW · ${m.reducer} ${m.ratio}</option>`).join('');
  $('fMotor').value = motOv ? motOv.value : '';
  $('wMotor').classList.toggle('ov', !!motOv);
  const p3 = $('p3');
  if (!f) { p3.className = 'pill er'; p3.textContent = 'not available'; $('pv3').innerHTML = ''; $('pv3b').innerHTML = ''; $('chk3').innerHTML = ''; return; }
  p3.className = 'pill ' + (plateOv || motOv ? 'ed' : 'ok'); p3.textContent = `${plateOv || motOv ? 'manual' : 'auto'} · ${f.sidePlate}`;
  const mat = CAT.frameMaterials.options.find((m) => m.id === f.material);
  const g = CAT.guides.items.find((x) => x.id === f.guide);
  setVal('hBox', f.boxLength); $('hBoxH').textContent = `W + ${g.offsets.headerLength}`;
  setVal('hShaft', f.shaftLength); $('hShaftH').textContent = `W + ${g.offsets.shaftLength}`;
  setVal('hBeam', `${f.beamQty} × ${f.beamLength}`); setVal('hFl', `${f.flangeSku} × 4`);
  setVal('hAx1', `${CAT.header.axles.motorSide.sku} · 30×${CAT.header.axles.motorSide.length}`);
  setVal('hAx2', `${CAT.header.axles.otherSide.sku} · 30×${CAT.header.axles.otherSide.length}`);
  setVal('hBr', `${CAT.header.bearing.sku} × ${CAT.header.bearing.qty}`); setVal('hCup', `${CAT.header.lockingCup.sku} × ${CAT.header.lockingCup.qty}`);
  if (dr) {
    $('motHint').textContent = `φ${f.shaftDiameter}: up to ${dr.maxAreaM2} m² — door ${dr.areaM2} m²`;
    setVal('dCu', dr.controlUnitSku); setVal('dPlate', `${dr.plateSku} · ${dr.gearbox}`); setVal('dCover', dr.motorCoverSku || '—');
    setVal('dBump', `LF-R012 × ${dr.bumpers}`); setVal('dCable', `${dr.cableLength} mm`);
    $('dCableH').textContent = `in kit ${dr.cableIncluded / 1000} m · extra ${dr.cableToBuy}`;
  }
  const c = R.calc.curtain;
  const okRoll = c && c.rollDiameter <= f.rollDiameterMax;
  $('chk3').innerHTML = c && dr ? `<div class="${okRoll ? 'okbox' : 'wrbox'}">${okRoll ? '✓' : '⚠'} Roll Ø ${c.rollDiameter} ${okRoll ? '≤' : '>'} ${f.rollDiameterMax} (box ${f.sidePlate}) · area ${dr.areaM2} m² ≤ ${dr.maxAreaM2} m² (φ${f.shaftDiameter} + ${dr.motorSku})</div>` : '';
  void mat;
  $('pv3').innerHTML = topView(); $('pv3b').innerHTML = boxSection();
}

function renderStatus() {
  const e = R.calc.errors; const w = R.calc.warnings;
  const sup = ST.doc.options.supply === 'outsourced' ? ['<div class="w">⚑ Supply SDA (bought): calculated as SDA-DS, becomes SDA-DS on Save</div>'] : [];
  $('msgs').innerHTML = (e.length || w.length || sup.length)
    ? sup.concat(e.map((m) => `<div class="e">✕ ${esc(m.text)}</div>`), w.filter((m) => m.code !== 'CONTROL_SIDE_DEFAULT').map((m) => `<div class="w">⚠ ${esc(m.text)}</div>`)).join('')
    : '<div style="color:var(--c-success)">✓ Calculated · no errors or warnings</div>';
  $('calcSt').textContent = `${R.calc.status === 'ok' ? '●' : '✕'} ${R.calc.status === 'ok' ? 'Calculated' : 'Blocked'} · ${e.length} errors · ${w.length} warnings${ST.dirty ? ' · not saved' : ''}`;
}

// ───────────────────────────── чертежи (SVG) ─────────────────────────────
const NS = 'http://www.w3.org/2000/svg';
const svg = (w, h, body, attrs = '') => `<svg viewBox="0 0 ${Math.round(w)} ${Math.round(h)}" xmlns="${NS}" ${attrs}>${body}</svg>`;
const DIM = '#c0267a';
function dimH(x1, x2, y, t) {
  return `<g stroke="${DIM}" stroke-width="1" fill="${DIM}"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}"/><line x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}"/><path d="M${x1} ${y}l7 -3v6zM${x2} ${y}l-7 -3v6z" stroke="none"/></g><text x="${(x1 + x2) / 2}" y="${y - 4}" text-anchor="middle" font-size="11" fill="${DIM}">${t}</text>`;
}
function dimV(x, y1, y2, t) {
  const cy = (y1 + y2) / 2;
  return `<g stroke="${DIM}" stroke-width="1" fill="${DIM}"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><line x1="${x - 5}" y1="${y1}" x2="${x + 5}" y2="${y1}"/><line x1="${x - 5}" y1="${y2}" x2="${x + 5}" y2="${y2}"/>${y2 - y1 > 16 ? `<path d="M${x} ${y1}l-3 7h6zM${x} ${y2}l-3 -7h6z" stroke="none"/>` : ''}</g><text x="${x - 4}" y="${cy}" text-anchor="middle" font-size="11" fill="${DIM}" transform="rotate(-90 ${x - 4} ${cy})">${t}</text>`;
}
function dimS(x, y1, y2, t, side, col = DIM) {
  const tx = side === 'L' ? x - 7 : x + 7;
  return `<g stroke="${col}" stroke-width="1" fill="${col}"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><line x1="${x - 4}" y1="${y1}" x2="${x + 4}" y2="${y1}"/><line x1="${x - 4}" y1="${y2}" x2="${x + 4}" y2="${y2}"/>${y2 - y1 > 14 ? `<path d="M${x} ${y1}l-3 6h6zM${x} ${y2}l-3 -6h6z" stroke="none"/>` : ''}</g><text x="${tx}" y="${(y1 + y2) / 2 + 4}" font-size="11" fill="${col}" text-anchor="${side === 'L' ? 'end' : 'start'}">${t}</text>`;
}
function pvcColor() {
  const id = String(ST.doc.options.pvc || 'blue').replace('mesh-', '');
  return { blue: '#2a64b0', orange: '#e8711f', yellow: '#e9c22e', red: '#c62828', green: '#2e7d32', grey: '#7d868f', white: '#e9ecef' }[id] || '#2a64b0';
}
const textOn = () => (['yellow', 'white'].some((k) => String(ST.doc.options.pvc).includes(k)) ? '#333' : '#fff');

function frontView(mode) {
  const f = R.calc.frame; const c = R.calc.curtain; const d = ST.doc.options;
  if (!f) return '';
  const Wd = R.calc.opening.width; const Hd = R.calc.opening.height;
  const k = 300 / Math.max(Wd + 900, Hd + 900);
  const W = Wd * k; const H = Hd * k; const sk = f.sketch;
  const boxH = sk.headerHeight * k; const top = sk.overOpening * k; const postW = sk.column.w * k;
  const left = d.driveSide === 'L';
  const sideL = (left ? sk.motorSideWidth : sk.nonMotorSideWidth) * k; const sideR = (left ? sk.nonMotorSideWidth : sk.motorSideWidth) * k;
  const ox = 110; const floor = 30 + top + H + 40; const x0 = ox + sideL; const x1 = x0 + W;
  const yOpen = floor - H; const yTop = yOpen - top; const col = mode === 'frame' ? '#dfe6ef' : pvcColor();
  let b = `<line x1="20" y1="${floor}" x2="${x1 + sideR + 110}" y2="${floor}" stroke="#333"/>`;
  for (let x = 24; x < x1 + sideR + 110; x += 10) b += `<line x1="${x}" y1="${floor}" x2="${x - 6}" y2="${floor + 6}" stroke="#999"/>`;
  const postFill = mode === 'frame' ? '#9aa4ae' : '#c9ced3';
  b += `<rect x="${x0 - postW}" y="${yOpen - 200 * k}" width="${postW}" height="${H + 200 * k}" fill="${postFill}" stroke="#666"/>`;
  b += `<rect x="${x1}" y="${yOpen - 200 * k}" width="${postW}" height="${H + 200 * k}" fill="${postFill}" stroke="#666"/>`;
  b += `<rect x="${x0 - postW - 6}" y="${yTop}" width="${W + 2 * postW + 12}" height="${boxH}" fill="#d7dbe0" stroke="#555"/>`;
  const mx = left ? x0 - sideL : x1 + postW + 6; const mw = Math.max(8, sideL - postW - 6);
  b += `<rect x="${left ? mx : x1 + postW + 6}" y="${yTop - 8}" width="${left ? mw : Math.max(8, sideR - postW - 6)}" height="${sk.motorCoverHeight * k}" rx="3" fill="#aeb5bc" stroke="#555"/>`;
  // полотно: резинка, низ, секции, ветровики, до короба
  let y = floor - (CUR.effective.bottomRubber + CUR.effective.bottomProfile) * k;
  b += `<rect x="${x0}" y="${y}" width="${W}" height="${(CUR.effective.bottomRubber + CUR.effective.bottomProfile) * k}" fill="#7d8790"/>`;
  if (c) {
    c.sections.forEach((s, i) => {
      const hh = (s.top ? s.visible : s.h) * k;
      b += `<rect x="${x0}" y="${y - hh}" width="${W}" height="${hh}" fill="${s.transparent ? '#cfe6f7' : col}" ${mode === 'frame' ? 'stroke="#b8c3cf"' : ''}/>`;
      y -= hh;
      if (i < c.sections.length - 1) { b += `<rect x="${x0}" y="${y - CUR.effective.windbar * k}" width="${W}" height="${CUR.effective.windbar * k}" fill="#8b949c"/>`; y -= CUR.effective.windbar * k; }
    });
  }
  b += `<rect x="${x0}" y="${yTop + boxH}" width="${W}" height="${Math.max(0, y - yTop - boxH)}" fill="${col}"/>`;
  b += `<line x1="${x0 - postW - 24}" y1="${yOpen}" x2="${x1 + postW + 14}" y2="${yOpen}" stroke="#222" stroke-dasharray="6 4"/><text x="${x0 - postW - 26}" y="${yOpen - 4}" font-size="10" fill="#222" text-anchor="end">opening top</text>`;
  if (mode === 'order') {
    const ctrlLeft = d.controlSide === 'L';
    const cy = floor - (d.controlBoxHeight || 1200) * k; const cx = ctrlLeft ? x0 - postW - 40 : x1 + postW + 14;
    b += `<rect x="${cx}" y="${cy - 40}" width="26" height="40" rx="2" fill="#eee" stroke="#555"/><circle cx="${cx + 9}" cy="${cy - 18}" r="2.5" fill="#2e7d32"/><circle cx="${cx + 17}" cy="${cy - 18}" r="2.5" fill="#c62828"/><circle cx="${cx + 13}" cy="${cy - 9}" r="2.5" fill="#f9a825"/>`;
    b += dimH(x0, x1, floor + 28, 'W ' + Wd) + dimV(x1 + postW + 50, yOpen, floor, 'H ' + Hd);
  } else {
    const pc = d.photocells || { pairs: 1, levels: [400] };
    pc.levels.slice(0, pc.pairs).forEach((lv, p) => {
      const py = floor - lv * k;
      b += `<line x1="${x0}" y1="${py}" x2="${x1}" y2="${py}" stroke="#c62828" stroke-dasharray="5 4"/><rect x="${x0 - postW - 8}" y="${py - 5}" width="8" height="10" fill="#c62828"/><rect x="${x1 + postW}" y="${py - 5}" width="8" height="10" fill="#c62828"/>`;
      b += dimV(x0 - postW - 30 - p * 26, py, floor, `P${p + 1} ${lv}`);
    });
    const L = x0 - sideL;
    b += dimH(L, x1 + sideR, yTop - 26, `${sk.overallWidth} overall`) + dimH(x0, x1, floor + 28, 'W ' + Wd);
    b += dimH(L, x0, yTop - 50, String(Math.round(sideL / k))) + dimH(x1, x1 + sideR, yTop - 50, String(Math.round(sideR / k)));
    b += dimV(x1 + sideR + 40, yTop, floor, `${f.overallHeight} overall`) + dimV(x1 + sideR + 16, yOpen - 200 * k, floor, `rail ${f.guideLength}`) + dimV(x0 + W / 2, yOpen, floor, 'H ' + Hd);
  }
  return svg(x1 + sideR + 120, floor + 44, b);
}

function curtainView() {
  const c = R.calc.curtain; const Hd = R.calc.opening.height;
  const extraTop = c.sections.at(-1).h - c.sections.at(-1).visible - CUR.guideAboveOpening;
  const k = 380 / (Hd + 200 + extraTop * 0.3); const W = c.width * k * 0.6; const ox = 120;
  const floor = 30 + (Hd + 200 + extraTop * 0.3) * k; const col = pvcColor();
  let b = ''; let y = floor;
  const e = CUR.effective;
  b += `<rect x="${ox}" y="${y - e.bottomRubber * k}" width="${W}" height="${e.bottomRubber * k}" fill="#333"/>`; y -= e.bottomRubber * k;
  b += `<rect x="${ox}" y="${y - e.bottomProfile * k}" width="${W}" height="${e.bottomProfile * k}" fill="#7d8790"/>`; y -= e.bottomProfile * k;
  c.sections.forEach((s, i) => {
    const hh = (s.top ? s.visible : s.h) * k;
    b += `<rect x="${ox}" y="${y - hh}" width="${W}" height="${hh}" fill="${s.transparent ? '#cfe6f7' : col}"/>`;
    b += `<text x="${ox + W / 2}" y="${y - hh / 2 + 4}" text-anchor="middle" font-size="12" fill="${s.transparent ? '#1d5a86' : textOn()}">${s.top ? 'top' : s.transparent ? 'transparent' : i === 0 ? 'bottom' : 'section'} ${c.pitches[i]}</text>`;
    y -= hh;
    if (i < c.sections.length - 1) {
      b += `<rect x="${ox - 6}" y="${y - e.windbar * k}" width="${W + 12}" height="${e.windbar * k}" fill="#444"/><text x="${ox - 12}" y="${y - e.windbar * k / 2 + 4}" text-anchor="end" font-size="11" fill="#333">bar ${i + 1} · ${c.barCentres[i]}</text>`;
      y -= e.windbar * k;
    }
  });
  const yo = y; const yg = y - 200 * k; const ys = yg - extraTop * 0.3 * k;
  b += `<rect x="${ox}" y="${yg}" width="${W}" height="${200 * k}" fill="${col}" opacity=".8"/>`;
  b += `<rect x="${ox}" y="${ys}" width="${W}" height="${yg - ys}" fill="${col}" opacity=".3"/><text x="${ox + W / 2}" y="${ys + (yg - ys) / 2 + 4}" text-anchor="middle" font-size="10" fill="#174a7c">… under box and on shaft ${extraTop} (not to scale)</text>`;
  const zs = [0].concat(c.barCentres, [Hd + 200]);
  for (let q = 0; q < zs.length - 1; q++) b += dimV(ox + W + 26, floor - zs[q + 1] * k, floor - zs[q] * k, zs[q + 1] - zs[q]);
  b += `<line x1="${ox - 30}" y1="${yo}" x2="${ox + W + 60}" y2="${yo}" stroke="#222" stroke-dasharray="6 4"/><text x="${ox + W + 64}" y="${yo + 4}" font-size="10" fill="#222">opening top · H ${Hd}</text>`;
  b += `<line x1="${ox - 30}" y1="${yg}" x2="${ox + W + 60}" y2="${yg}" stroke="#222" stroke-dasharray="2 3"/><text x="${ox + W + 64}" y="${yg + 4}" font-size="10" fill="#222">box bottom · H+200 ${Hd + 200}</text>`;
  b += dimV(ox + W + 100, yg, floor, `visible H+200 = ${Hd + 200}`);
  b += `<line x1="${ox - 30}" y1="${floor}" x2="${ox + W + 60}" y2="${floor}" stroke="#333"/>` + dimH(ox, ox + W, floor + 22, String(c.width));
  return svg(ox + W + 210, floor + 34, b);
}

// намотка: спираль с буграми от профилей, маркеры ветровиков можно тянуть
const WCX = 170; const WCY = 165;
let WS = 1.2;
function windModel() {
  const c = R.calc.curtain; const f = R.calc.frame;
  return windCurtain({
    shaftDia: f.shaftDiameter, length: c.lengthExact, hangLength: CUR.guideAboveOpening + f.sidePlateSize.h / 2 - f.shaftDiameter / 2,
    sections: c.sections.map((s) => ({ h: s.h, transparent: s.transparent })), windbar: CUR.effective.windbar,
    windbarOuter: CUR.effective.windbarOuter, tPvc: c.pvcThickness, tClear: c.clearThickness, tProfile: c.profileThickness, withPath: true,
  });
}
function windView() {
  const f = R.calc.frame; const w = windModel();
  const dmax = f.rollDiameterMax / 2; WS = 140 / dmax;
  let pts = '';
  for (const [th, r] of w.path) pts += `${(WCX + r * WS * Math.sin(th)).toFixed(1)},${(WCY - r * WS * Math.cos(th)).toFixed(1)} `;
  let b = `<circle cx="${WCX}" cy="${WCY}" r="${(f.shaftDiameter / 2) * WS}" fill="#e7e7e2" stroke="#666"/><text x="${WCX}" y="${WCY + 4}" text-anchor="middle" font-size="11" fill="#777">shaft φ${f.shaftDiameter}</text>`;
  b += `<polyline points="${pts}" fill="none" stroke="${pvcColor()}" stroke-width=".8"/>`;
  const col = ['#c62828', '#1565c0', '#2e7d32', '#8e24aa', '#ef6c00', '#00838f', '#6d4c41', '#455a64', '#ad1457'];
  w.bars.forEach((q, i) => {
    if (q.theta == null) return;
    const r = q.r * WS + 2; const x = WCX + r * Math.sin(q.theta); const y = WCY - r * Math.cos(q.theta);
    b += `<line x1="${WCX}" y1="${WCY}" x2="${x}" y2="${y}" stroke="${col[i % col.length]}" stroke-width=".7" opacity=".6"/>`;
    b += `<g class="handle" data-bar="${i}"><circle cx="${x}" cy="${y}" r="11" fill="${col[i % col.length]}" stroke="#fff" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" fill="#fff" font-weight="600" pointer-events="none">${i + 1}</text></g>`;
  });
  b += `<circle cx="${WCX}" cy="${WCY}" r="${dmax * WS}" fill="none" stroke="${DIM}" stroke-dasharray="4 4"/><text x="${WCX + dmax * WS * 0.72}" y="${WCY + dmax * WS * 0.72 + 12}" font-size="10" fill="${DIM}">D max ${f.rollDiameterMax}</text>`;
  return svg(340, 330, b, 'id="windSvg" style="touch-action:none"');
}
function bindDrag() {
  const sv = $('windSvg'); if (!sv) return;
  sv.querySelectorAll('.handle').forEach((g) => g.addEventListener('pointerdown', (e) => {
    if (ST.view) return;
    e.preventDefault(); const bi = +g.dataset.bar;
    let last = 0;
    const move = (ev) => {
      const now = performance.now(); if (now - last < 40) return; last = now;
      const cs = $('windSvg'); const pt = cs.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(cs.getScreenCTM().inverse());
      const a = Math.atan2(p.x - WCX, -(p.y - WCY));
      const q = R.calc.curtain.winding.bars[bi]; if (q.theta == null) return;
      const cur = ((q.theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let dd = a - cur; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
      const ds = Math.round(q.r * dd); if (!ds) return;
      // ветровик дальше от вала (ds > 0) = ниже на воротах: секция под ним уменьшается, над ним растёт
      const pp = R.calc.curtain.pitches.slice();
      const below = pp[bi] - ds; const above = pp[bi + 1] + ds;
      if (below < 300 || (bi + 1 < pp.length - 1 && above < 300)) return;
      pp[bi] = below; if (bi + 1 < pp.length - 1) pp[bi + 1] = above;
      setManualPitches(pp);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }));
}

function topView() {
  const f = R.calc.frame; const dr = R.calc.drive; const left = ST.doc.options.driveSide === 'L';
  const k = 380 / (f.boxLength + 700); const box = f.boxLength * k; const ox = 80; const y0 = 52; const dep = f.sidePlateSize.d * k * 1.4; const sh = f.shaftLength * k;
  let b = `<line x1="${ox - 60}" y1="${y0 - 14}" x2="${ox + box + 60}" y2="${y0 - 14}" stroke="#333" stroke-width="2"/><text x="${ox + box + 62}" y="${y0 - 10}" font-size="10" fill="#777">wall</text>`;
  b += `<rect x="${ox}" y="${y0}" width="${box}" height="${dep}" fill="#f1f3f5" stroke="#555"/>`;
  b += `<line x1="${ox}" y1="${y0 + 6}" x2="${ox + box}" y2="${y0 + 6}" stroke="#999" stroke-dasharray="6 3"/><line x1="${ox}" y1="${y0 + dep - 6}" x2="${ox + box}" y2="${y0 + dep - 6}" stroke="#999" stroke-dasharray="6 3"/>`;
  b += `<rect x="${ox - 5}" y="${y0 - 4}" width="5" height="${dep + 8}" fill="#777"/><rect x="${ox + box}" y="${y0 - 4}" width="5" height="${dep + 8}" fill="#777"/>`;
  const sx = ox + (box - sh) / 2; const sy = y0 + dep / 2; const sr = (f.shaftDiameter / 2) * k * 1.4;
  b += `<rect x="${sx}" y="${sy - sr}" width="${sh}" height="${sr * 2}" fill="#cfd5db" stroke="#555"/>`;
  b += `<rect x="${sx}" y="${sy - sr - 1}" width="4" height="${sr * 2 + 2}" fill="#555"/><rect x="${sx + sh - 4}" y="${sy - sr - 1}" width="4" height="${sr * 2 + 2}" fill="#555"/>`;
  const aD = CAT.header.axles.motorSide.length * k; const aO = CAT.header.axles.otherSide.length * k;
  const aL = left ? aD : aO; const aR = left ? aO : aD;
  const lx = sx - aL * 0.75; const rx = sx + sh - aR * 0.25;
  b += `<rect x="${lx}" y="${sy - 3}" width="${aL}" height="6" fill="#888"/><rect x="${rx}" y="${sy - 3}" width="${aR}" height="6" fill="#888"/>`;
  b += `<rect x="${ox - 9}" y="${sy - 9}" width="13" height="18" fill="#2e7d32"/><rect x="${ox + box}" y="${sy - 9}" width="13" height="18" fill="#2e7d32"/>`;
  const mX = left ? ox - 58 : ox + box + 14;
  b += `<rect x="${mX}" y="${sy - 14}" width="44" height="28" rx="3" fill="#aeb5bc" stroke="#555"/><rect x="${mX + 8}" y="${sy + 14}" width="28" height="44" rx="3" fill="#aeb5bc" stroke="#555"/><text x="${mX + 22}" y="${sy + 76}" text-anchor="middle" font-size="10" fill="#555">${dr ? dr.motorSku : ''}</text>`;
  b += `<text x="${ox + box / 2}" y="${sy + 4}" text-anchor="middle" font-size="11" fill="#333">shaft φ${f.shaftDiameter} · ${f.shaftLength}</text>`;
  b += dimH(sx, sx + sh, y0 + dep + 24, `shaft ${f.shaftLength}`) + dimH(ox, ox + box, y0 + dep + 50, `box ${f.boxLength}`);
  b += `<text x="${ox + box / 2}" y="${y0 + dep + 70}" text-anchor="middle" font-size="10" fill="#777">beams MET50x25 × ${f.beamQty} · ${f.beamLength} (dashed)</text>`;
  b += dimH(lx, lx + aL, y0 - 30, `axle ${Math.round(aL / k)}`) + dimH(rx, rx + aR, y0 - 30, `axle ${Math.round(aR / k)}`);
  return svg(ox + box + 90, y0 + dep + 80, b);
}
function boxSection() {
  const f = R.calc.frame; const c = R.calc.curtain;
  const k = 0.6; const w = f.sidePlateSize.d * k; const h = f.sidePlateSize.h * k; const ox = 40; const oy = 14;
  const cx = ox + w / 2; const cy = oy + h / 2 + 6; const r = (f.shaftDiameter / 2) * k; const rd = ((c ? c.rollDiameter : f.shaftDiameter) / 2) * k; const rmax = (f.rollDiameterMax / 2) * k;
  let b = `<rect x="${ox}" y="${oy}" width="${w}" height="${h}" rx="4" fill="#f1f3f5" stroke="#555"/>`;
  b += `<circle cx="${cx}" cy="${cy}" r="${rmax}" fill="none" stroke="${DIM}" stroke-dasharray="4 3"/>`;
  b += `<circle cx="${cx}" cy="${cy}" r="${rd}" fill="${pvcColor()}" opacity=".35"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#cfd5db" stroke="#555"/>`;
  b += `<text x="${ox + w + 10}" y="${oy + 20}" font-size="11">End plate ${f.sidePlateSize.h} × ${f.sidePlateSize.d}</text><text x="${ox + w + 10}" y="${oy + 38}" font-size="11" fill="#174a7c">Roll Ø ${c ? c.rollDiameter : '—'} (open door)</text><text x="${ox + w + 10}" y="${oy + 56}" font-size="11" fill="${DIM}">D max ${f.rollDiameterMax}</text><text x="${ox + w + 10}" y="${oy + 74}" font-size="11" fill="#555">Shaft φ${f.shaftDiameter}</text>`;
  return svg(ox + w + 170, oy + h + 20, b);
}
function cutMap() {
  const c = R.calc.curtain; const cut = CUR.cut;
  const k = 0.12; const Wc = c.cutWidth * k; const ox = 160; const GP = 4; let y = 12; let b = '';
  const col = pvcColor();
  const P = [];
  c.sections.slice().reverse().forEach((s) => {
    if (s.transparent) {
      P.push({ label: 'strip', cut: s.stripCut, fill: col });
      P.push({ label: 'transparent film', cut: s.filmCut, eff: [-cut.windowFilmMinus / 2, -cut.windowFilmMinus / 2], effTxt: `eff ${s.h}`, fill: '#cfe6f7', dark: 1 });
      P.push({ label: 'strip', cut: s.stripCut, fill: col });
    } else if (s.top) P.push({ label: 'top', cut: s.cut, eff: [cut.topPocket, cut.topBottom], effTxt: `eff ${s.h} (visible ${s.visible})`, fill: col });
    else P.push({ label: s.no === 1 ? 'bottom' : 'section', cut: s.cut, eff: [cut.opaque / 2, cut.opaque / 2], effTxt: `eff ${s.h}`, fill: col });
  });
  P.forEach((p) => {
    const h = p.cut * k;
    b += `<rect x="${ox}" y="${y}" width="${Wc}" height="${h}" fill="${p.fill}" stroke="#174a7c" stroke-width=".8"/>`;
    if (h > 14) b += `<text x="${ox + Wc / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="11.5" fill="${p.dark ? '#174a7c' : textOn()}">${p.label}</text>`;
    if (p.eff) {
      const e1 = y + p.eff[0] * k; const e2 = y + h - p.eff[1] * k;
      b += `<line x1="${ox - 6}" y1="${e1}" x2="${ox + Wc + 6}" y2="${e1}" stroke="#000" stroke-dasharray="7 4" stroke-width="1.1"/><line x1="${ox - 6}" y1="${e2}" x2="${ox + Wc + 6}" y2="${e2}" stroke="#000" stroke-dasharray="7 4" stroke-width="1.1"/>`;
      b += dimS(ox - 16, e1, e2, p.effTxt, 'L', '#000');
    }
    b += dimS(ox + Wc + 16, y, y + h, `cut ${p.cut}`, 'R');
    y += h + GP;
  });
  b += dimH(ox, ox + Wc, y + 18, `${c.cutWidth} = ${c.width} + ${cut.widthMargin}`);
  return svg(ox + Wc + 100, y + 30, b);
}

// ───────────────────────────── спецификация ─────────────────────────────
const SHEETS = [
  { no: 1, key: 'b1', title: 'Curtain', sections: ['curtain'] },
  { no: 2, key: 'b2', title: 'Guides', sections: ['guides'] },
  { no: 3, key: 'b3', title: 'Shaft, box and drive', sections: ['header', 'drive'] },
];
const GROUPS = {
  pvc: 'Fabric', 'pvc.clear': 'Fabric', windbar: 'Profiles', 'windbar.plug': 'Profiles', nylon: 'Profiles', bottom: 'Bottom', 'bottom.plug': 'Bottom', 'bottom.seal': 'Bottom',
  'header.cover': 'Header box', 'header.endPlates': 'Header box', beam: 'Header box', shaft: 'Shaft', 'shaft.flange': 'Shaft', 'axle.motor': 'Shaft', 'axle.other': 'Shaft', bearing: 'Shaft', lockingCup: 'Shaft',
  'photocell.support': 'Photocells', motor: 'Drive', controlUnit: 'Drive', 'motor.plate': 'Drive', 'motor.bumper': 'Drive', 'motor.cover': 'Drive', cable: 'Drive',
};
const groupOf = (l) => l.extra ? 'Added by hand' : GROUPS[l.partId] || (l.partId.startsWith('guide.') ? (/Bracket|pad/i.test(l.partId) ? 'Brackets' : 'Guide rails') : l.partId.startsWith('std.') || l.partId.startsWith('acc.') ? 'Safety and accessories' : 'Other');

/** Строки спецификации с ручными правками (замена SKU, количество, удаление, добавленные строки). */
function editedLines() {
  if (!R.spec) return [];
  const E = ST.edits;
  const out = [];
  for (const l of R.spec.lines) {
    if (E.removed.includes(l.partId)) continue;
    const x = { ...l };
    if (E.sku[l.partId] && E.sku[l.partId] !== l.sku) { x.sku = E.sku[l.partId]; x.name = itemName(x.sku); x.unit = ITEM.get(x.sku)?.unit || x.unit; x.missingSku = !ITEM.has(x.sku); x.edited = true; }
    if (E.qty[l.partId] != null && E.qty[l.partId] !== l.qty) { x.qty = E.qty[l.partId]; x.edited = true; }
    out.push(x);
  }
  E.extra.forEach((r, i) => out.push({ section: r.section, partId: `extra.${i}`, sku: r.sku, name: itemName(r.sku), unit: ITEM.get(r.sku)?.unit || 'pcs', qty: r.qty, rule: 'added by hand', extra: true, edited: true, missingSku: !ITEM.has(r.sku) }));
  return out;
}

function renderSpec() {
  const c = R.calc; const d = ST.doc;
  const blocked = c.status !== 'ok' || !R.spec;
  const warn = [];
  if (!idOf(d)) warn.push('Order number is required to save');
  c.errors.forEach((m) => warn.push('✕ ' + m.text));
  c.warnings.filter((m) => m.code !== 'CONTROL_SIDE_DEFAULT').forEach((m) => warn.push('⚠ ' + m.text));
  const lines = editedLines();
  lines.filter((l) => l.missingSku).forEach((l) => warn.push(`⚠ ${l.partId}: no SKU in Zoho`));
  $('specWarn').innerHTML = warn.length ? `<div class="wrbox" style="margin:0 0 4px">${warn.map(esc).join('<br>')}</div>` : '';
  const matLabel = CAT.frameMaterials.options.find((m) => m.id === d.options.frameMaterial)?.label?.en || '';
  const head = `${esc(d.id || '—')} · ${esc(d.order.customer?.name || '')} · SDA-DS · ${c.opening.width} × ${c.opening.height} · ${esc(matLabel)} · ${esc(d.options.pvc)} · ×${c.opening.quantity}`;
  $('summary').innerHTML = `${head} · <span style="background:var(--c-override);padding:0 6px;border-radius:4px">yellow</span> — manual change of item or quantity`;
  document.querySelectorAll('input[name=asm]').forEach((r) => { r.checked = r.value === ST.assembly; });
  $('bun').textContent = d.id ? 'BUN-' + d.id.replace(/^DSO-/i, '') : '—';
  $('asmQty').textContent = c.opening.quantity; $('asmDate').value = ST.asmDate;
  $('btnCsv').disabled = blocked; $('btnSave').disabled = blocked || !idOf(d);
  if (blocked) { $('sheets').innerHTML = '<div class="errbox">Specification is not available: fix the errors in the calculator.</div>'; return; }
  const qtyTotal = c.opening.quantity;
  const hdr = (s) => `<div class="sheet-h"><div class="meta"><div><span>Order no.</span><b>${esc(d.id || '—')}</b> · ${c.opening.width} × ${c.opening.height} · SDA-DS · ${esc(matLabel)}</div><div><span>Customer</span>${esc(d.order.customer?.name || '')}</div></div><div class="ttl"><b>${s.no} · ${s.title}</b><small>QTY: ${qtyTotal}${s.no === 1 ? ' · = DUS-055' : ''}${ST.assembly === 'DUS-055' && s.no > 1 ? ' · not in DUS-055' : ''}</small></div></div>`;
  let html = '';
  for (const s of SHEETS) {
    const ls = lines.filter((l) => s.sections.includes(l.section));
    let t = `<table class="tw"><tr><th>SKU</th><th>Title</th><th class="n">Length, mm</th><th class="n">Qty / 1 door</th><th class="n">Qty total</th><th>Unit</th><th>Comment</th><th class="noprint"></th></tr>`;
    let g = null;
    for (const l of ls) {
      const gr = groupOf(l);
      if (gr !== g) { g = gr; t += `<tr class="grp"><td colspan="8">${esc(gr)}</td></tr>`; }
      const len = lengthOf(l);
      t += `<tr class="${l.edited ? 'ov' : ''}"><td><input class="sku" list="skuList" data-sku="${esc(l.partId)}" value="${esc(l.sku || '')}"></td><td>${esc(l.name || '—')}</td><td class="n">${len ?? '—'}</td>
        <td class="n"><input class="num" data-qty="${esc(l.partId)}" value="${l.qty}"></td><td class="n">${round3(l.qty * qtyTotal)}</td><td>${esc(l.unit || '')}</td><td>${esc(l.rule || '')}</td>
        <td class="noprint"><button class="btn btn-sm rm" data-del="${esc(l.partId)}">×</button></td></tr>`;
    }
    t += `</table><div class="addrow edit-only" style="margin-top:8px"><button class="btn btn-sm" data-add="${s.sections[0]}">+ row</button></div>`;
    html += `<div class="sheet ${$$prn(s.no) ? '' : 'noprint-sheet'}">${hdr(s)}<div class="sheet-b"><div>${t}</div><div>${sheetGraphic(s.no)}</div></div></div>`;
  }
  $('sheets').innerHTML = html;
  $('sheets').querySelectorAll('[data-qty]').forEach((e) => e.onchange = () => {
    const id = e.dataset.qty; const v = Math.max(0, +String(e.value).replace(',', '.') || 0);
    if (id.startsWith('extra.')) ST.edits.extra[+id.slice(6)].qty = v; else ST.edits.qty[id] = v;
    ST.dirty = true; renderSpec();
  });
  $('sheets').querySelectorAll('[data-sku]').forEach((e) => e.onchange = () => {
    const id = e.dataset.sku; const v = e.value.trim();
    if (id.startsWith('extra.')) ST.edits.extra[+id.slice(6)].sku = v; else ST.edits.sku[id] = v;
    ST.dirty = true; renderSpec();
  });
  $('sheets').querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
    const id = b.dataset.del;
    if (id.startsWith('extra.')) ST.edits.extra.splice(+id.slice(6), 1); else ST.edits.removed.push(id);
    ST.dirty = true; renderSpec();
  });
  $('sheets').querySelectorAll('[data-add]').forEach((b) => b.onclick = () => {
    ST.edits.extra.push({ section: b.dataset.add, sku: '', qty: 1 }); ST.dirty = true; renderSpec();
  });
}
const $$prn = (no) => { const e = document.querySelector(`.prn[value="${no}"]`); return !e || e.checked; };
const round3 = (v) => Math.round(v * 1000) / 1000;
function lengthOf(l) {
  const c = R.calc.curtain; const f = R.calc.frame;
  return { windbar: c.width, nylon: c.width, bottom: c.width, 'bottom.seal': c.width, 'header.cover': f.boxLength, beam: f.beamLength, shaft: f.shaftLength,
    'axle.motor': CAT.header.axles.motorSide.length, 'axle.other': CAT.header.axles.otherSide.length, 'guide.rail': f.guideLength, 'guide.brush': f.guideLength,
    'guide.wearStrip': f.guideLength, 'guide.cover': f.guideLength, 'guide.seal': f.guideLength, 'guide.fittingStrip': f.guideLength }[l.partId];
}
function sheetGraphic(no) {
  const c = R.calc.curtain; const f = R.calc.frame; const dr = R.calc.drive; const d = ST.doc.options;
  if (no === 1) {
    return `<div class="kv"><div><span>Curtain size</span><b>${c.width} × ${c.length} mm</b></div><div><span>Sections, c–c (top → bottom)</span><b>${c.pitches.slice().reverse().join(' · ')}</b></div><div><span>Wind bars</span><b>${c.windbars} · ${c.windbarProfile.sku || '—'}</b></div><div><span>Roll Ø · shaft</span><b>${c.rollDiameter} mm · φ${f.shaftDiameter}</b></div></div>
      <div class="pvh" style="margin-top:10px">Cutting map · ${esc(c.pvc.sku || d.pvc)} · top to bottom</div><div class="dwg" id="sp1cut">${cutMap()}</div>`;
  }
  if (no === 2) {
    const pc = d.photocells || { pairs: 1, levels: [400] };
    return `<div class="kv"><div><span>Rail</span><b>${esc(CAT.guides.items.find((g) => g.id === f.guide).name)} · ${f.guideSize.w} × ${f.guideSize.d}</b></div><div><span>Overall W × H</span><b>${f.sketch.overallWidth} × ${f.overallHeight} mm</b></div><div><span>Photocells</span><b>${pc.pairs} pair${pc.pairs > 1 ? 's' : ''} · ${pc.levels.slice(0, pc.pairs).join(' / ')} mm</b></div></div><div class="dwg">${frontView('frame')}</div>`;
  }
  return `<div class="kv"><div><span>Box · shaft</span><b>${f.sidePlate} ${f.sidePlateSize.h} × ${f.sidePlateSize.d} · φ${f.shaftDiameter}</b></div><div><span>Motor</span><b>${dr.motorSku} · ${dr.powerKw} kW · ${dr.gearbox} ${dr.ratio} · ${dr.driveSide === 'L' ? 'left' : 'right'}</b></div><div><span>Cable</span><b>${dr.cableLength} mm · in kit ${dr.cableIncluded / 1000} m</b></div></div><div class="dwg">${topView()}</div><div class="dwg" style="margin-top:8px"><div style="max-width:340px;margin:0 auto">${boxSection()}</div></div>`;
}

// ───────────────────────────── CSV, сохранение ─────────────────────────────
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('btnCsv').onclick = () => {
  const res = { calc: R.calc, spec: { ...R.spec, lines: editedLines().filter((l) => l.sku) } };
  const out = exportAssemblyCsv(ownDoc(), res, CAT, { assemblySku: ST.assembly, date: ST.asmDate });
  if (!out.csv || out.problems.length) {
    if (!out.csv || !confirm(`CSV problems:\n${out.problems.join('\n')}\n\nDownload anyway?`)) { if (!out.csv) alert(out.problems.join('\n')); return; }
  }
  download(out.fileName, out.csv, 'text/csv;charset=utf-8');
};
document.querySelectorAll('input[name=asm]').forEach((r) => r.onchange = () => { ST.assembly = r.value; ST.dirty = true; renderSpec(); });
$('asmDate').onchange = (e) => { ST.asmDate = e.target.value; };
document.querySelectorAll('.prn').forEach((e) => e.onchange = () => renderSpec());
$('btnPrint').onclick = () => window.print();

async function save() {
  const d = ST.doc;
  const id = idOf(d);
  if (!id) { alert('Order number is required'); return; }
  if (FS.state !== 'ok' && FS.state !== 'unsupported' && FS.state !== 'none') {
    alert('Working folder: click «Reconnect» in the top bar first'); return;
  }
  try {
    const ix = await readIndex();
    const clash = ix.rows.find((r) => r.id === id);
    if (clash && id !== ST.calcId) { alert(`Specification ${id} already exists in the registry. Open it there or change the number.`); return; }
    d.options.supply = 'own'; // SDA → SDA-DS при сохранении (Alex 26.11)
    recalc();
    const now = nowStr();
    const so = String(d.order.salesorderNumber).replace(/^DSO-/i, '');
    const rec = {
      app: 'hsd-configurator', kind: 'calc', version: VERSION, engine: ENGINE, id, category: 'highspeed', product: 'SDA-DS',
      order: `DSO-${so}`, pos: d.order.salesorderItem || '', customer: d.order.customer?.name || '',
      doorType: `${R.calc.opening.width}×${R.calc.opening.height}`, qty: R.calc.opening.quantity,
      created: ST.created, edited: now, formId: ST.formId || null,
      doc: d, form: ST.form, edits: ST.edits, assembly: ST.assembly, asmDate: ST.asmDate,
      calc: R.calc, spec: R.spec ? { ...R.spec, lines: editedLines() } : null,
    };
    const row = { id, order: rec.order, pos: rec.pos, customer: rec.customer, doorType: rec.doorType, qty: rec.qty,
      created: rec.created, edited: now, app: rec.app, category: rec.category, product: rec.product };
    await saveCalc(rec, row);
    const frozen = await freezeForm(id);
    ST.calcId = id; ST.dirty = false;
    history.replaceState(null, '', `?calc=${encodeURIComponent(id)}&lang=${LANG}`);
    setView(true);
    banner('ok', `Saved ${id} to the registry${FS.state === 'ok' ? ` (folder ${esc(FS.name)})` : ' (this browser only — no working folder)'}${frozen ? ' · order form frozen' : ''}.`);
    render(); tab('spec');
  } catch (e) { alert('Save failed: ' + e.message); }
}
$('btnSave').onclick = save;
document.querySelectorAll('.exit').forEach((b) => b.onclick = () => {
  if (ST.dirty && !confirm('Leave without saving?')) return;
  location.href = `${SPECS_URL}?lang=${LANG}`;
});
$('btnEdit').onclick = () => { setView(false); tab('calc'); history.replaceState(null, '', `?calc=${encodeURIComponent(ST.calcId)}&mode=edit&lang=${LANG}`); };
$('btnCopy').onclick = () => { location.href = `?copy=${encodeURIComponent(ST.calcId)}&lang=${LANG}`; };

// ───────────────────────────── ввод ─────────────────────────────
const num = (v) => (v === '' || v == null ? null : Math.round(+v));
const bindIn = (id, fn) => { $(id).addEventListener('change', (e) => { fn(e.target.value); change(); }); };
bindIn('fSo', (v) => { ST.doc.order.salesorderNumber = v.trim() ? 'DSO-' + v.trim().replace(/^DSO-/i, '') : ''; maybeImportForm(); });
bindIn('fPos', (v) => { ST.doc.order.salesorderItem = num(v) || null; maybeImportForm(); });
bindIn('fQty', (v) => { ST.doc.opening.quantity = Math.max(1, num(v) || 1); });
bindIn('fCust', (v) => { ST.doc.order.customer = { ...(ST.doc.order.customer || {}), name: v }; });
bindIn('fRef', (v) => { ST.doc.order.reference = v; });
bindIn('fAddr', (v) => { ST.doc.order.deliveryAddress = v; });
bindIn('fW', (v) => { ST.doc.opening.width = num(v); });
bindIn('fH', (v) => { ST.doc.opening.height = num(v); });
bindIn('fSupply', (v) => { ST.doc.options.supply = v; });
bindIn('fFrame', (v) => { ST.doc.options.frameMaterial = v; });
bindIn('fFabric', (v) => { ST.doc.options.pvc = v === 'mesh' ? 'mesh-yellow' : 'blue'; });
bindIn('fColor', (v) => { ST.doc.options.pvc = v; });
bindIn('fCtrlH', (v) => { ST.doc.options.controlBoxHeight = num(v); });
bindIn('fTr', (v) => { if (v === 'auto') delete ST.doc.options.transparentSections; else ST.doc.options.transparentSections = v === 'none' ? [] : [+v]; });
bindIn('fTPvc', (v) => { ST.doc.options.pvcThickness = +v || undefined; });
bindIn('fTClr', (v) => { ST.doc.options.clearThickness = +v || undefined; });
bindIn('fTProf', (v) => { ST.doc.options.profileThickness = +v || undefined; });
bindIn('fPc1', (v) => { const pc = ST.doc.options.photocells; pc.levels[0] = num(v); });
bindIn('fPc2', (v) => { const pc = ST.doc.options.photocells; pc.levels[1] = num(v); });
$('sDrive').querySelectorAll('button').forEach((b) => b.onclick = () => { ST.doc.options.driveSide = b.dataset.v; change(); });
$('sCtrl').querySelectorAll('button').forEach((b) => b.onclick = () => { ST.doc.options.controlSide = b.dataset.v; change(); });
$('sPc').querySelectorAll('button').forEach((b) => b.onclick = () => {
  const pc = ST.doc.options.photocells; pc.pairs = +b.dataset.v;
  pc.levels = pc.pairs === 2 ? [pc.levels[0] ?? 400, pc.levels[1] ?? 1000] : [pc.levels[0] ?? 400];
  change();
});
$('fFrame').innerHTML = CAT.frameMaterials.options.map((m) => `<option value="${m.id}">${esc(m.label.en)}</option>`).join('');
$('accAdd').onclick = () => { (ST.doc.options.accessories ||= []).push({ type: 'radar', sku: 'Orca', qty: 1 }); change(); };
const reasonOf = () => $('fPlateR').value.trim() || '—';
$('fPlate').onchange = (e) => { setOv('frame.sidePlate', e.target.value || undefined, reasonOf()); change(); };
$('fMotor').onchange = (e) => { setOv('drive.motor', e.target.value || undefined, reasonOf()); change(); };
$('fPlateR').onchange = () => {
  const r = reasonOf();
  for (const p of ['frame.sidePlate', 'drive.motor']) { const o = ov(p); if (o) setOv(p, o.value, r); }
  change();
};
$('nPlus').onclick = () => { const s = (ST.doc.options.sections ||= {}); s.extraWindbars = Math.min(CUR.manualExtraWindbarsMax, (s.extraWindbars || 0) + 1); delete ST.doc.options.transparentSections; change(); };
$('nMinus').onclick = () => { const s = (ST.doc.options.sections ||= {}); s.extraWindbars = Math.max(0, (s.extraWindbars || 0) - 1); delete ST.doc.options.transparentSections; change(); };
$('nAuto').onclick = $('resetL').onclick = () => {
  setOv('curtain.sections', undefined); if (ST.doc.options.sections) ST.doc.options.sections.extraWindbars = 0;
  delete ST.doc.options.transparentSections; change();
};
document.querySelectorAll('[data-p1]').forEach((b) => b.onclick = () => {
  document.querySelectorAll('[data-p1]').forEach((x) => x.classList.toggle('on', x === b));
  $('p1wind').classList.toggle('hidden', b.dataset.p1 !== 'wind'); $('p1cur').classList.toggle('hidden', b.dataset.p1 !== 'cur');
});
$('skuList').innerHTML = CAT.items.items.map((i) => `<option value="${esc(i.sku)}">${esc(i.zohoName || i.name)}</option>`).join('');

// открыть JSON формы заказа (форма сохраняет заказ файлом, пока нет справочника форм)
$('openFile').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const doc = JSON.parse(await f.text());
    if (doc.productType !== 'hsr') throw new Error('not an SDA order (productType ≠ hsr)');
    loadFromForm(doc, doc.id);
    banner('info', `Imported order form ${esc(doc.id || f.name)}.`);
  } catch (err) { alert('Cannot open: ' + err.message); }
  e.target.value = '';
};
function loadFromForm(doc, formId) {
  const d = clone(doc);
  d.options = { ...emptyDoc().options, ...d.options };
  d.options.photocells ||= { pairs: 1, levels: [CAT.accessories.photocell.levelDefault || 400] };
  ST.doc = d; ST.form = clone(doc); ST.formId = formId || doc.id; change();
}
let importAsked = '';
async function maybeImportForm() {
  const id = idOf(ST.doc);
  if (!id || ST.form || importAsked === id) return;
  importAsked = id;
  try {
    const form = await stGet(`forms/${id}.json`);
    const doc = form && (form.doc || (form.productType === 'hsr' ? form : null));
    if (doc && confirm(`Order form ${id} is saved. Import its data?`)) loadFromForm(doc, id);
  } catch (e) { /* нет папки — нечего подтягивать */ }
}

// ───────────────────────────── вкладки, режимы, папка ─────────────────────────────
function tab(t) {
  $('tab-calc').classList.toggle('hidden', t !== 'calc'); $('tab-spec').classList.toggle('hidden', t !== 'spec');
  document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x.dataset.tab === t));
  if (t === 'spec') renderSpec();
  window.scrollTo(0, 0);
}
document.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => tab(b.dataset.tab));
document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => tab(b.dataset.go));
function setView(v) {
  ST.view = v; document.body.classList.toggle('view', v);
  document.querySelectorAll('#tab-calc input, #tab-calc select, #tab-calc textarea').forEach((e) => { if (!e.hasAttribute('readonly') || e.dataset.ro === '0') e.disabled = v; });
}
function banner(kind, html, btn) {
  const b = $('banner'); b.className = `banner ${kind}`; b.innerHTML = html + (btn ? ` <button class="btn btn-sm" id="bannerBtn">${btn.text}</button>` : '');
  if (btn) $('bannerBtn').onclick = btn.onclick;
}
function fsUi() {
  const b = $('fsBtn'); const s = FS.state;
  b.textContent = s === 'ok' ? `Folder: ${FS.name} ✓` : s === 'reconnect' ? `Reconnect folder (${FS.name})` : s === 'unsupported' ? 'Browser: no folder access' : 'Choose working folder';
  b.className = 'btn btn-sm ' + (s === 'ok' ? 'btn-ok' : '');
}
$('fsBtn').onclick = async () => {
  try {
    if (FS.state === 'reconnect') await fsReconnect(); else if (FS.state !== 'unsupported') await fsPick();
    fsUi(); if (PENDING) { const p = PENDING; PENDING = null; await p(); }
  } catch (e) { if (e && e.name !== 'AbortError') alert(e.message); }
};
window.addEventListener('beforeunload', (e) => { if (ST.dirty && !ST.view) { e.preventDefault(); e.returnValue = ''; } });

// ───────────────────────────── запуск ─────────────────────────────
let PENDING = null;
async function openFromUrl() {
  const q = new URLSearchParams(location.search);
  const calcId = q.get('calc') || q.get('copy'); const formId = q.get('form');
  if ((calcId || formId) && FS.state === 'reconnect') {
    PENDING = openFromUrl;
    banner('warn', `The browser needs permission for the working folder «${esc(FS.name)}» to open ${esc(calcId || formId)}.`, { text: 'Allow', onclick: () => $('fsBtn').click() });
    return;
  }
  $('banner').className = 'banner hidden';
  if (calcId) {
    const rec = await stGet(`calcs/${calcId}.json`).catch(() => null);
    if (!rec || rec.app !== 'hsd-configurator') {
      banner('err', `Specification ${esc(calcId)} not found${FS.state === 'ok' ? '' : ' (working folder not selected)'}.`, { text: '← Specifications', onclick: () => { location.href = `${SPECS_URL}?lang=${LANG}`; } });
      return;
    }
    ST.doc = rec.doc; ST.form = rec.form || null; ST.formId = rec.formId || null; ST.edits = rec.edits || ST.edits;
    ST.assembly = rec.assembly || 'SDA-DS'; ST.asmDate = rec.asmDate || ST.asmDate; ST.created = rec.created || ST.created;
    if (q.get('copy')) {
      ST.doc.order.salesorderNumber = ''; ST.doc.order.salesorderItem = null; ST.form = null; ST.formId = null; ST.created = nowStr(); ST.calcId = null;
      recalc(); setView(false); render(); tab('calc');
      banner('info', `Copy of ${esc(calcId)}: enter a new order number.`);
      return;
    }
    ST.calcId = calcId; recalc();
    const edit = q.get('mode') === 'edit';
    setView(!edit); render(); tab(edit ? 'calc' : 'spec');
    return;
  }
  if (formId) {
    const form = await stGet(`forms/${formId}.json`).catch(() => null);
    const doc = form && (form.doc || (form.productType === 'hsr' ? form : null));
    if (doc) { loadFromForm(doc, formId); setView(false); tab('calc'); return; }
    banner('warn', `Order form ${esc(formId)} not found in the working folder. Open the order JSON saved by the order form, or fill in the order by hand.`, { text: 'Open order JSON…', onclick: () => $('openFile').click() });
  }
  recalc(); setView(false); render(); tab('calc');
}

$('ver').textContent = `v${VERSION} · ${ENGINE}`;
applyLang();
await fsInit(); fsUi();
recalc(); render();
await openFromUrl();
