# Онлайн-версия на Zoho Catalyst

Проект Catalyst DOORHAN SIAM, дата-центр EU: консоль `console.catalyst.zoho.eu`, org `20121815916`, project `39511000000014024`.
План и решения: Claude Doc «SDA онлайн на Zoho Catalyst» (27.11.2026).

## Что где

| Часть | Где | Что делает |
|---|---|---|
| Веб-клиент | `client/` (собирается `npm run build:catalyst`, в git нет) | forms.html, sda-order-form.html, sda-calculator.html, specs.html, door_calculator.html, import.html, index.html |
| Функция `api` | `functions/api/` | `/server/api/me` — кто вошёл и роль; `/server/api/fs/<путь>` — облачная «рабочая папка» |
| Документы | Stratus, бакет `hsd-docs` (env `STRATUS_BUCKET`) | те же файлы, что в папке Door calculation tool: `forms/…`, `calcs/…`, `catalog.json`, `orders.json` |
| Вход | Catalyst Authentication | пользователи по приглашению; роль Catalyst → роль приложения |

Роли: **App Administrator** → admin (всё); роль с «Warehouse» в названии → warehouse (спецификации и каталог только чтение);
любая другая (App User) → manager (формы заказа; спецификации не видит; замороженную форму не правит).

## Настройка в консоли (один раз, делает администратор)

1. **Cloud Scale → Authentication**: включить, тип входа — Hosted (готовая страница входа). Публичную регистрацию не включать.
2. **Cloud Scale → Authentication → Roles**: добавить роль `Warehouse`.
3. **Stratus**: создать бакет `hsd-docs`, включить версионирование (история правок). Если имя занято — другое имя и поменять `STRATUS_BUCKET` в `functions/api/catalyst-config.json`.
4. **Users**: пригласить менеджеров (роль App User) и кладовщика (роль Warehouse) по почте.

## Выкладка

GitHub Actions `.github/workflows/catalyst-deploy.yml`: при merge в main — тесты, сборка, `catalyst deploy` в Development.
Нужен секрет репозитория `CATALYST_TOKEN` (`catalyst token:generate` на аккаунт администратора).
В Production — кнопка «Deploy to Production» в консоли после проверки.

## Перенос данных с ПК

Администратор открывает `import.html` в онлайн-версии (Chrome / Edge) и выбирает папку Door calculation tool.
Файлы копируются в облако, папка на ПК не меняется.

## Локальная проверка без Catalyst

`npm run serve:catalyst -- --dir "<папка Door calculation tool>"` → `http://localhost:8790/app/?as=admin` (или `manager`, `warehouse`).
Хранилище в памяти, вход имитируется.
