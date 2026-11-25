// Доступ к каталогу артикулов. Каталоги передаются объектом, ядро не читает файлы само
// (один и тот же код работает на сервере Catalyst, в тестах и в браузере).

export function indexItems(itemsCatalog) {
  const bySku = new Map();
  for (const it of itemsCatalog.items) bySku.set(it.sku, it);
  return bySku;
}

/** Артикул по SKU или исключение: опечатка в каталоге должна ломать тесты, а не спецификацию. */
export function requireItem(bySku, sku) {
  const it = bySku.get(sku);
  if (!it) throw new Error(`SKU ${sku} нет в catalogs/hsr/items.json`);
  return it;
}
