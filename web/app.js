// Форма заказа SDA на ядре расчёта (products/hsr). Макет: 05-order-form/order-form-mockup.html (тред 05).
// Расчёт, раскладка, рама, привод и спецификация — только из ядра; форма их не дублирует.
// В сборке dist/ каталоги встроены в window.__CATALOGS__, в разработке читаются из ../catalogs/hsr.
// Сохранение — в справочник форм заказа (forms.html): общая папка Door calculation tool, forms/<id>.json + forms/index.json.
// Адреса: ?form=<id> открыть сохранённую · ?new=1&product=SDA|SDA-DS новая · lang=en|th.
// Форма заморожена (только просмотр), если есть спецификация с тем же номером (calcs/index.json); разморозить = удалить спецификацию.
// Себестоимости и состава (спецификации, CSV Zoho) здесь нет: это экран менеджера, спецификация — в калькуляторе SDA.
import { calculateHsr, ENGINE } from '../products/hsr/index.js';
import { FS, fsInit, fsPick, fsReconnect, stGet, readForms, specIds, saveForm, deleteForm, nowStr } from './storage.js';
import { msgText } from '../core/messages.js';

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
const $ = (id) => document.getElementById(id);

// Цвета образцов. id — ключ ткани в ядре (profiles.json → pvc.colors / mesh); без SKU ядро предупредит.
// Основная ткань PVC 1100 г/м² — PVC-0.8-<цвет>; сетка — только жёлтая, запаянная в прозрачный жёлтый ПВХ (PVCM-1.0-yellow), Alex 25.11.
const MESH_COLORS = [['Transparent yellow', '#e9cf5c', 'เหลืองใส', 'yellow']];
const pal = () => (S.fabric === 'mesh' ? MESH_COLORS : COLORS);
const COLORS = [['Blue', '#1f5fa8', 'น้ำเงิน', 'blue'], ['Orange', '#e8711f', 'ส้ม', 'orange'], ['Yellow', '#f2c230', 'เหลือง', 'yellow'],
  ['Red', '#c62828', 'แดง', 'red'], ['Green', '#2e7d32', 'เขียว', 'green'], ['Grey', '#7d868f', 'เทา', 'grey'], ['White', '#eef0f2', 'ขาว', 'white']];

// Аксессуары из каталога (названия Zoho). Тип «Other» — свободный текст только для бланка, в расчёт не идёт.
const TYPE_LABEL = { push_button: 'Push button', pull_cord: 'Pull-cord switch', radar: 'Radar', loop: 'Induction loop', other: 'Other' };
const TH = { 'Push button': 'ปุ่มกด', 'Pull-cord switch': 'สวิตช์ดึง', Radar: 'เรดาร์', 'Induction loop': 'ลูปแม่เหล็ก', Other: 'อื่นๆ' };
const ITEM = new Map(CAT.items.items.map((i) => [i.sku, i]));
const ACC_MODELS = {};
for (const t of CAT.accessories.types) {
  ACC_MODELS[t.type] = t.models.map((m) => ({
    sku: m.sku, available: m.available,
    label: m.sku ? `${m.id === m.sku ? m.sku : m.id + (t.type === 'push_button' ? ' button' + (m.id === '1' ? '' : 's') : '')} · ${ITEM.get(m.sku).zohoName}`
      : `${m.id} buttons · not available yet (no SKU)`,
    short: m.sku || m.id,
  }));
}
ACC_MODELS.other = [{ sku: null, available: true, label: '', short: '' }];

const S = {
  id: '', revision: 1, W: 2000, H: 2600, qty: 1, color: 0, fabric: 'pvc', extra: 0, layout: null,
  visionAuto: true, vision: new Set([2]), motor: 'L', ctrl: 'L', ctrlH: 1200,
  acc: [],
  guide: 'alu', supply: 'outsourced',
  boxH: 270, boxD: 235, coverH: 370, guideW: 130, guideD: 90, sideMotor: 350, sideFree: 180,
  overrides: [], loadedOrder: null,
  formId: null, created: null, frozen: false, dirty: false,
};
let RESULT = null; let DOC = null; let LOADING = true;
const I18N = {
 en:{ title:'SDA · new order', sub:'Mockup of the manager form. Customer data is filled automatically on the real server.', order:'Order', so:'Sales order number', load:'Load from Zoho',
  soHint:'Customer and addresses are pulled from the SO', cust:'Customer', addr:'Delivery address', addrHint:'If the SO has no shipping address, the billing address is used',
  ref:'Reference / door location', door:'Door', W:'Opening width W, mm', H:'Opening height H, mm', qty:'Quantity', frame:'Frame material',
  frameAlu:'Aluminium guide rails + Galvanised top cover', frameSS:'SS304 guide rails + SS304 top cover', supply:'Supply', own:'Own production · SDA-DS', out:'Ordered outside · SDA',
  sections:'Sections', auto:'auto', colour:'Curtain colour', acc:'Accessories', type:'Type', model:'Model', qtyH:'Qty', add:'+ Add accessory',
  stdHint:'Standard set (photocells, wireless bottom safety edge) is included automatically and is not listed here.',
  pic:'Front view, from inside · tick the options on the picture', leg1:'☐ next to a section: transparent section', leg2:'☐ left / right of the top box: drive side',
  leg3:'☐ left / right at the controller height: control box side', saveHint:'“Save calculation” freezes this block for the manager. Below is the approval sheet that the customer signs (always EN + TH).',
  save:'Save calculation', print:'Print / PDF', cbT:'transparent', cbD:'drive', cbC:'control',
  shStd:'standard layout for this height', shMan:(n,r)=>`manual, +${n} wind bar (standard ${r})`,
  warn:(w,h,a)=>`Not available: ${w} × ${h} = ${a} m². Doors over 28 m² are not produced: no allowed motor in the Powever catalogue. Reduce the size or ask the engineer.`,
  types:{'Push button':'Push button','Pull-cord switch':'Pull-cord switch','Radar':'Radar','Induction loop':'Induction loop','Other':'Other'} },
 th:{ title:'SDA · คำสั่งซื้อใหม่', sub:'แบบจำลองฟอร์มสำหรับฝ่ายขาย ข้อมูลลูกค้าจะถูกดึงอัตโนมัติบนเซิร์ฟเวอร์จริง', order:'คำสั่งซื้อ', so:'เลขที่ใบสั่งขาย', load:'โหลดจาก Zoho',
  soHint:'ดึงข้อมูลลูกค้าและที่อยู่จากใบสั่งขาย', cust:'ลูกค้า', addr:'ที่อยู่จัดส่ง', addrHint:'หากใบสั่งขายไม่มีที่อยู่จัดส่ง จะใช้ที่อยู่ออกใบแจ้งหนี้',
  ref:'อ้างอิง / ตำแหน่งประตู', door:'ประตู', W:'ความกว้างช่องเปิด W, มม.', H:'ความสูงช่องเปิด H, มม.', qty:'จำนวน', frame:'วัสดุโครง',
  frameAlu:'รางอลูมิเนียม + ฝาครอบเหล็กชุบสังกะสี', frameSS:'รางสแตนเลส SS304 + ฝาครอบสแตนเลส SS304', supply:'การผลิต', own:'ผลิตเอง · SDA-DS', out:'สั่งจากภายนอก · SDA',
  sections:'จำนวนเซกชัน', auto:'อัตโนมัติ', colour:'สีม่าน', acc:'อุปกรณ์เสริม', type:'ประเภท', model:'รุ่น', qtyH:'จำนวน', add:'+ เพิ่มอุปกรณ์',
  stdHint:'ชุดมาตรฐาน (โฟโต้เซลล์ และขอบนิรภัยด้านล่างแบบไร้สาย) รวมอยู่แล้วโดยอัตโนมัติ ไม่ต้องเพิ่มในรายการ',
  pic:'ภาพด้านหน้า มองจากด้านใน · ติ๊กตัวเลือกบนภาพ', leg1:'☐ ที่เซกชัน: เซกชันใส', leg2:'☐ ซ้าย / ขวา ของกล่องด้านบน: ด้านมอเตอร์',
  leg3:'☐ ซ้าย / ขวา ที่ระดับตู้ควบคุม: ด้านตู้ควบคุม', saveHint:'“บันทึกการคำนวณ” จะล็อกข้อมูลส่วนนี้ ด้านล่างคือแบบอนุมัติที่ลูกค้าลงนาม (สองภาษาเสมอ)',
  save:'บันทึกการคำนวณ', print:'พิมพ์ / PDF', cbT:'ใส', cbD:'มอเตอร์', cbC:'ตู้ควบคุม',
  shStd:'การแบ่งมาตรฐานสำหรับความสูงนี้', shMan:(n,r)=>`กำหนดเอง, +${n} โปรไฟล์ (มาตรฐาน ${r})`,
  warn:(w,h,a)=>`ไม่สามารถผลิตได้: ${w} × ${h} = ${a} ม² ประตูที่ใหญ่กว่า 28 ม² ไม่ผลิต เนื่องจากไม่มีมอเตอร์ที่อนุญาตในแคตตาล็อก Powever กรุณาลดขนาดหรือปรึกษาวิศวกร`,
  types:{'Push button':'ปุ่มกด','Pull-cord switch':'สวิตช์ดึง','Radar':'เรดาร์','Induction loop':'ลูปแม่เหล็ก','Other':'อื่นๆ'} } };
