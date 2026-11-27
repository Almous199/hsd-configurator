// Сборка веб-клиента для Zoho Catalyst: catalyst/client/ (в git не хранится, собирается перед выкладкой).
//   forms.html, sda-order-form.html, sda-calculator.html — страницы SDA (как dist/, плюс онлайн-режим hsd-online.js);
//   specs.html, door_calculator.html — копии страниц секционного проекта из sectional/ с заменой слоя хранения
//     (папка на ПК → облако). Расчёт и вид не меняются. Каждая замена должна найтись ровно один раз: если новая
//     версия калькулятора изменила этот код, сборка остановится с понятной ошибкой (тест tests/catalyst-build.test.js).
//   import.html — перенос рабочей папки с ПК в облако (админ);
//   index.html — вход: склад → specs.html, остальные → forms.html.
// Запуск: npm run build:catalyst [папка вывода]
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, build } from './build-standalone.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ONLINE_TAG = '<script src="hsd-online.js"></script>\n';

// ───────────── заменa слоя хранения в страницах секционного проекта ─────────────
// [что ищем, на что меняем]. Только добавляем ветку «если онлайн» в начало функций хранения.
export const SECTIONAL_PATCHES = {
  'specs.html': [
    ["const SECT_URL = 'door_calculator%20v", "const SECT_URL = window.HSD ? 'door_calculator.html' : 'door_calculator%20v"],
    ["const HSR_URL  = '../../HSD%20constructor/app/sda-calculator.html';", "const HSR_URL  = window.HSD ? 'sda-calculator.html' : '../../HSD%20constructor/app/sda-calculator.html';"],
    ['async function stGet(path){\n', 'async function stGet(path){\n  if(window.HSD) return HSD.get(path);\n'],
    ['async function stPut(path,obj){\n', 'async function stPut(path,obj){\n  if(window.HSD) return HSD.put(path,obj);\n'],
    ['async function stDel(path){\n', 'async function stDel(path){\n  if(window.HSD) return HSD.del(path);\n'],
    ['async function fsInit(){\n', 'async function fsInit(){\n  if(window.HSD){ await HSD.init(FS); return; }\n'],
    ['function fsChipClick(){ ', 'function fsChipClick(){ if(window.HSD) return HSD.signOut(); '],
    ["b.textContent = st==='ok'?`${t('fsFolder')}: ${FS.name} ✓`", "b.textContent = st==='ok'?(window.HSD?FS.name:`${t('fsFolder')}: ${FS.name} ✓`)"],
    ["async function rebuildIndex(){\n", "async function rebuildIndex(){\n  if(window.HSD){ alert('Online: the index is kept by the server.'); return; }\n"],
  ],
  'door_calculator.html': [
    ['async function stGet(path){\n', 'async function stGet(path){\n  if(window.HSD) return HSD.get(path);\n'],
    ['async function stPut(path,obj){\n', 'async function stPut(path,obj){\n  if(window.HSD) return HSD.put(path,obj);\n'],
    ['async function fsInit(){\n', 'async function fsInit(){\n  if(window.HSD){ try{ await HSD.init(FS); }catch(e){ FS.state=\'none\'; FS.msg=e.message; fsUi(); return; } await fsReady(); return; }\n'],
    ['function fsChipClick(){ ', 'function fsChipClick(){ if(window.HSD) return HSD.signOut(); '],
    ["const txt = st==='ok' ? `${t('fs-folder')}: ${FS.name} ✓`", "const txt = st==='ok' ? (window.HSD ? FS.name : `${t('fs-folder')}: ${FS.name} ✓`)"],
    ['async function migrateLocalCalcs(){', 'async function migrateLocalCalcs(){ if(window.HSD) return;'],
  ],
};

export function patchSectional(name, html) {
  let out = html;
  for (const [from, to] of SECTIONAL_PATCHES[name]) {
    const n = out.split(from).length - 1;
    if (n !== 1) throw new Error(`sectional/${name}: фрагмент «${from.slice(0, 60)}…» найден ${n} раз (нужно 1) — код хранения изменился, обновите SECTIONAL_PATCHES`);
    out = out.replace(from, () => to);
  }
  // онлайн-скрипт — перед первым <script> страницы
  const i = out.indexOf('<script>');
  if (i < 0) throw new Error(`sectional/${name}: нет <script>`);
  return out.slice(0, i) + ONLINE_TAG + out.slice(i);
}

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DOORHAN SIAM</title>
<style>body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;background:#f5f4f0;color:#1a1a18;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style>
${ONLINE_TAG}</head><body><p id="m">Loading…</p>
<script>
// Вход: роль определяет стартовую страницу (склад — спецификации, остальные — формы заказа).
HSD.init({}).then(function (me) { location.replace(me.role === 'warehouse' ? 'specs.html' : 'forms.html'); })
  .catch(function (e) { document.getElementById('m').textContent = e.message; });
</script></body></html>
`;

export function buildCatalyst(outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const page of PAGES) build(page, outDir, { before: ONLINE_TAG });
  for (const name of Object.keys(SECTIONAL_PATCHES)) {
    writeFileSync(join(outDir, name), patchSectional(name, readFileSync(join(root, 'sectional', name), 'utf8')));
    console.log(`${name}: секционная страница, онлайн-хранение`);
  }
  copyFileSync(join(root, 'web/hsd-online.js'), join(outDir, 'hsd-online.js'));
  copyFileSync(join(root, 'web/import.html'), join(outDir, 'import.html')); // перенос папки с ПК (админ)
  writeFileSync(join(outDir, 'index.html'), INDEX_HTML);
  writeFileSync(join(outDir, 'client-package.json'), JSON.stringify({ name: 'app', version: '1.0.0', homepage: 'index.html' }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildCatalyst(resolve(process.argv[2] || join(root, 'catalyst/client')));
}
