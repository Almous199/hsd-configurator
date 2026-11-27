// Ядро расчёта скоростных ворот SDA (HSR1000).
// Вход: заказ { productType:'hsr', id, order, opening, options }. Каталоги — объект из catalogs/hsr.
// Выход: { calc, spec } по схеме заказа v1 (00-architecture/order-schema-proposal.md).
// Чистые функции: без файлов, сети и времени (время передаётся параметром).
import { error, warning, hasErrors } from '../../core/messages.js';
import { indexItems, requireItem } from '../../core/catalog.js';
import { buildAssemblyCsv } from '../../core/assembly-csv.js';
import { normalizeInput } from './input.js';
import { calcFrame } from './frame.js';
import { calcCurtain } from './curtain.js';
import { calcDrive } from './drive.js';
import { buildSpecLines } from './spec.js';

export const ENGINE = 'hsr@0.1.0';

/**
 * @param {object} doc   документ заказа
 * @param {object} cat   каталоги HSR (loadCatalogs().hsr)
 * @param {object} [env] { now: ISO-строка времени расчёта }
 */
export function calculateHsr(doc, cat, env = {}) {
  const messages = [];
  if (doc.productType && doc.productType !== 'hsr') {
    messages.push(error('PRODUCT_TYPE', { ru: `Ожидался productType "hsr", получен "${doc.productType}"`, en: `Expected productType "hsr", got "${doc.productType}"` }));
  }
  const bySku = indexItems(cat.items);
  const inp = normalizeInput(doc, messages);
  validateAccessories(inp.accessories, cat, bySku, messages);

  let frame = null; let curtain = null; let drive = null;
  if (!hasErrors(messages)) frame = calcFrame(inp, cat, messages);
  if (frame) curtain = calcCurtain(inp, frame, cat, messages);
  if (frame) drive = calcDrive(inp, frame, cat, messages);

  if (frame && curtain) {
    const dMax = { S: 200, M: 250 }[frame.sidePlate];
    if (dMax && curtain.rollDiameter > dMax) {
      messages.push(warning('ROLL_TOO_BIG', { ru: `Рулон ≈ Ø${curtain.rollDiameter} больше допустимого Ø${dMax} для боковины ${frame.sidePlate}`, en: `Roll ≈ Ø${curtain.rollDiameter} is over the allowed Ø${dMax} for end plate ${frame.sidePlate}`, th: `ม้วน ≈ Ø${curtain.rollDiameter} ใหญ่กว่าที่อนุญาต Ø${dMax} สำหรับแผ่นปิดข้าง ${frame.sidePlate}` }));
    }
    frame.rollDiameterMax = dMax;
  }

  const blocked = hasErrors(messages);
  const calc = {
    engine: ENGINE,
    catalogs: cat.items._source ? catalogVersion(cat) : null,
    calculatedAt: env.now || null,
    frozen: false,
    status: blocked ? 'blocked' : 'ok',
    errors: messages.filter((m) => m.level === 'error'),
    warnings: messages.filter((m) => m.level === 'warning'),
    opening: { width: inp.W, height: inp.H, areaM2: Math.round(inp.areaM2 * 100) / 100, quantity: inp.quantity },
    frame, curtain, drive,
    cutList: blocked ? [] : cutList(frame, curtain),
  };

  let spec = null;
  if (!blocked && inp.supply === 'own') {
    const lines = buildSpecLines(inp, frame, curtain, drive, cat, bySku);
    spec = {
      generatedAt: env.now || null,
      zohoAssembly: (doc.spec && doc.spec.zohoAssembly) || 'SDA-DS',
      bundleNumber: bundleNumber(doc.id),
      perDoor: true,
      lines,
      missingSku: lines.filter((l) => l.missingSku).map((l) => l.partId),
      pendingImport: lines.filter((l) => l.pendingImport).map((l) => l.sku),
    };
  }
  return { calc, spec };
}