// Дополнительные подписи формы (к словарю макета)
Object.assign(I18N.en, {
  sub: 'Order form on the calculation core. Customer data will be pulled from Zoho on the server.',
  fabric: 'Curtain fabric', fabPvc: 'PVC fabric 1100 g/m²', fabMesh: 'PVC mesh fabric (transparent yellow)', ctrlH: 'Control box height, mm',
  open: 'Open order…', save: 'Save order (JSON)', spec: 'Specification and Zoho assembly · engineer', asm: 'Composite item',
  bun: 'Assembly number', asmDate: 'Assembly date', csv: 'Export CSV for Zoho', secH: 'Section', nameH: 'Zoho name',
  perDoor: 'Per door', unitH: 'Unit', total: 'Total', ruleH: 'Rule', outsourced: 'Ordered outside (SDA): no assembly in Zoho.',
  notes: 'Notes from the calculation', sec: { curtain: 'Curtain', header: 'Box & shaft', guides: 'Guides', drive: 'Drive' },
});
Object.assign(I18N.th, {
  sub: 'ฟอร์มคำสั่งซื้อบนแกนคำนวณ ข้อมูลลูกค้าจะดึงจาก Zoho บนเซิร์ฟเวอร์',
  fabric: 'ผ้าม่าน', fabPvc: 'ผ้า PVC 1100 g/m²', fabMesh: 'ผ้าตาข่าย PVC (เหลืองใส)', ctrlH: 'ความสูงตู้ควบคุม, มม.',
  open: 'เปิดคำสั่งซื้อ…', save: 'บันทึกคำสั่งซื้อ (JSON)', spec: 'รายการวัสดุและการประกอบใน Zoho · วิศวกร', asm: 'สินค้าประกอบ',
  bun: 'เลขที่การประกอบ', asmDate: 'วันที่ประกอบ', csv: 'ส่งออก CSV สำหรับ Zoho', secH: 'หมวด', nameH: 'ชื่อใน Zoho',
  perDoor: 'ต่อประตู', unitH: 'หน่วย', total: 'รวม', ruleH: 'กฎ', outsourced: 'สั่งจากภายนอก (SDA): ไม่มีการประกอบใน Zoho',
  notes: 'หมายเหตุจากการคำนวณ', sec: { curtain: 'ม่าน', header: 'กล่องและเพลา', guides: 'ราง', drive: 'มอเตอร์' },
});
// Справочник форм и сохранение (тред «Сделать справочник форм заказа», 26.11)
Object.assign(I18N.en, {
  ownHint: 'Unticked: SDA ordered outside', savedBtn: 'Saved ✓', saving: 'Saving…', saveErr: (m) => `Not saved: ${m}`, forms: '← Order forms', newOrder: 'new order', open: 'Open order JSON…', dl: 'Download JSON', save: 'Save',
  saveHint: '“Save” keeps the form in Order forms as a draft; you can change and save it again until the engineer creates the specification with this number. Below is the approval sheet that the customer signs (always EN + TH).',
  whyFrozen: 'frozen: the specification exists', whyBlocked: 'fix the size to save', whyNoId: 'enter the sales order number (DSO-…) to save',
  frozen: (id, href) => `🔒 Frozen: the specification <a href="${href}">${id}</a> has been created from this form, so the form is read-only. To change the order, the engineer deletes the specification in Specifications; then the form becomes a draft again.`,
  saved: (id, where) => `Saved ${id} to Order forms${where}.`, inFolder: (n) => ` (folder ${n})`,
  noFolder: ' — this browser only: choose the working folder so that the engineer sees the form',
  folderNone: 'Working folder is not selected: the form is saved in this browser only. Choose «Door calculation tool» so that the engineer sees it in Specifications.',
  folderRe: (n) => `The browser needs permission for the working folder «${n}».`, allow: 'Allow',
  notFound: (id) => `Order form ${id} not found in the working folder.`,
  takenSpec: (id) => `Specification ${id} already exists, so this number is taken. Check the order number.`,
  takenForm: (id) => `Order form ${id} already exists. Open it from Order forms or change the number.`,
  renamed: (a, b) => `The number changed from ${a} to ${b}. Save the form as ${b} and remove ${a}?`,
  fsOk: (n) => `Folder: ${n} ✓`, fsRe: (n) => `Reconnect folder (${n})`, fsNo: 'Choose working folder', fsUns: 'Browser: no folder access',
});
Object.assign(I18N.th, {
  ownHint: 'ไม่ติ๊ก: SDA สั่งจากภายนอก', savedBtn: 'บันทึกแล้ว ✓', saving: 'กำลังบันทึก…', saveErr: (m) => `บันทึกไม่สำเร็จ: ${m}`, forms: '← ฟอร์มคำสั่งซื้อ', newOrder: 'คำสั่งซื้อใหม่', open: 'เปิด JSON คำสั่งซื้อ…', dl: 'ดาวน์โหลด JSON', save: 'บันทึก',
  saveHint: '“บันทึก” จะเก็บฟอร์มเป็นฉบับร่างในรายการฟอร์มคำสั่งซื้อ แก้ไขและบันทึกซ้ำได้จนกว่าวิศวกรจะสร้างสเปคเลขเดียวกัน ด้านล่างคือแบบอนุมัติที่ลูกค้าลงนาม (สองภาษาเสมอ)',
  whyFrozen: 'ล็อกแล้ว: มีสเปคแล้ว', whyBlocked: 'แก้ขนาดก่อนบันทึก', whyNoId: 'ใส่เลขที่ใบสั่งขาย (DSO-…) เพื่อบันทึก',
  frozen: (id, href) => `🔒 ล็อกแล้ว: สร้างสเปค <a href="${href}">${id}</a> จากฟอร์มนี้แล้ว ฟอร์มจึงดูได้อย่างเดียว หากต้องการแก้คำสั่งซื้อ วิศวกรต้องลบสเปคในรายการสเปค แล้วฟอร์มจะกลับเป็นฉบับร่าง`,
  saved: (id, where) => `บันทึก ${id} ในรายการฟอร์มคำสั่งซื้อแล้ว${where}`, inFolder: (n) => ` (โฟลเดอร์ ${n})`,
  noFolder: ' — เฉพาะเบราว์เซอร์นี้: เลือกโฟลเดอร์ทำงานเพื่อให้วิศวกรเห็นฟอร์ม',
  folderNone: 'ยังไม่ได้เลือกโฟลเดอร์ทำงาน: ฟอร์มจะถูกบันทึกในเบราว์เซอร์นี้เท่านั้น เลือก «Door calculation tool» เพื่อให้วิศวกรเห็นในรายการสเปค',
  folderRe: (n) => `เบราว์เซอร์ต้องการสิทธิ์เข้าถึงโฟลเดอร์ «${n}»`, allow: 'อนุญาต',
  notFound: (id) => `ไม่พบฟอร์มคำสั่งซื้อ ${id} ในโฟลเดอร์ทำงาน`,
  takenSpec: (id) => `มีสเปค ${id} แล้ว เลขนี้ถูกใช้แล้ว กรุณาตรวจสอบเลขที่คำสั่งซื้อ`,
  takenForm: (id) => `มีฟอร์มคำสั่งซื้อ ${id} แล้ว เปิดจากรายการฟอร์ม หรือเปลี่ยนเลข`,
  renamed: (a, b) => `เลขเปลี่ยนจาก ${a} เป็น ${b} บันทึกฟอร์มเป็น ${b} และลบ ${a}?`,
  fsOk: (n) => `โฟลเดอร์: ${n} ✓`, fsRe: (n) => `เชื่อมต่อโฟลเดอร์ใหม่ (${n})`, fsNo: 'เลือกโฟลเดอร์ทำงาน', fsUns: 'เบราว์เซอร์: ไม่รองรับโฟลเดอร์',
});
let LANG = 'en';
try { LANG = new URLSearchParams(location.search).get('lang') || localStorage.getItem('dh.lang') || 'en'; } catch (e) { /* без хранилища */ }
if (!I18N[LANG]) LANG = 'en';
const T = (k) => (I18N[LANG] || I18N.en)[k];
function applyLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i]').forEach((e) => { const v = T(e.dataset.i); if (typeof v === 'string') e.textContent = v; });
  document.querySelectorAll('.langsw button').forEach((b) => b.classList.toggle('on', b.dataset.lang === LANG));
}
document.querySelectorAll('.langsw button').forEach((b) => b.onclick = () => { LANG = b.dataset.lang; try { localStorage.setItem('dh.lang', LANG); } catch (e) { /* */ }
  const u = new URL(location.href); u.searchParams.set('lang', LANG); history.replaceState(null, '', u);
  applyLang(); fsUi(); update(); if (S.frozen) setFrozen(true); });

