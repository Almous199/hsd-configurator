// Высоты секций в калькуляторе — по центрам ветровиков (Alex 26.11.2026):
//   нижняя — от низа резинового уплотнителя до центра 1-го ветровика,
//   средние — от центра до центра,
//   верхняя — от центра последнего ветровика до низа короба (H + 200).
//   Сумма = H + 200. Эффективные высоты полотна и раскрой — только в спецификации.
// Перевод: нижняя = 50 (резинка) + 85 (нижний профиль) + h + 20; средняя = h + 40; верхняя = h_видимая + 20 + 200.

/** Шаги по центрам ветровиков снизу вверх из эффективных высот (below — секции ниже верхней). */
export function pitchesFromEffective(below, topVisible, cur) {
  const e = cur.effective;
  const half = e.windbar / 2;
  const out = below.map((h, i) => (i === 0 ? e.bottomRubber + e.bottomProfile + h + half : h + e.windbar));
  out.push(topVisible + half + cur.guideAboveOpening);
  return out;
}

/** Эффективные высоты секций ниже верхней из шагов по центрам (последний шаг — верхняя, не нужен). */
export function effectiveFromPitches(pitches, cur) {
  const e = cur.effective;
  const half = e.windbar / 2;
  return pitches.slice(0, -1).map((P, i) => Math.round(i === 0 ? P - e.bottomRubber - e.bottomProfile - half : P - e.windbar));
}

/** Высоты центров ветровиков от низа уплотнителя. */
export function barCentres(pitches) {
  const out = [];
  let z = 0;
  for (let i = 0; i < pitches.length - 1; i++) { z += pitches[i]; out.push(z); }
  return out;
}
