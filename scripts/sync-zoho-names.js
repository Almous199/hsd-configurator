// Переносит названия из снимка Zoho (catalogs/zoho/items.json) в catalogs/hsr/items.json по SKU.
// Названия руками не пишем: источник — Zoho (Alex 25.11). Запуск: npm run sync:zoho
// Меняются только поля zohoName и zohoUnitNow; остальной текст файла не трогается.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const snapPath = join(root, 'catalogs/zoho/items.json');
const itemsPath = join(root, 'catalogs/hsr/items.json');

export function zohoIndex(snapshot) {
  return new Map(snapshot.items.map((i) => [i.sku, i]));
}

/** Возвращает { text, changes, missing } — новый текст items.json и список изменений. */
export function syncNames(itemsText, snapshot) {
  const zoho = zohoIndex(snapshot);
  const changes = []; const missing = [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let text = itemsText;
  for (const item of JSON.parse(itemsText).items) {
    const z = zoho.get(item.sku);
    if (!z) { if (!item.pendingImport && item.active !== false) missing.push(item.sku); continue; }
    // блок товара: от "sku": "<sku>" до закрывающей скобки объекта
    const re = new RegExp(`("sku": "${esc(item.sku)}"[^{}]*?)}`);
    text = text.replace(re, (block, body) => {
      let b = body;
      const set = (key, value) => {
        const kre = new RegExp(`"${key}": "(?:[^"\\\\]|\\\\.)*"`);
        if (kre.test(b)) b = b.replace(kre, () => `"${key}": ${JSON.stringify(value)}`);
        else b = b.replace(/\s*$/, (ws) => `,\n      "${key}": ${JSON.stringify(value)}${ws}`);
      };
      if (item.zohoName !== z.name) { changes.push(`${item.sku}: «${item.zohoName ?? ''}» → «${z.name}»`); set('zohoName', z.name); }
      if (item.zohoUnitNow !== undefined && item.zohoUnitNow !== z.unit) set('zohoUnitNow', z.unit);
      return b + '}';
    });
  }
  return { text, changes, missing };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const snapshot = JSON.parse(readFileSync(snapPath, 'utf8'));
  const { text, changes, missing } = syncNames(readFileSync(itemsPath, 'utf8'), snapshot);
  writeFileSync(itemsPath, text);
  console.log(changes.length ? `Обновлено названий: ${changes.length}\n  ${changes.join('\n  ')}` : 'Названия совпадают с Zoho');
  if (missing.length) console.log(`Нет в снимке Zoho: ${missing.join(', ')}`);
}
