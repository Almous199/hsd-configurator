// Собирает форму заказа в один HTML-файл: dist/sda-order-form.html.
// Модули ядра и формы превращаются в функции одного обычного скрипта (порядок — от листьев к форме),
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

// Модуль ESM → тело функции: import → чтение из реестра, export → обычное объявление + запись в exports.
// Поддерживаются только формы, которые есть в коде: `import { a, b } from './x.js'`, `export function`, `export const`.
function toFunctionBody(abs) {
  const names = [];
  let src = sources.get(abs)
    .replace(IMPORT_RE, (line, spec) => {
      const m = line.match(/^import\s+\{([^}]*)\}\s+from/);
      if (!m || /\bas\b/.test(m[1])) throw new Error(`${key(abs)}: неподдерживаемый import: ${line}`);
      return `const {${m[1]}} = __mods[${JSON.stringify(key(resolve(dirname(abs), spec)))}];`;
    })
    .replace(/^export\s+(async\s+function|function|const|let)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => { names.push(name); return `${kind} ${name}`; });
  if (/^\s*(import|export)\b/m.test(src)) throw new Error(`${key(abs)}: остался import/export, сборщик его не понимает`);
  return `${src}\nObject.assign(__exports, { ${names.join(', ')} });`;
}

const catalogs = loadCatalogs().hsr;
const json = (v) => JSON.stringify(v).replaceAll('</', '<\\/');

// Обычный (не module) скрипт: без import(), blob: и fetch — работает и из file://, и в просмотрщиках со строгими правилами.
const loader = `
window.__CATALOGS__ = ${json(catalogs)};
(async function () {
  const __mods = {};
  const __run = async (k, fn) => { const __exports = {}; await fn(__exports); __mods[k] = __exports; };
  try {
${order.map((abs) => `    await __run(${JSON.stringify(key(abs))}, async function (__exports) {\n${toFunctionBody(abs).replace(/<\/script/gi, '<\\/script')}\n    });`).join('\n')}
  } catch (e) {
    document.body.insertAdjacentHTML('afterbegin', '<pre style="color:#b00;padding:12px;white-space:pre-wrap">Ошибка запуска: ' + String(e && e.stack || e).replace(/</g, '&lt;') + '</pre>');
  }
})();`;

let html = readFileSync(join(root, 'web/index.html'), 'utf8');
const tag = '<script type="module" src="./app.js"></script>';
if (!html.includes(tag)) throw new Error(`В web/index.html нет строки ${tag}`);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
html = html.replace(tag, () => `<!-- собрано scripts/build-standalone.js, ${pkg.name} ${pkg.version} -->\n<script>${loader}\n</script>`);

const out = resolve(process.argv[2] || join(root, 'dist/sda-order-form.html'));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${relative(root, out)}: ${order.length} модулей, ${(html.length / 1024).toFixed(0)} КБ`);
