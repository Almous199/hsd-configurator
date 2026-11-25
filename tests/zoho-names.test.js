// Названия в CSV сборки должны быть точно как в Zoho: берутся из снимка Zoho по SKU, руками не пишутся.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cat } from './helpers.js';
import { loadCatalogs } from '../core/load-catalogs.js';
import { syncNames } from '../scripts/sync-zoho-names.js';

const snapshot = loadCatalogs().zoho.items;
const zoho = new Map(snapshot.items.map((i) => [i.sku, i]));

test('zohoName в items.json совпадает со снимком Zoho (иначе npm run sync:zoho)', () => {
  const text = readFileSync(new URL('../catalogs/hsr/items.json', import.meta.url), 'utf8');
  assert.deepEqual(syncNames(text, snapshot).changes, []);
});

test('каждый действующий артикул каталога есть в Zoho и активен', () => {
  const bad = cat.items.items
    .filter((i) => !i.pendingImport && i.active !== false)
    .filter((i) => zoho.get(i.sku)?.status !== 'active')
    .map((i) => `${i.sku}: ${zoho.get(i.sku)?.status ?? 'нет в Zoho'}`);
  assert.deepEqual(bad, []);
});
