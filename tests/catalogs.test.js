import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCatalogs } from '../scripts/check-catalogs.js';

test('все SKU из каталогов есть в items.json', () => {
  assert.deepEqual(checkCatalogs(), []);
});