const NS='http://www.w3.org/2000/svg';
function el(tag,a,p){ const e=document.createElementNS(NS,tag); for(const k in a) e.setAttribute(k,a[k]); p.appendChild(e); return e; }
function txt(p,x,y,s,a={}){ const t=el('text',{x,y,...a},p); t.textContent=s; return t; }
const DIM='#b0127a', LVL='#e8963a';
function hdim(p,x1,x2,y,label,e0){ const g=el('g',{stroke:DIM,'stroke-width':7,fill:'none'},p);
  if(e0!==undefined){ const d=y>e0?40:-40; el('line',{x1,y1:e0,x2:x1,y2:y+d},g); el('line',{x1:x2,y1:e0,x2,y2:y+d},g); }
  el('line',{x1,y1:y,x2,y2:y,'marker-start':`url(#${DP}ar)`,'marker-end':`url(#${DP}ar)`},g);
  txt(p,(x1+x2)/2,y-25,label,{'text-anchor':'middle',fill:DIM,'font-size':105}); }
function vdim(p,x,y1,y2,label,e0){ const g=el('g',{stroke:DIM,'stroke-width':7,fill:'none'},p);
  if(e0!==undefined){ const d=x>e0?40:-40; el('line',{x1:e0,y1,x2:x+d,y2:y1},g); el('line',{x1:e0,y1:y2,x2:x+d,y2},g); }
  el('line',{x1:x,y1,x2:x,y2,'marker-start':`url(#${DP}ar)`,'marker-end':`url(#${DP}ar)`},g);
  const cy=(y1+y2)/2; txt(p,x-25,cy,label,{'text-anchor':'middle',fill:DIM,'font-size':105,transform:`rotate(-90 ${x-25} ${cy})`}); }

// id градиентов уникальны для каждого svg: в печати скрытый эскиз формы (display:none) не отдаёт свои градиенты бланку,
// и окно с рамой печатались без заливки (Alex 27.11, ч/б бланк).
let DP = '';
function defs(svg, pvc){
  DP = (svg.id || 'svg') + '-';
  const d=el('defs',{},svg);
  d.innerHTML=`<marker id="${DP}ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="60" markerHeight="60" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 2.5 L10 5 L0 7.5z" fill="${DIM}"/></marker>
  <linearGradient id="${DP}alu" x1="0" x2="1"><stop offset="0" stop-color="#aeb5bd"/><stop offset=".35" stop-color="#f3f5f7"/><stop offset=".7" stop-color="#c3c9cf"/><stop offset="1" stop-color="#8f979f"/></linearGradient>
  <linearGradient id="${DP}aluh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f3f5"/><stop offset=".5" stop-color="#c0c6cc"/><stop offset="1" stop-color="#8e969e"/></linearGradient>
  <linearGradient id="${DP}hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef1f3"/><stop offset=".55" stop-color="#d3d8dd"/><stop offset="1" stop-color="#aeb5bc"/></linearGradient>
  <linearGradient id="${DP}hoodv" x1="0" x2="1"><stop offset="0" stop-color="#b9c0c7"/><stop offset=".4" stop-color="#e9ecef"/><stop offset="1" stop-color="#aab1b8"/></linearGradient>
  <linearGradient id="${DP}sheen" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity=".02"/><stop offset=".8" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".08"/></linearGradient>
  <linearGradient id="${DP}glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef7fd"/><stop offset=".5" stop-color="#d3e9f6"/><stop offset="1" stop-color="#b9d9ec"/></linearGradient>
  <linearGradient id="${DP}ss" x1="0" x2="1"><stop offset="0" stop-color="#9da6ae"/><stop offset=".25" stop-color="#e8edf1"/><stop offset=".5" stop-color="#b4bcc4"/><stop offset=".75" stop-color="#f4f7f9"/><stop offset="1" stop-color="#8d969f"/></linearGradient>
  <pattern id="${DP}floor" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="60" stroke="#8a929b" stroke-width="7"/></pattern>
  <pattern id="${DP}mesh" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M0 0H70M0 0V70" stroke="#b8961c" stroke-opacity=".55" stroke-width="5" fill="none"/></pattern>
  <pattern id="${DP}sand" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="3.5" fill="#9aa3ad"/><circle cx="30" cy="30" r="3.5" fill="#9aa3ad"/></pattern>`;
}

