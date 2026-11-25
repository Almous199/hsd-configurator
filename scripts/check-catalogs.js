// Проверка каталогов: каждый SKU, на который ссылаются файлы catalogs/hsr, заведён в items.json.
import { loadCatalogs } from '../core/load-catalogs.js';
import { fileURLToPath } from 'node:url';

const SKU_KEYS = new Set(['sku', 'plug', 'seal', 'nylonRod', 'flange', 'cover', 'endPlates', 'plate', 'L', 'R',
  'rail', 'topBracket', 'footBracket', 'fittingStrip', 'support', 'window', 'brush', 'wearStrip', 'guidePad', 'photocellSupport']);
const SKIP_FILES = new Set(['items', 'sectionHeightsLefast', 'layouts', 'curtain', 'space']);

export function checkCatalogs(cat = loadCatalogs().hsr) {
  const known = new Set(cat.items.items.map((i) => i.sku));
  const problems = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('_') || k === 'note') continue;
        if (typeof v === 'string' && SKU_KEYS.has(k) && !v.includes(' | ') && !known.has(v)) problems.push(`${path}.${k} = ${v}`);
        else if (path.endsWith('.colors') || path.endsWith('.mesh')) { if (typeof v === 'string' && !known.has(v)) problems.push(`${path}.${k} = ${v}`); }
        else walk(v, `${path}.${k}`);
      }
    }
  };
  for (const [name, data] of Object.entries(cat)) if (!SKIP_FILES.has(name)) walk(data, name);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const p = checkCatalogs();
  if (p.length) { console.error('Нет в items.json:\n  ' + p.join('\n  ')); process.exit(1); }
  console.log('Каталоги в порядке');
}
