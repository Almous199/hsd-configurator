// Раскладка секций полотна (тред 02, тред 05; Alex 25.11.2026).
//
// Стандарт: число ветровиков — по высоте и валу (layouts.json → windbarsByHeight, предел Top1800
// по строкам Lefast, тред 02). Высоты секций ниже верхней — из строки стандартных раскладок того же
// вала и того же числа ветровиков с наибольшей H ≤ H заказа (если такой нет — с наименьшей H).
// Верхняя получает остаток. Окно — секция, помеченная в строке (всегда 2-я).
//
// Ручной «+» (не более двух): +1 делит нижнюю секцию, +2 делит нижнюю и верхнюю.
// Правило «с подгонкой по намотке» в коде пока заменено делением пополам —
// так же, как в макете формы (см. предупреждение LAYOUT_SPLIT_PROVISIONAL).
//
// Полностью ручная раскладка — override curtain.sections с причиной
// (массив эффективных высот снизу вверх без верхней секции).
import { error, warning } from '../../core/messages.js';
import { getOverride } from '../../core/overrides.js';

/** Видимая часть верхней секции: H = низ (85+50) + Σh + 40·n + верх_видимый. */
export function topVisibleOf(H, below, cur) {
  const n = below.length; // число ветровиков = число секций ниже верхней
  const sum = below.reduce((a, b) => a + b, 0);
  return H - (cur.effective.bottomProfile + cur.effective.bottomRubber) - sum - cur.effective.windbar * n;
}

/** Число ветровиков по высоте проёма и валу (пороги треда 02). */
export function windbarsFor(H, shaftDia, layouts) {
  const steps = layouts.windbarsByHeight[String(shaftDia)];
  for (const st of steps) if (st.maxH == null || H <= st.maxH) return st.windbars;
  return steps[steps.length - 1].windbars;
}

export function calcLayout(inp, shaftDia, cat, messages) {
  const cur = cat.curtain;
  const { H } = inp;
  let below;
  let windowSection;
  let source;
  let tableRowH = null;

  const ov = getOverride(inp.options, 'curtain.sections', messages);
  if (ov) {
    if (!Array.isArray(ov.value) || ov.value.length < 1 || ov.value.some((v) => !(v > 0))) {
      messages.push(error('LAYOUT_MANUAL', 'Ручная раскладка: нужен массив высот секций снизу вверх без верхней'));
      return null;
    }
    below = ov.value.map((v) => Math.round(v));
    windowSection = null;
    source = 'manual';
    messages.push(warning('OVERRIDE_APPLIED', `Раскладка секций задана вручную: ${ov.reason}`));
  } else {
    const n = windbarsFor(H, shaftDia, cat.layouts);
    const rows = cat.layouts.rows.filter((r) => r.shaftDia === shaftDia && r.windbars === n).sort((a, b) => a.H - b.H);
    let row = null;
    for (const r of rows) if (r.H <= H) row = r;
    if (!row) {
      row = rows[0];
      if (H < row.H && n === 2) messages.push(warning('LAYOUT_BELOW_TABLE', `H ${H} ниже таблицы раскладок (от ${row.H}), взята строка ${row.H}`));
    }
    below = row.sectionsBelowTop.slice();
    windowSection = row.windowSection;
    source = 'standard';
    tableRowH = row.H;

    const extra = inp.extraWindbars;
    if (extra) {
      if (!Number.isInteger(extra) || extra < 0 || extra > cur.manualExtraWindbarsMax) {
        messages.push(error('EXTRA_WINDBARS', `Ручной «+»: от 0 до ${cur.manualExtraWindbarsMax}`));
        return null;
      }
      // +1: делим нижнюю секцию, окно поднимается на одну секцию
      const b = below[0];
      const lower = Math.floor(b / 2);
      below.splice(0, 1, lower, b - lower);
      windowSection += 1;
      if (extra === 2) {
        // +2: делим и верхнюю. Новый ветровик отнимает 40, остаток видимой части делим пополам.
        const tv = topVisibleOf(H, below, cur);
        const mid = Math.round((tv - cur.effective.windbar) / 2);
        below.push(mid);
      }
      source = `standard+${extra}`;
      messages.push(warning('LAYOUT_SPLIT_PROVISIONAL',
        'Дополнительные ветровики разделили секции пополам; подгонка по намотке ещё не подключена'));
    }
  }

  const windbars = below.length;
  if (windbars < cat.profiles.windbarCount.min || windbars > cat.profiles.windbarCount.max) {
    messages.push(error('WINDBAR_COUNT', `Ветровиков ${windbars}, допустимо ${cat.profiles.windbarCount.min}–${cat.profiles.windbarCount.max}`));
  }
  const topVisible = topVisibleOf(H, below, cur);
  if (topVisible <= 0) {
    messages.push(error('TOP_SECTION_NEGATIVE', `Секции не помещаются в высоту ${H}: верхняя секция ${topVisible} мм`));
  }
  if (topVisible + cur.guideAboveOpening > cur.topLimitAboveGuide) {
    messages.push(warning('TOP_SECTION_LONG',
      `Верхняя секция до верха направляющей ${topVisible + cur.guideAboveOpening} мм больше Top${cur.topLimitAboveGuide}`));
  }

  // Прозрачные секции: номера снизу, 1 — нижняя. По умолчанию окно из раскладки.
  let transparent = inp.transparentSections;
  if (!transparent) transparent = windowSection ? [windowSection] : [];
  const sectionsCount = windbars + 1;
  for (const t of transparent) {
    if (!Number.isInteger(t) || t < 1 || t >= sectionsCount) {
      messages.push(error('TRANSPARENT_SECTION', `Прозрачной может быть секция 1…${sectionsCount - 1}, не ${t} (верхняя наматывается на вал)`));
    }
  }

  // Низ окна от пола (для проверки ≤ 1200 после «+»)
  const bottomZone = cur.effective.bottomProfile + cur.effective.bottomRubber;
  const sectionBottom = (idx) => bottomZone
    + below.slice(0, idx - 1).reduce((a, b) => a + b, 0) + cur.effective.windbar * (idx - 1);
  const windows = transparent.filter((t) => t >= 1 && t < sectionsCount)
    .map((t) => ({ section: t, bottomFromFloor: sectionBottom(t) }));
  if (inp.extraWindbars && windows.length) {
    const low = Math.min(...windows.map((w) => w.bottomFromFloor));
    if (low > cur.windowBottomMax) {
      messages.push(warning('WINDOW_TOO_HIGH', `Низ окна ${low} мм выше ${cur.windowBottomMax} мм от пола`));
    }
  }

  return { source, tableRowH, below, windbars, sectionsCount, topVisible, transparent, windows };
}