function checkbox(p,x,y,on,cb,label,anchor,lc){
  const g=el('g',{style:'cursor:pointer'},p);
  el('rect',{x:x-75,y:y-75,width:150,height:150,rx:22,fill:on?'#1f5fa8':'#fff',stroke:'#1f5fa8','stroke-width':14},g);
  if(on) el('path',{d:`M${x-42} ${y} l30 32 l55 -62`,fill:'none',stroke:'#fff','stroke-width':22,'stroke-linecap':'round','stroke-linejoin':'round'},g);
  if(label) txt(g,anchor==='end'?x-105:x+105,y+35,label,{'font-size':95,fill:lc||'#1f5fa8','text-anchor':anchor||'start'});
  g.addEventListener('click',cb);
}

// Draws front view (+ section on the sheet). mode: 'form' | 'sheet'
function draw(svg, mode){
  svg.innerHTML='';
  const {W,H,boxH,boxD,guideW,guideD}=S, pvc=pal()[S.color][1];
  defs(svg,pvc);
  const left = S.motor==='L'?S.sideMotor:S.sideFree, right = S.motor==='L'?S.sideFree:S.sideMotor;
  const a=0, xL=a-left, xR=a+W+right, GT=H+200, top=-(GT+boxH);   // columns stand 200 above the opening, box on top (thread 03)
  const gap = Math.max(900, W*0.35);
  const XS = xR + gap;                       // section view
  const L=S.layout, n=L.secs.length;
  const yb=[0]; L.secs.forEach((h,i)=>yb.push(yb[i]+h+(i<n-1?40:0)));   // section bottoms, 40 = wind bar
  yb[n]=GT;

  if(mode==='form'){
    svg.setAttribute('viewBox',`${xL-1100} ${top-250} ${(xR-xL)+2200} ${-top+700}`);
  } else {
    // centre both views: total = front + gap + section(+dims)
    const x0=xL-700-(S.ctrl==='L'?290:0), x1=XS+boxD+1250;
    svg.setAttribute('viewBox',`${x0} ${top-760} ${x1-x0} ${-top+1230}`);
  }
  svg.setAttribute('font-family','Arial, Loma, sans-serif');
  const g=el('g',{},svg);

  // levels (sheet)
  if(mode==='sheet'){
    const xe=XS+boxD+1150;
    [[top,'Top level','ระดับบนสุด'],[-H,'Opening level','ระดับช่องเปิด'],[0,'Floor level','ระดับพื้น']].forEach(([y,l,t])=>{
      el('line',{x1:xL-550,y1:y,x2:xe,y2:y,stroke:LVL,'stroke-width':6,'stroke-dasharray':'60 40'},g);
      txt(g,xe-10,y-20,l,{'font-size':85,fill:'#444','text-anchor':'end'}); txt(g,xe-10,y+85,t,{'font-size':75,fill:'#777','text-anchor':'end'});
    });
  }
  // floor
  el('rect',{x:xL-300,y:0,width:(xR-xL)+600,height:70,fill:`url(#${DP}floor)`},g);
  el('line',{x1:xL-300,y1:0,x2:xR+300,y2:0,stroke:'#1b1f24','stroke-width':14},g);
  // curtain
  el('rect',{x:a,y:-GT,width:W,height:GT,fill:pvc},g);
  if(S.fabric==='mesh') el('rect',{x:a,y:-GT,width:W,height:GT,fill:`url(#${DP}mesh)`},g); // сетка в прозрачном жёлтом ПВХ
  el('rect',{x:a,y:-GT,width:W,height:GT,fill:`url(#${DP}sheen)`},g);
  // transparent sections (whole section between profiles)
  for(let i=1;i<=n;i++){ if(!S.vision.has(i)) continue;
    // окно на всё поле секции: по ширине между направляющими и по высоте между профилями, без полосок ткани (Alex 27.11)
    const y0=yb[i-1]+(i>1?20:0), y1=yb[i]-(i<n?20:0), m=0;
    const px=a, pw=W, py=-(y1-m), ph=(y1-y0)-2*m - (i===1?60:0);
    el('rect',{x:px,y:py,width:pw,height:ph,fill:`url(#${DP}glass)`},g);
    el('line',{x1:px,y1:py,x2:px+pw,y2:py,stroke:'#7fa9c4','stroke-width':6},g);
    el('line',{x1:px,y1:py+ph,x2:px+pw,y2:py+ph,stroke:'#7fa9c4','stroke-width':6},g);
    const k=Math.max(2,Math.round(pw/500));
    for(let j=0;j<k;j++){ const rx=px+pw*(j+0.55)/k;
      el('line',{x1:rx-60,y1:py+ph*0.42,x2:rx+80,y2:py+ph*0.28,stroke:'#fff','stroke-width':12,opacity:.9},g);
      el('line',{x1:rx-90,y1:py+ph*0.66,x2:rx+100,y2:py+ph*0.48,stroke:'#fff','stroke-width':9,opacity:.8},g); }
  }
  // wind struts between sections
  for(let i=1;i<n;i++){ const y=-(yb[i]-20); el('rect',{x:a-guideW+20,y:y-22,width:W+2*guideW-40,height:44,fill:`url(#${DP}aluh)`,stroke:'#6f7780','stroke-width':4},g); }
  // bottom profile + seal
  el('rect',{x:a,y:-85,width:W,height:60,fill:`url(#${DP}aluh)`,stroke:'#6f7780','stroke-width':4},g);
  el('rect',{x:a+10,y:-25,width:W-20,height:25,fill:'#22262b'},g);
  // guides with photocells
  [a-guideW, a+W].forEach(gx=>{
    el('rect',{x:gx,y:-GT,width:guideW,height:GT,fill:S.guide==='ss'?`url(#${DP}ss)`:`url(#${DP}alu)`,stroke:'#59616a','stroke-width':6},g);
    el('line',{x1:gx+guideW/2,y1:-GT+40,x2:gx+guideW/2,y2:-10,stroke:'#7d858d','stroke-width':5},g);
    el('rect',{x:gx+25,y:-380,width:70,height:90,rx:10,fill:'#1b1f24'},g); el('circle',{cx:gx+60,cy:-335,r:16,fill:'#e33'},g);
  });
  // top box
  const ext=(S.guide==='ss'?184:230)/2, bx0=a-ext, bx1=a+W+ext;   // box length W+230 alu / W+184 ss
  el('rect',{x:bx0,y:top,width:bx1-bx0,height:boxH,fill:`url(#${DP}hood)`,stroke:'#59616a','stroke-width':8},g);
  el('line',{x1:bx0,y1:top+boxH*0.72,x2:bx1,y2:top+boxH*0.72,stroke:'#9aa2aa','stroke-width':6},g);
  for(let x=bx0+120;x<bx1-60;x+=600) el('circle',{cx:x,cy:top+60,r:11,fill:'#7d858d'},g);
  txt(g,(bx0+bx1)/2,top+boxH*0.47,'DOORHAN SIAM',{'text-anchor':'middle','font-size':Math.min(110,W/18),'font-weight':700,fill:'#56606a','letter-spacing':8});
  // end plate on free side, drive cover on motor side (same finish as the box)
  const freeX = S.motor==='L' ? bx1 : bx0-30;
  el('rect',{x:freeX,y:top-10,width:30,height:boxH+20,fill:'#8e969e'},g);
  const mx = S.motor==='L' ? xL : bx1+5, mw = S.motor==='L' ? bx0-5-xL : xR-(bx1+5);
  el('rect',{x:mx,y:top-30,width:mw,height:S.coverH,rx:30,fill:`url(#${DP}hoodv)`,stroke:'#59616a','stroke-width':8},g);
  el('line',{x1:mx+20,y1:top+boxH*0.72,x2:mx+mw-20,y2:top+boxH*0.72,stroke:'#9aa2aa','stroke-width':6},g);
  for(let i=0;i<4;i++) el('rect',{x:mx+mw*0.25,y:top+30+i*55,width:mw*0.5,height:16,rx:8,fill:'#8e969e'},g);
  // controller
  const cw=230, ch=430, cxB = S.ctrl==='L' ? xL-cw-60 : xR+60, cyB=-(S.ctrlH+ch);
  el('rect',{x:cxB,y:cyB,width:cw,height:ch,rx:16,fill:'#f4f5f6',stroke:'#2b3036','stroke-width':8},g);
  el('rect',{x:cxB+45,y:cyB+50,width:140,height:80,fill:'#3d4a57'},g);
  el('circle',{cx:cxB+75,cy:cyB+230,r:26,fill:'#2e9a46'},g); el('circle',{cx:cxB+155,cy:cyB+230,r:26,fill:'#c62828'},g);
  el('circle',{cx:cxB+115,cy:cyB+335,r:30,fill:'#e0a800',stroke:'#7a5c00','stroke-width':6},g);
  const mcx = mx+mw/2;
  el('path',{d:`M${cxB+cw/2} ${cyB} V${top+boxH+260} H${mcx} V${top+boxH+140}`,fill:'none',stroke:'#2b3036','stroke-width':12},g);

  if(mode==='form'){
    // section checkboxes (right of the door)
    for(let i=1;i<=n;i++){ const cy=-Math.min((yb[i-1]+yb[i])/2, yb[i-1]+450);
      checkbox(g, a+W-170, cy, S.vision.has(i), ()=>{ S.visionAuto=false; S.vision.has(i)?S.vision.delete(i):S.vision.add(i); update(); }, T('cbT'), 'end', S.vision.has(i)?'#1f5fa8':'#fff'); }
    // drive side
    checkbox(g, xL-380, top+boxH/2, S.motor==='L', ()=>{ S.motor='L'; update(); }, T('cbD'), 'end');
    checkbox(g, xR+380, top+boxH/2, S.motor==='R', ()=>{ S.motor='R'; update(); }, T('cbD'));
    // controller side (at its height)
    const cyc = cyB+ch/2;
    checkbox(g, xL-60-cw/2, cyB-200, S.ctrl==='L', ()=>{ S.ctrl='L'; update(); }, T('cbC'), 'end');
    checkbox(g, xR+60+cw/2, cyB-200, S.ctrl==='R', ()=>{ S.ctrl='R'; update(); }, T('cbC'));
    hdim(g,a,a+W,300,`W ${W}`,20); txt(g,(xL+xR)/2,top-120,'',{});
    return;
  }

  // ---- sheet dimensions ----
  hdim(g,a,a+W,330,String(W),20);
  hdim(g,xL,xR,top-330,String(xR-xL),top-40);
  hdim(g,xL,a,top-140,String(left),top-40); hdim(g,a+W,xR,top-140,String(right),top-40);
  const dl = (S.ctrl==='L') ? cxB-170 : xL-170;
  vdim(g, xL-420 + (S.ctrl==='L'?-cw-60:0), top, 0, String(GT+boxH), xL-20);
  vdim(g, xL-170 + (S.ctrl==='L'?-cw-60:0), -H, 0, String(H), a-guideW-20);
  const cdx = S.ctrl==='L' ? cxB+cw+90 : cxB-90;
  vdim(g, cdx, cyB+ch, 0, String(S.ctrlH), S.ctrl==='L'?cxB+cw:cxB);

  // section view
  el('rect',{x:XS-100,y:top-150,width:100,height:GT+boxH+150-H,fill:`url(#${DP}sand)`,stroke:'#1b1f24','stroke-width':8},g);
  el('rect',{x:XS-300,y:0,width:boxD+600,height:70,fill:`url(#${DP}floor)`},g);
  el('line',{x1:XS-300,y1:0,x2:XS+boxD+300,y2:0,stroke:'#1b1f24','stroke-width':14},g);
  el('rect',{x:XS,y:-GT,width:guideD,height:GT,fill:S.guide==='ss'?`url(#${DP}ss)`:`url(#${DP}alu)`,stroke:'#59616a','stroke-width':6},g);
  el('line',{x1:XS+guideD/2,y1:-H,x2:XS+guideD/2,y2:-60,stroke:pvc,'stroke-width':14},g);
  const c=40;
  el('path',{d:`M${XS} ${top} H${XS+boxD-c} L${XS+boxD} ${top+c} V${top+boxH-c} L${XS+boxD-c} ${top+boxH} H${XS} Z`,fill:`url(#${DP}hood)`,stroke:'#1b1f24','stroke-width':8},g);
  el('circle',{cx:XS+boxD*0.45,cy:top+boxH*0.48,r:Math.min(boxD,boxH)*0.3,fill:pvc,stroke:'#1b1f24','stroke-width':6},g);
  el('circle',{cx:XS+boxD*0.45,cy:top+boxH*0.48,r:28,fill:'#d7dbe0',stroke:'#1b1f24','stroke-width':5},g);
  hdim(g,XS,XS+boxD,top-140,String(boxD),top-40);
  vdim(g,XS+boxD+200,top,-H,String(GT+boxH-H),XS+boxD+20);
  hdim(g,XS,XS+guideD,330,String(guideD),20);
  txt(g,XS-140,-H/2,'outside',{'text-anchor':'end','font-size':90,fill:'#666'}); txt(g,XS+guideD+70,-H/2,'inside',{'font-size':90,fill:'#666'});
  txt(g,(xL+xR)/2,top-560,'VIEW FROM INSIDE · มุมมองจากด้านใน',{'text-anchor':'middle','font-size':110,'font-weight':700,fill:'#333'});
  txt(g,XS+boxD/2,top-560,'SECTION · ภาพตัด',{'text-anchor':'middle','font-size':110,'font-weight':700,fill:'#333'});
}

