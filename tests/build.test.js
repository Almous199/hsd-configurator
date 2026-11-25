// Готовый файл формы dist/sda-order-form.html должен совпадать со свежей сборкой (не забыть npm run build).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('dist/sda-order-form.html собран из текущего кода и каталогов', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'sda-')), 'form.html');
  execFileSync(process.execPath, [join(root, 'scripts/build-standalone.js'), out]);
  const fresh = readFileSync(out, 'utf8');
  assert.ok(fresh.includes('window.__CATALOGS__'));
  assert.ok(fresh.includes('products/hsr/index.js'));
  assert.equal(readFileSync(join(root, 'dist/sda-order-form.html'), 'utf8'), fresh, 'dist устарел: выполните npm run build');
});
