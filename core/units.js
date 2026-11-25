// Перевод единиц и округление. Расчёт везде в мм, в единицы Zoho переводим только в спецификации.

/** Округление до n знаков без хвостов двоичной арифметики. */
export function round(value, digits = 3) {
  const k = 10 ** digits;
  return Math.round((value + Number.EPSILON) * k) / k;
}

/** мм → м, 3 знака. */
export const mmToM = (mm) => round(mm / 1000, 3);

/** мм² → м², 3 знака. */
export const mm2ToM2 = (mm2) => round(mm2 / 1e6, 3);

/** Число для CSV: целое как есть, дробное — до 4 знаков без лишних нулей (как zoho_export.html). */
export function formatNum(n) {
  if (Number.isInteger(n)) return String(n);
  return parseFloat(n.toFixed(4)).toString();
}
