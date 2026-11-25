// Собирает форму заказа в один HTML-файл: dist/sda-order-form.html.
// Модули ядра и формы встраиваются как текст и подключаются через blob:-URL (порядок — от листьев к форме),
// каталоги встраиваются в window.__CATALOGS__. Файл открывается двойным щелчком, без сервера и интернета.
// Запуск: npm run build (dist/ лежит в репозитории, чтобы файл можно было скачать с GitHub; тест сверяет его со свежей сборкой)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogs } from '../core/load-catalogs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_RE = /^import\s+[^;]*?\s+from\s+'(\.{1,2}\/[^']+)';?$/gm;

// Обход графа модулей: post-order, чтобы зависимости шли раньше.
const order = [];
const sources = new Map();
function visit(abs) {
  if (sources.has(abs)) return;
  const src = readFileSync(abs, 'utf8');
  sources.set(abs, src);
  for (const m of src.matchAll(IMPORT_RE)) visit(resolve(dirname(abs), m[1]));
  order.push(abs);
}
const entry = join(root, 'web/app.js');
visit(entry);

const key = (abs) => relative(root, abs).replaceAll('\\', '/');
const modules = order.map((abs) => ({
  key: key(abs),
  // относительные пути импорта → ключи модулей; загрузчик заменит их на blob:-URL
  src: sources.get(abs).replace(IMPORT_RE, (line, spec) => line.replace(`'${spec}'`, `'@mod:${key(resolve(dirname(abs), spec))}'`)),
}));

const catalogs = loadCatalogs().hsr;
const json = (v) => JSON.stringify(v).replaceAll('</', '<\\/');

const loader = `
window.__CATALOGS__ = ${json(catalogs)};
(function () {
  const mods = ${json(modules)};
  const urls = {};
  for (const m of mods) {
    const src = m.src.replace(/'@mod:([^']+)'/g, (_, k) => "'" + urls[k] + "'");
    urls[m.key] = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  }
  import(urls[${json(key(entry))}]).catch((e) => {
    document.body.insertAdjacentHTML('afterbegin', '<pre style="color:#b00;padding:12px">Ошибка запуска: ' + String(e && e.stack || e).replace(/</g, '&lt;') + '</pre>');
  });
})();`;

let html = readFileSync(join(root, 'web/index.html'), 'utf8');
const tag = '<script type="module" src="./app.js"></script>';
if (!html.includes(tag)) throw new Error(`В web/index.html нет строки ${tag}`);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
html = html.replace(tag, () => `<!-- собрано scripts/build-standalone.js, ${pkg.name} ${pkg.version} -->\n<script>${loader}\n</script>`);

const out = resolve(process.argv[2] || join(root, 'dist/sda-order-form.html'));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${relative(root, out)}: ${modules.length} модулей, ${(html.length / 1024).toFixed(0)} КБ`);
