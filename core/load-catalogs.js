// Загрузка каталогов из папки catalogs/ для Node (тесты, скрипты, сервер).
// В браузере каталоги подгружаются fetch'ем и передаются в ядро тем же объектом.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'catalogs');

/** { hsr: { items, guides, header, ... } } — имя файла без .json становится ключом (section-heights.lefast → sectionHeightsLefast). */
export function loadCatalogs(root = ROOT) {
  const out = {};
  for (const product of readdirSync(root, { withFileTypes: true })) {
    if (!product.isDirectory()) continue;
    const dir = join(root, product.name);
    out[product.name] = {};
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const key = f.replace(/\.json$/, '').replace(/[.-](\w)/g, (_, c) => c.toUpperCase());
      out[product.name][key] = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    }
  }
  return out;
}
