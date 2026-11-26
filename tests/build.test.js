// Готовые файлы dist/ должны совпадать со свежей сборкой (не забыть npm run build).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('dist/ собран из текущего кода и каталогов', () => {
  const out = mkdtempSync(join(tmpdir(), 'sda-'));
  execFileSync(process.execPath, [join(root, 'scripts/build-standalone.js'), out]);
  for (const [file, mod] of [['sda-order-form.html', 'products/hsr/index.js'], ['sda-calculator.html', 'products/hsr/winding.js'], ['forms.html', 'web/storage.js']]) {
    const fresh = readFileSync(join(out, file), 'utf8');
    assert.ok(fresh.includes('window.__CATALOGS__'));
    assert.ok(fresh.includes(mod), `${file}: нет модуля ${mod}`);
    assert.equal(readFileSync(join(root, 'dist', file), 'utf8'), fresh, `dist/${file} устарел: выполните npm run build`);
  }
});
