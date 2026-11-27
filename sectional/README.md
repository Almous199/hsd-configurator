# Секционные страницы для онлайн-версии

Копии страниц проекта секционных ворот (решение Alex 27.11.2026: секционный калькулятор и specs.html тоже онлайн,
в этом репозитории и том же проекте Catalyst). Оригиналы живут в папке
`Nextcloud\Share\Claude\Web constructor\Door calculation tool` и там не меняются.

| Файл | Источник | Дата файла |
|---|---|---|
| `door_calculator.html` | `door_calculator v3.53.html` | 2026-11-27 |
| `specs.html` | `specs.html` (specs 1.0) | 2026-11-27 |

Файлы лежат **без правок**. Онлайн-режим добавляет сборка `npm run build:catalyst` (`scripts/build-catalyst.js`,
`SECTIONAL_PATCHES`): в начало функций хранения ставится ветка «если онлайн — облако вместо папки», ссылки между
страницами становятся соседними файлами. Расчёт и вид не меняются.

Новая версия калькулятора: скопировать последний `door_calculator vX.YY.html` сюда как `door_calculator.html`,
обновить таблицу, `npm test`. Если тест `catalyst-build` упал — изменился код хранения, поправить `SECTIONAL_PATCHES`.