// ── Объект заказа из полей формы (схема v1) ─────────────────
function buildDoc() {
  const accessories = S.acc.filter((r) => r.t !== 'other').map((r) => ({ type: r.t, sku: r.sku, qty: r.q }));
  const o = {
    model: 'SDA', supply: S.supply, frameMaterial: S.guide === 'ss' ? 'ss304' : 'alu-galv',
    pvc: (S.fabric === 'mesh' ? 'mesh-' : '') + pal()[S.color][3],
    driveSide: S.motor, controlSide: S.ctrl, controlBoxHeight: S.ctrlH,
    sections: { extraWindbars: S.extra }, accessories, overrides: S.overrides,
  };
  if (!S.visionAuto) o.transparentSections = [...S.vision].sort((a, b) => a - b);
  const base = S.loadedOrder ? structuredClone(S.loadedOrder) : {};
  return {
    ...base,
    schemaVersion: '1.0', productType: 'hsr', id: S.id, revision: S.revision,
    order: { ...(base.order || {}), salesorderNumber: (parseSo($('so').value) || {}).so || $('so').value.trim(), salesorderItem: (parseSo($('so').value) || {}).item ?? null, customer: { ...((base.order || {}).customer || {}), name: $('cust').value },
      deliveryAddress: $('addr').value, reference: $('ref').value,
      notes: S.acc.filter((r) => r.t === 'other' && r.text).map((r) => `${r.text} × ${r.q}`).join('; ') || (base.order || {}).notes || '' },
    opening: { ...(base.opening || {}), width: S.W, height: S.H, quantity: S.qty },
    options: { ...(base.options || {}), ...o },
  };
}

