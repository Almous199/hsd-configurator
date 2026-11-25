// Расчёт заказа из JSON-файла: node scripts/calc-order.js tests/orders/DSO-26659.json [--csv SDA-DS|DUS-055] [--date yyyy-mm-dd]
// Печатает calc и spec, при --csv пишет файл импорта сборки в папку out/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadCatalogs } from '../core/load-catalogs.js';
import { calculateHsr, exportAssemblyCsv } from '../products/hsr/index.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('Укажите файл заказа'); process.exit(2); }
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const doc = JSON.parse(readFileSync(file, 'utf8'));
const cat = loadCatalogs().hsr;
const result = calculateHsr(doc, cat, { now: new Date().toISOString() });

for (const m of [...result.calc.errors, ...result.calc.warnings]) console.log(`${m.level === 'error' ? '✗' : '!'} ${m.code}: ${m.text}`);
if (result.spec) {
  console.table(result.spec.lines.map((l) => ({ раздел: l.section, sku: l.sku ?? '— нет SKU —', название: l.name ?? l.partId, кол: l.qty, ед: l.unit })));
}
const asm = opt('--csv');
if (asm) {
  const date = opt('--date') || new Date().toISOString().slice(0, 10);
  const out = exportAssemblyCsv(doc, result, cat, { assemblySku: asm, date });
  if (out.problems.length) console.log('Проблемы CSV:\n  ' + out.problems.join('\n  '));
  if (out.csv) { mkdirSync('out', { recursive: true }); writeFileSync(`out/${out.fileName}`, out.csv); console.log(`Записан out/${out.fileName}`); }
}
