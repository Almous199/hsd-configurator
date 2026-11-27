// Ручные отступления от расчёта хранятся во входе: options.overrides = [{ path, value, reason }].
// Без причины override не принимается (схема заказа v1, тред 00).
import { error } from './messages.js';

/**
 * Возвращает override по пути или undefined.
 * Если override есть, но без причины, кладёт ошибку в messages и возвращает undefined.
 */
export function getOverride(options, path, messages) {
  const list = (options && options.overrides) || [];
  const found = list.filter((o) => o && o.path === path);
  if (found.length === 0) return undefined;
  const o = found[found.length - 1];
  if (!o.reason || !String(o.reason).trim()) {
    messages.push(error('OVERRIDE_NO_REASON', { ru: `Ручная замена «${path}» без причины не принимается`, en: `Manual change «${path}» needs a reason`, th: `การเปลี่ยน «${path}» ด้วยมือต้องระบุเหตุผล` }, { path }));
    return undefined;
  }
  return o;
}
