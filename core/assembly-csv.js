// CSV импорта сборок Zoho Inventory (Assemblies → ⋮ → Import Assemblies).
// Формат проверен Alex на секционных воротах (BUN-26217, zoho_export.html):
// UTF-8 с BOM, разделитель запятая, строки CRLF, дата yyyy-mm-dd, десятичная точка,
// шапка сборки повторяется в каждой строке, Mapped Item Name обязателен.
// Zoho читает Mapped Quantity как количество на всю партию и сам делит на Quantity to Assemble,
// поэтому количество на одни ворота умножаем на число ворот.
import { formatNum } from './units.js';

export const HEADER = [
  'Composite Item SKU', 'Warehouse name', 'Composite Item Name',
  'Assembly Number', 'Assembly Date', 'Quantity to Assemble',
  'Mapped Item Name', 'Mapped Item SKU', 'Mapped Quantity', 'Description',
];

/** RFC 4180: кавычки, если в значении есть запятая, кавычка или перевод строки. */
export function csvCell(val) {
  const s = String(val ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * @param {object} a
 * @param {string} a.compositeSku   SKU сборки (SDA-DS, DUS-055…)
 * @param {string} a.compositeName  название сборки в Zoho
 * @param {string} a.warehouse
 * @param {string} a.number         номер сборки BUN-…
 * @param {string} a.date           yyyy-mm-dd
 * @param {number} a.quantity       сколько ворот собрать
 * @param {string} [a.description]
 * @param {Array<{sku:string,name:string,qty:number}>} a.lines  количества на одни ворота
 * @returns {{ csv: string, fileName: string, problems: string[] }}
 */
export function buildAssemblyCsv(a) {
  const problems = [];
  if (!a.compositeSku) problems.push('Пустой Composite Item SKU');
  if (!a.compositeName) problems.push('Пустой Composite Item Name');
  if (!a.warehouse) problems.push('Пустой склад');
  if (!a.number) problems.push('Пустой номер сборки');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || '')) problems.push('Дата должна быть yyyy-mm-dd');
  if (!(a.quantity > 0)) problems.push('Количество ворот должно быть больше 0');
  if (!a.lines || a.lines.length === 0) problems.push('Нет компонентов');
  (a.lines || []).forEach((l, i) => {
    const n = i + 1;
    if (!l.sku) problems.push(`Строка ${n}: нет SKU (${l.name || l.partId || '?'})`);
    if (!l.name) problems.push(`Строка ${n}: нет названия Zoho (${l.sku})`);
    if (!(l.qty > 0)) problems.push(`Строка ${n} (${l.sku}): количество ${l.qty}`);
  });

  const rows = [HEADER.map(csvCell).join(',')];
  for (const l of a.lines || []) {
    rows.push([
      a.compositeSku, a.warehouse, a.compositeName, a.number, a.date, formatNum(a.quantity),
      l.name, l.sku, formatNum(+(l.qty * a.quantity).toFixed(6)), a.description || '',
    ].map(csvCell).join(','));
  }
  return {
    csv: '﻿' + rows.join('\r\n') + '\r\n',
    fileName: `${a.number}_${a.compositeSku}.csv`,
    problems,
  };
}