function validateAccessories(list, cat, bySku, messages) {
  const models = new Map();
  for (const t of cat.accessories.types) for (const m of t.models) if (m.sku) models.set(m.sku, m);
  for (const a of list) {
    if (!a || !a.sku) {
      messages.push(error('ACCESSORY_UNAVAILABLE', { ru: 'Аксессуар без SKU (например пост на 2 кнопки) пока недоступен', en: 'Accessory without SKU (e.g. 2-button station) is not available yet', th: 'อุปกรณ์เสริมที่ไม่มี SKU (เช่น สวิตช์ 2 ปุ่ม) ยังไม่พร้อมใช้งาน' }));
      continue;
    }
    if (!models.has(a.sku)) messages.push(error('ACCESSORY_UNKNOWN', { ru: `Аксессуар ${a.sku} не из списка формы`, en: `Accessory ${a.sku} is not in the form list`, th: `อุปกรณ์เสริม ${a.sku} ไม่อยู่ในรายการของฟอร์ม` }));
    else requireItem(bySku, a.sku);
    if (!(a.qty >= 1)) messages.push(error('ACCESSORY_QTY', { ru: `Количество ${a.sku} должно быть ≥ 1`, en: `Quantity of ${a.sku} must be ≥ 1`, th: `จำนวน ${a.sku} ต้อง ≥ 1` }));
  }
}

function cutList(f, c) {
  return [
    { part: 'guide', length: f.guideLength, qty: f.guideQty },
    { part: 'headerCover', length: f.boxLength, qty: 1 },
    { part: 'shaft', length: f.shaftLength, qty: 1 },
    { part: 'beam', length: f.beamLength, qty: f.beamQty },
    { part: 'windbar', length: c.windbarProfile.length, qty: c.windbars },
    { part: 'bottomProfile', length: c.bottomProfile.length, qty: 1 },
  ];
}

function catalogVersion(cat) {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(cat.items._source || '');
  return m ? m[1] : null;
}

/** BUN-<номер SO без DSO->-<позиция>: DSO-26217-1 → BUN-26217-1 (тред 06). */
export function bundleNumber(id) {
  if (!id) return null;
  return 'BUN-' + String(id).replace(/^DSO-/i, '');
}

/**
 * CSV сборки для импорта в Zoho Inventory. В файл идут только разделы выбранной сборки.
 * @param {object} doc     документ заказа (нужны id, opening.quantity)
 * @param {object} result  результат calculateHsr
 * @param {object} cat     каталоги HSR
 * @param {object} opt     { assemblySku?: 'SDA-DS'|'DUS-055', date: 'yyyy-mm-dd' }
 */
export function exportAssemblyCsv(doc, result, cat, opt) {
  if (!result.spec) {
    return { csv: null, fileName: null, problems: ['Спецификации нет: расчёт заблокирован или ворота заказаны на стороне (SDA)'] };
  }
  const sku = opt.assemblySku || result.spec.zohoAssembly;
  const asm = cat.assemblies.assemblies.find((a) => a.sku === sku);
  if (!asm) return { csv: null, fileName: null, problems: [`Сборка ${sku} не из списка (${cat.assemblies.assemblies.map((a) => a.sku).join(', ')})`] };

  const lines = result.spec.lines.filter((l) => asm.sections.includes(l.section));
  const c = result.calc;
  const description = `SDA ${c.opening.width}x${c.opening.height}, ${c.frame.material}, ${c.curtain.pvc.id}, ${c.drive.powerKw} kW ${c.drive.driveSide}`;
  const out = buildAssemblyCsv({
    compositeSku: asm.sku,
    compositeName: asm.name,
    warehouse: cat.assemblies.warehouse,
    number: result.spec.bundleNumber,
    date: opt.date,
    quantity: c.opening.quantity,
    description,
    lines,
  });
  for (const l of lines) if (l.pendingImport) out.problems.push(`${l.sku} ещё не заведён в Zoho`);
  return out;
}