/** Номер формы = DSO из Zoho; номер изделия добавляется, только если в заказе разные изделия (Alex 25.11): DSO-26659 / DSO-26659-2. */
function parseSo(v) {
  const m = /^\s*(?:DSO-?)?\s*(\d+)(?:\s*[-/]\s*(\d+))?\s*$/i.exec(v || '');
  if (!m) return null;
  const item = m[2] ? +m[2] : null;
  return { so: `DSO-${m[1]}`, item, id: `DSO-${m[1]}${item ? '-' + item : ''}` };
}
function idFromSo() { const p = parseSo($('so').value); return p ? p.id : ''; }

// ── Отрисовка ────────────────────────────────────────────────
function renderAcc() {
  const tb = $('acc'); tb.innerHTML = '';
  S.acc.forEach((r, i) => {
    const tr = document.createElement('tr');
    const models = ACC_MODELS[r.t];
    tr.innerHTML = `<td><select>${Object.keys(TYPE_LABEL).map((t) => `<option value="${t}" ${t === r.t ? 'selected' : ''}>${T('types')[TYPE_LABEL[t]]}</option>`).join('')}</select></td>
      <td>${r.t === 'other' ? `<input value="${(r.text || '').replace(/"/g, '&quot;')}">` : `<select>${models.map((m, k) => `<option value="${k}" ${m.sku === r.sku ? 'selected' : ''} ${m.available ? '' : 'disabled style="color:#c62828"'}>${m.label}</option>`).join('')}</select>`}</td>
      <td><div class="qty"><button class="btn s">−</button><input value="${r.q}"><button class="btn s">+</button></div></td>
      <td><button class="btn s" title="Remove">×</button></td>`;
    tr.querySelector('td:first-child select').onchange = (e) => { r.t = e.target.value; const m = ACC_MODELS[r.t].find((x) => x.available); r.sku = m.sku; update(); };
    tr.querySelector('td:nth-child(2) > *').onchange = (e) => { if (r.t === 'other') r.text = e.target.value; else r.sku = models[+e.target.value].sku; update(); };
    const [bm, inp, bp] = tr.querySelectorAll('.qty > *');
    bm.onclick = () => { r.q = Math.max(1, r.q - 1); update(); }; bp.onclick = () => { r.q++; update(); };
    inp.onchange = (e) => { r.q = Math.max(1, parseInt(e.target.value, 10) || 1); update(); };
    tr.querySelector('td:last-child button').onclick = () => { S.acc.splice(i, 1); update(); };
    tb.appendChild(tr);
  });
}

function renderColors() {
  const sw = $('sw'); sw.innerHTML = '';
  pal().forEach(([n, c], i) => { const b = document.createElement('button'); b.style.background = c; b.title = n; if (i === S.color) b.className = 'on'; b.onclick = () => { S.color = i; update(); }; sw.appendChild(b); });
}

function renderSheetText(calc) {
  const c = pal()[S.color];
  const n = calc.curtain ? calc.curtain.sections.length : 0;
  const vis = calc.curtain ? calc.curtain.sections.filter((s) => s.transparent).length : 0;
  const drv = calc.drive ? `Servo motor ${calc.drive.powerKw} kW 220 V · control unit A2` : '—';
  const rows = [
    ['Model', 'รุ่น', 'High speed roll-up PVC door with wind struts'],
    ['Curtain', 'ม่าน', `${S.fabric === 'mesh' ? 'PVC mesh fabric sealed in transparent yellow PVC' : `Coated PVC fabric 1100 g/m², ${c[0].toLowerCase()}`} · ${n} sections`],
    ['Transparent sections', 'ช่องใส', vis ? `${vis} of ${n}` : 'none'],
    ['Frame', 'วัสดุโครง', S.guide === 'ss' ? 'SS304 guide rails + SS304 top cover' : 'Aluminium guide rails + galvanised top cover'],
    ['Drive · control', 'มอเตอร์ · ตู้ควบคุม', drv],
    ['Safety (standard)', 'อุปกรณ์นิรภัย', 'IR photocells, wireless bottom safety edge'],
    ['Speed', 'ความเร็ว', 'open up to 1.2 m/s · close up to 0.6 m/s'],
    ['Quantity', 'จำนวน', `${S.qty} pcs`],
  ];
  $('doorkv').innerHTML = rows.map(([k, t, v]) => `<span class="k">${k} <i>${t}</i></span><span>${v}</span>`).join('');
  $('acclist').innerHTML = S.acc.length ? S.acc.map((r) => {
    const label = TYPE_LABEL[r.t];
    const model = r.t === 'other' ? (r.text || '') : (r.sku || '');
    return `<div><span>${label} <span style="color:#777">${TH[label] || ''}</span>${model ? ' · ' + esc(model) : ''}</span><b>× ${r.q}</b></div>`;
  }).join('') : '<div><span>—</span></div>';
  const addr = $('addr').value.trim();
  $('stampkv').innerHTML = [
    ['Sales order', 'ใบสั่งขาย', esc($('so').value + ' · ' + $('ref').value)],
    ['Customer', 'ลูกค้า', esc($('cust').value)],
    ['Delivery address', 'ที่อยู่จัดส่ง', addr ? esc(addr) : '<i style="color:#999">billing address from Zoho</i>'],
  ].map(([k, t, v]) => `<span class="k">${k} <i>${t}</i></span><span>${v}</span>`).join('');
  $('sdate').textContent = new Date().toLocaleDateString('en-GB').replace(/\//g, '.');
  $('drawNo').textContent = `${S.id} · rev ${S.revision}`;
}

function renderMessages(calc) {
  const warn = $('warn'); const notes = $('notes');
  warn.style.display = calc.errors.length ? 'block' : 'none';
  warn.innerHTML = calc.errors.map((m) => esc(m.code === 'NOT_AVAILABLE' ? T('warn')(S.W, S.H, (S.W * S.H / 1e6).toFixed(1)) : msgText(m, LANG))).join('<br>');
  notes.style.display = calc.warnings.length ? 'block' : 'none';
  notes.innerHTML = `<b>${T('notes')}</b><ul>${calc.warnings.map((m) => `<li>${esc(msgText(m, LANG))}</li>`).join('')}</ul>`;
}


function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function update() {
  S.W = Math.round(+$('W').value || 0);
  S.H = Math.round(+$('H').value || 0);
  S.qty = Math.max(1, parseInt($('qty').value, 10) || 1);
  S.guide = $('guide').value;
  S.supply = $('supply').checked ? 'own' : 'outsourced'; // галочка Own production: SDA → SDA-DS (Alex 26.11)
  S.fabric = $('fabric').value;
  if (S.color >= pal().length) S.color = 0;
  S.ctrlH = Math.round(+$('ctrlH').value || 1000);
  S.id = idFromSo();

  DOC = buildDoc();
  RESULT = calculateHsr(DOC, CAT, { now: new Date().toISOString() });
  const calc = RESULT.calc;
  renderMessages(calc);
  const blocked = calc.status !== 'ok';
  saveState(blocked);
  document.querySelector('.sheet').style.opacity = blocked ? 0.35 : 1;

  if (calc.frame && calc.curtain) {
    const sk = calc.frame.sketch;
    Object.assign(S, {
      boxH: sk.headerHeight, boxD: sk.headerDepth, coverH: sk.motorCoverHeight,
      guideW: sk.column.w, guideD: sk.column.d, sideMotor: sk.motorSideWidth, sideFree: sk.nonMotorSideWidth,
    });
    const secs = calc.curtain.sections.map((s, i, a) => (s.top ? calc.curtain.topVisible : s.h) + (i === 0 ? 135 : 0));
    if (secs.length === 1) secs[0] = calc.curtain.topVisible;
    S.layout = { secs };
    S.vision = new Set(calc.curtain.sections.filter((s) => s.transparent).map((s) => s.no));
    $('sn').textContent = calc.curtain.sections.length;
    $('shint').textContent = S.extra ? T('shMan')(S.extra, calc.curtain.windbars - S.extra + 1) : T('shStd');
    renderColors(); renderAcc();
    draw($('form-svg'), 'form');
    draw($('sheet-svg'), 'sheet');
  } else {
    renderColors(); renderAcc();
  }
  renderSheetText(calc);
  if (S.frozen) lockInputs();
  if (!LOADING) S.dirty = true;
  $('engineTag').textContent = `${calc.engine} · catalogs ${calc.catalogs || '?'}`;
}

// Ручные «прозрачная секция» из чертежа: draw() меняет S.vision и ставит visionAuto=false
['W', 'H', 'qty', 'cust', 'addr', 'so', 'ref', 'ctrlH'].forEach((id) => $(id).addEventListener('input', update));
['guide', 'supply', 'fabric'].forEach((id) => $(id).addEventListener('change', update));
$('sm').onclick = () => { S.extra = Math.max(0, S.extra - 1); S.visionAuto = true; update(); };
$('sp').onclick = () => { S.extra = Math.min(2, S.extra + 1); S.visionAuto = true; update(); };
$('sa').onclick = () => { S.extra = 0; S.visionAuto = true; update(); };
$('addAcc').onclick = () => { S.acc.push({ t: 'push_button', sku: 'button-1NO', q: 1 }); update(); };
$('print').onclick = () => window.print();

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}


$('openFile').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { loadOrder(JSON.parse(await f.text())); } catch (err) { alert('Not an order JSON: ' + err.message); }
  e.target.value = '';
};

/** Заполняет форму из документа заказа (схема v1). */
function loadOrder(doc) {
  S.loadedOrder = doc;
  const o = doc.options || {}; const ord = doc.order || {};
  S.revision = doc.revision || 1;
  $('so').value = ord.salesorderNumber ? `${ord.salesorderNumber}${ord.salesorderItem ? '-' + ord.salesorderItem : ''}` : (doc.id || '');
  $('cust').value = (ord.customer && ord.customer.name) || '';
  $('addr').value = ord.deliveryAddress || '';
  $('ref').value = ord.reference || '';
  $('W').value = doc.opening.width; $('H').value = doc.opening.height; $('qty').value = doc.opening.quantity || 1;
  $('guide').value = o.frameMaterial === 'ss304' ? 'ss' : 'alu';
  $('supply').checked = o.supply !== 'outsourced';
  const pvc = o.pvc || 'blue';
  $('fabric').value = pvc.startsWith('mesh-') ? 'mesh' : 'pvc';
  S.fabric = $('fabric').value;
  const ci = pal().findIndex((c) => c[3] === pvc.replace(/^mesh-/, ''));
  S.color = ci >= 0 ? ci : 0;
  S.motor = o.driveSide || 'L'; S.ctrl = o.controlSide || S.motor;
  $('ctrlH').value = o.controlBoxHeight || 1000;
  S.extra = (o.sections && o.sections.extraWindbars) || 0;
  S.visionAuto = !o.transparentSections; if (o.transparentSections) S.vision = new Set(o.transparentSections);
  S.acc = (o.accessories || []).map((a) => ({ t: a.type || 'other', sku: a.sku, q: a.qty || 1 }));
  S.overrides = o.overrides || [];
  update();
}

// ── Справочник форм: сохранение, открытие, заморозка ─────────
const VERSION = '1.0';
const FORMS_URL = 'forms.html';
const CALC_URL = 'sda-calculator.html';
const productOf = () => (S.supply === 'outsourced' ? 'SDA' : 'SDA-DS');
const withLang = (url) => `${url}${url.includes('?') ? '&' : '?'}lang=${LANG}`;

/** Всплывающее сообщение внизу экрана — видно, где бы ни была прокрутка (Alex 27.11: нет видимого эффекта сохранения). */
function toast(kind, html, ms = 4000) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = `toast ${kind} on`; t.innerHTML = html;
  clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove('on'), ms);
}
function flashSave(ok) {
  const b = $('save'); b.textContent = ok ? T('savedBtn') : T('save');
  b.classList.toggle('done', ok);
  clearTimeout(flashSave.tm);
  if (ok) flashSave.tm = setTimeout(() => { b.textContent = T('save'); b.classList.remove('done'); }, 2500);
}
function fail(html) { banner('err', html); toast('err', html, 7000); flashSave(false); }
function banner(kind, html, btn) {
  const b = $('banner');
  if (!kind) { b.hidden = true; return; }
  b.hidden = false; b.className = `banner ${kind}`;
  b.innerHTML = html + (btn ? ` <button class="btn s" id="bannerBtn">${esc(btn.text)}</button>` : '');
  if (btn) $('bannerBtn').onclick = btn.onclick;
}
function fsUi() {
  const b = $('fsBtn'); const s = FS.state;
  b.textContent = s === 'ok' ? T('fsOk')(FS.name) : s === 'reconnect' ? T('fsRe')(FS.name) : s === 'unsupported' ? T('fsUns') : T('fsNo');
  b.className = 'btn s' + (s === 'ok' ? ' btn-ok' : '');
}
$('fsBtn').onclick = async () => {
  try {
    if (FS.state === 'reconnect') await fsReconnect(); else if (FS.state !== 'unsupported') await fsPick();
    fsUi();
    if (PENDING) { const p = PENDING; PENDING = null; await p(); } else if (FS.state === 'ok' && !S.frozen) banner(null);
  } catch (e) { if (e && e.name !== 'AbortError') alert(e.message); }
};

/** Кнопка Save и заголовок: почему сохранить нельзя — подсказкой рядом. */
function saveState(blocked) {
  const why = S.frozen ? T('whyFrozen') : blocked ? T('whyBlocked') : !S.id ? T('whyNoId') : '';
  $('save').disabled = !!why;
  $('saveWhy').textContent = why;
  $('formTag').textContent = productOf();
  $('title').textContent = `${productOf()} · ${S.formId || S.id || T('newOrder')}`;
  document.title = `${S.formId || T('newOrder')} · ${productOf()}`;
  $('lnkForms').href = withLang(FORMS_URL);
}

function lockInputs() {
  document.querySelectorAll('.app input, .app select, .app textarea, .app button').forEach((e) => {
    if (e.id !== 'print' && e.id !== 'dl') e.disabled = true;
  });
}
function setFrozen(on) {
  S.frozen = on;
  document.body.classList.toggle('frozen', on);
  $('openLbl').style.display = on ? 'none' : '';
  if (on) {
    lockInputs();
    banner('info', T('frozen')(esc(S.formId), withLang(`${CALC_URL}?calc=${encodeURIComponent(S.formId)}`)));
  }
}

async function save() {
  update();
  const id = S.id;
  if (!id || S.frozen) return;
  if (FS.state === 'reconnect') {
    PENDING = save;
    banner('warn', esc(T('folderRe')(FS.name)), { text: T('allow'), onclick: () => $('fsBtn').click() });
    return;
  }
  try {
    const [fx, sp] = await Promise.all([readForms(), specIds()]);
    if (sp.has(id)) {
      if (id === S.formId) { setFrozen(true); update(); return; } // спецификацию создали, пока форма была открыта
      fail(esc(T('takenSpec')(id))); return;
    }
    if (fx.rows.some((r) => r.id === id) && id !== S.formId) { fail(esc(T('takenForm')(id))); return; }
    const old = S.formId && S.formId !== id ? S.formId : null;
    if (old && (sp.has(old) || !confirm(T('renamed')(old, id)))) return;
    const now = nowStr();
    const created = (S.formId && S.created) || now;
    const doc = structuredClone(DOC);
    delete doc.calc; delete doc.spec; // в форме только заказ: расчёт и состав делает калькулятор
    doc.id = id;
    const rec = { app: 'hsd-configurator', kind: 'form', version: VERSION, engine: ENGINE, id, category: 'highspeed',
      product: productOf(), status: 'draft', created, edited: now, doc };
    const row = { id, order: doc.order.salesorderNumber, pos: doc.order.salesorderItem || '', customer: (doc.order.customer || {}).name || '',
      category: 'highspeed', product: rec.product, W: S.W, H: S.H, qty: S.qty, created, edited: now, status: 'draft' };
    await saveForm(rec, row);
    if (old) await deleteForm(old);
    S.formId = id; S.created = created; S.loadedOrder = doc; S.dirty = false;
    history.replaceState(null, '', `?form=${encodeURIComponent(id)}&lang=${LANG}`);
    const msg = esc(T('saved')(id, FS.state === 'ok' ? T('inFolder')(FS.name) : T('noFolder')));
    banner(FS.state === 'ok' ? 'ok' : 'warn', msg);
    toast(FS.state === 'ok' ? 'ok' : 'warn', `✓ ${msg} <span class="tm">${now.slice(11)}</span>`, FS.state === 'ok' ? 4000 : 7000);
    flashSave(true);
    update(); S.dirty = false;
  } catch (e) { fail(esc(T('saveErr')(e.message || String(e)))); }
}
$('save').onclick = async () => {
  const b = $('save'); b.disabled = true; b.textContent = T('saving');
  try { await save(); } finally { if (!b.classList.contains('done')) b.textContent = T('save'); saveState(RESULT && RESULT.calc.status !== 'ok'); }
};
$('dl').onclick = () => {
  const doc = structuredClone(DOC); delete doc.calc; delete doc.spec;
  download(`${S.id || 'order'}.json`, JSON.stringify(doc, null, 2), 'application/json');
};

async function openForm(id) {
  let rec = null;
  try { rec = await stGet(`forms/${id}.json`); } catch (e) { banner('err', esc(e.message)); }
  if (!rec) {
    banner('err', esc(T('notFound')(id)), { text: T('forms'), onclick: () => { location.href = withLang(FORMS_URL); } });
    update(); return;
  }
  loadOrder(rec.doc || rec);
  S.formId = id; S.created = rec.created || null;
  const sp = await specIds().catch(() => new Set());
  if (sp.has(id)) setFrozen(true); else banner(null);
  update(); S.dirty = false;
}

let PENDING = null;
async function start() {
  const q = new URLSearchParams(location.search);
  await fsInit(); fsUi();
  const formId = q.get('form');
  if (formId && FS.state === 'reconnect') {
    PENDING = () => openForm(formId);
    banner('warn', esc(T('folderRe')(FS.name)), { text: T('allow'), onclick: () => $('fsBtn').click() });
  } else if (formId) {
    await openForm(formId);
  } else {
    const p = q.get('product');
    if (p === 'SDA-DS') $('supply').checked = true;
    if (FS.state === 'none') banner('warn', esc(T('folderNone')));
  }
  update();
  LOADING = false; S.dirty = false;
}
window.addEventListener('beforeunload', (e) => { if (S.dirty && !S.frozen) { e.preventDefault(); e.returnValue = ''; } });

applyLang();
update();
await start();
window.SDA = { get result() { return RESULT; }, get doc() { return DOC; }, loadOrder };
