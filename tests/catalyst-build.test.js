// Онлайн-сборка: замены слоя хранения в копиях секционных страниц находятся ровно по одному разу,
// страницы SDA подключают hsd-online.js, вход ведёт на нужную страницу.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SECTIONAL_PATCHES, patchSectional, buildCatalyst } from '../scripts/build-catalyst.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('замены в sectional/*.html применяются', () => {
  for (const name of Object.keys(SECTIONAL_PATCHES)) {
    const out = patchSectional(name, readFileSync(join(root, 'sectional', name), 'utf8'));
    assert.ok(out.includes('<script src="hsd-online.js"></script>'), name);
    assert.ok(out.includes('if(window.HSD) return HSD.get(path);'), name);
  }
});

test('сборка catalyst/client: все страницы и онлайн-скрипт', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hsd-cat-'));
  buildCatalyst(dir);
  for (const f of ['index.html', 'forms.html', 'sda-order-form.html', 'sda-calculator.html', 'specs.html', 'door_calculator.html', 'hsd-online.js', 'import.html', 'client-package.json']) {
    assert.ok(existsSync(join(dir, f)), f);
  }
  for (const f of ['forms.html', 'sda-order-form.html', 'sda-calculator.html']) {
    assert.ok(readFileSync(join(dir, f), 'utf8').includes('<script src="hsd-online.js"></script>'), f);
  }
});
