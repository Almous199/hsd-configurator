// Полотно SDA (тред 02, Alex 25.11.2026).
//   Ширина готовая (Lefast D9): алюм. W+140, нерж. W+105; раскрой по ширине +250 запас.
//   Длина полотна = H + 200 + Hб/2 + π·D: от пола до верха направляющей, до центра вала, плюс один оборот.
//   Цепочка эффективных высот: 85 (низ LF-R033) + 50 (резинка LF-R036) + Σh + 40·n = длина полотна.
//   Раскрой по высоте: непрозрачная h+94; прозрачная: плёнка h−10 + 2 полосы ткани по 84; верхняя h+47+120.
//   Ветровик и нижний профиль — длина = ширина полотна (Lefast N10/N12); нейлон (2n+1) × ширина.
//   Ветровик и низ HJG-1792/1793 до ширины полотна 5000, шире — усиленный (артикула нет).
import { error, warning } from '../../core/messages.js';
import { calcLayout } from './layout.js';
import { windCurtain } from './winding.js';
import { pitchesFromEffective, barCentres } from './pitch.js';

export function calcCurtain(inp, frame, cat, messages) {
  const cur = cat.curtain;
  const guide = cat.guides.items.find((g) => g.id === frame.guide);
  const width = inp.W + guide.offsets.curtainWidth;
  const cutWidth = width + cur.cut.widthMargin;

  const D = frame.shaftDiameter;
  const plateH = frame.sidePlateSize.h;
  const lengthExact = inp.H + cur.guideAboveOpening + plateH / 2 + Math.PI * D;
  const length = Math.round(lengthExact);

  const layout = calcLayout(inp, D, cat, messages);
  if (!layout) return null;
  const { below, windbars } = layout;

  const bottomZone = cur.effective.bottomProfile + cur.effective.bottomRubber;
  const topEff = length - bottomZone - below.reduce((a, b) => a + b, 0) - cur.effective.windbar * windbars;

  // Секции снизу вверх с раскроем
  const sections = [];
  below.forEach((h, i) => {
    const no = i + 1;
    const transparent = layout.transparent.includes(no);
    const s = { no, h, transparent };
    if (transparent) {
      s.filmCut = h - cur.cut.windowFilmMinus;
      s.stripCut = cur.cut.windowStrip;
      s.strips = cur.cut.windowStripsPerSection;
    } else {
      s.cut = h + cur.cut.opaque;
    }
    sections.push(s);
  });
  sections.push({
    no: below.length + 1, h: topEff, top: true, visible: layout.topVisible, transparent: false,
    cut: topEff + cur.cut.topBottom + cur.cut.topPocket,
  });
  for (const s of sections) if (s.transparent) s.clearVisible = s.h - 70; // прозрачной остаётся h−70 (Alex 25.11)

  // ПВХ по площади раскроя, без процента отхода (Alex 25.11)
  const pvcCutLength = sections.reduce((a, s) => a + (s.transparent ? s.stripCut * s.strips : s.cut), 0);
  const clearCutLength = sections.reduce((a, s) => a + (s.transparent ? s.filmCut : 0), 0);
  const pvcAreaMm2 = cutWidth * pvcCutLength;
  const clearAreaMm2 = cutWidth * clearCutLength;

  // Профили
  const windbar = cat.profiles.windbar.find((p) => width <= (p.maxCurtainWidth ?? Infinity) && (p.minCurtainWidthExclusive == null || width > p.minCurtainWidthExclusive));
  const bottom = cat.profiles.bottom.find((p) => width <= (p.maxCurtainWidth ?? Infinity) && (p.minCurtainWidthExclusive == null || width > p.minCurtainWidthExclusive));
  if (!windbar.sku || !bottom.sku) {
    messages.push(warning('REINFORCED_PROFILE', `Ширина полотна ${width} > 5000: нужен усиленный ветровик и нижний профиль, артикулов в Zoho нет`));
  }

  // Ткань
  const pvcSku = resolvePvcSku(inp.pvc, cat, messages);

  // Намотка с утолщением от профилей (winding.js): углы ветровиков на рулоне и Ø рулона открытых ворот.
  const t = inp.pvcThickness ?? cur.winding.pvcThickness;
  const tClear = inp.clearThickness ?? cur.winding.clearThickness;
  const tProfile = inp.profileThickness ?? cur.winding.profileThickness;
  const winding = windCurtain({
    shaftDia: D,
    length: lengthExact,
    hangLength: cur.guideAboveOpening + plateH / 2 - D / 2,
    sections: sections.map((x) => ({ h: x.h, transparent: x.transparent })),
    windbar: cur.effective.windbar,
    windbarOuter: cur.effective.windbarOuter,
    tPvc: t, tClear, tProfile,
  });
  const rollDiameter = winding.rollDiameter;
  if (windbars > 1 && !winding.okAngle) {
    messages.push(warning('WINDBARS_OVERLAP',
      `Ветровики на рулоне ближе ${Math.round(0.8 * winding.idealAngle)}° (мин. ${Math.round(winding.minAngle)}° при идеале ${Math.round(winding.idealAngle)}°)`));
  }

  // Высоты по центрам ветровиков (калькулятор): сумма = H + 200
  const pitches = pitchesFromEffective(below, layout.topVisible, cur);

  return {
    width,
    cutWidth,
    length,
    lengthExact: Math.round(lengthExact * 10) / 10,
    windbars,
    layoutSource: layout.source,
    layoutTableH: layout.tableRowH,
    sections,
    topVisible: layout.topVisible,
    windows: layout.windows,
    pvc: { id: inp.pvc, sku: pvcSku, cutLength: pvcCutLength, areaMm2: pvcAreaMm2 },
    clear: { sku: clearCutLength > 0 ? cat.profiles.pvc.window : null, cutLength: clearCutLength, areaMm2: clearAreaMm2 },
    windbarProfile: { id: windbar.id, sku: windbar.sku, plug: windbar.plug, nylon: windbar.nylonRod, length: width, qty: windbars },
    bottomProfile: { id: bottom.id, sku: bottom.sku, plug: bottom.plug, seal: bottom.seal, length: width },
    nylonLength: (2 * windbars + 1) * width,
    pvcThickness: t,
    clearThickness: tClear,
    profileThickness: tProfile,
    rollDiameter,
    winding,
    pitches,
    barCentres: barCentres(pitches),
  };
}

function resolvePvcSku(id, cat, messages) {
  const pvc = cat.profiles.pvc;
  if (id.startsWith('mesh-')) {
    const sku = pvc.mesh[id.slice(5)];
    if (!sku) messages.push(warning('PVC_NO_SKU', `Сетки ПВХ «${id}» нет в Zoho: строку ткани нужно дописать вручную`));
    return sku || null;
  }
  const sku = pvc.colors[id];
  if (!sku) messages.push(warning('PVC_NO_SKU', `ПВХ «${id}» нет в Zoho: строку ткани нужно дописать вручную`));
  return sku || null;
}
