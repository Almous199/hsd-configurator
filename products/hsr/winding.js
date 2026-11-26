// Намотка полотна на вал с утолщением от профилей (тред 02; калькулятор SDA, Alex 26.11.2026).
//
// Модель взята из инструмента «raschet-namotki-vorot» (режим «Account for thickening»):
//   рулон делится на 720 угловых секторов; каждый сектор растёт на толщину полотна с каждым витком,
//   а там, где лежит профиль (ветровик высотой 50 мм вдоль полотна), — на толщину профиля в рулоне (13 мм).
//   Следующие витки ложатся поверх этого бугра.
// Ворота открыты: нижний профиль стоит у верхней кромки проёма, ниже короба. Наматывается полотно
//   от крепления на валу до точки, где полотно уходит с рулона вниз; участок от рулона до верха проёма
//   висит свободно, нижний профиль на вал не наматывается.
//   Длина намотки = длина полотна − (200 + Hб/2 − R вала): от верха проёма до центра вала, минус радиус вала.
// Позиции ветровиков считаются от крепления на валу: верхняя секция целиком (видимая часть, участок под
//   коробом и на валу), затем центр ветровика, и так вниз.

/**
 * @param {object} p
 * @param {number} p.shaftDia        диаметр вала, мм
 * @param {number} p.length          длина полотна, мм (H + 200 + Hб/2 + π·D)
 * @param {number} p.hangLength      свободно висящий участок в открытых воротах, мм
 * @param {Array}  p.sections        секции снизу вверх: { h, transparent } (эффективные высоты; последняя — верхняя целиком)
 * @param {number} p.windbar         эффективная высота ветровика (40)
 * @param {number} p.windbarOuter    наружная высота ветровика (50) — длина бугра вдоль полотна
 * @param {number} p.tPvc            толщина ПВХ в рулоне
 * @param {number} p.tClear          толщина прозрачной плёнки
 * @param {number} p.tProfile        толщина ветровика в рулоне
 * @param {boolean} [p.withPath]     вернуть точки спирали для рисования
 */
export function windCurtain(p) {
  const R0 = p.shaftDia / 2;
  const secs = p.sections;
  const n = secs.length - 1;

  // Позиции вдоль полотна от крепления на валу (сверху вниз)
  const bars = new Array(n);
  const clearRanges = [];
  let s = 0;
  for (let i = secs.length - 1; i >= 0; i--) {
    const start = s;
    s += secs[i].h;
    if (secs[i].transparent) clearRanges.push([start, s]);
    if (i > 0) { bars[i - 1] = s + p.windbar / 2; s += p.windbar; }
  }
  const wound = Math.max(0, p.length - p.hangLength);

  const N = 720; const bw = (2 * Math.PI) / N; const buf = new Float64Array(N);
  const dL = 1; const half = p.windbarOuter / 2;
  let th = 0; let L = 0;
  const hit = new Array(n);
  const path = [];
  const bin = (a) => ((Math.floor(a / bw) % N) + N) % N;
  while (L < wound) {
    const r = R0 + buf[bin(th)];
    let t = clearRanges.some(([a, b]) => L >= a && L < b) ? p.tClear : p.tPvc;
    for (let k = 0; k < n; k++) if (L >= bars[k] - half && L <= bars[k] + half) { t = Math.max(t, p.tProfile); break; }
    for (let k = 0; k < n; k++) if (hit[k] === undefined && bars[k] <= wound && L <= bars[k] && L + dL > bars[k]) hit[k] = { theta: th, r };
    const thN = th + dL / r;
    const nb = Math.floor(thN / bw) - Math.floor(th / bw);
    const b0 = Math.floor(th / bw);
    for (let q = 1; q <= nb; q++) buf[(((b0 + q) % N) + N) % N] += t;
    if (p.withPath && Math.round(L) % 6 === 0) path.push([round1(th), round1(r)]);
    th = thN; L += dL;
  }
  let rMax = R0;
  for (let q = 0; q < N; q++) rMax = Math.max(rMax, R0 + buf[q]);

  // Углы ветровиков на рулоне (по часовой от верха), минимальный разнос и идеал 360/n
  const wbars = bars.map((pos, k) => {
    const h = hit[k];
    return h ? { pos: Math.round(pos), angle: round1(((h.theta * 180) / Math.PI) % 360), r: round1(h.r), theta: h.theta }
      : { pos: Math.round(pos), angle: null, r: null, theta: null, unwound: true };
  });
  const angles = wbars.filter((b) => b.angle != null).map((b) => b.angle).sort((a, b) => a - b);
  let minAngle = 360;
  for (let i = 0; i < angles.length; i++) {
    const d = i < angles.length - 1 ? angles[i + 1] - angles[i] : angles[0] + 360 - angles[i];
    if (angles.length > 1) minAngle = Math.min(minAngle, d);
  }
  const ideal = n > 0 ? 360 / n : 360;
  return {
    woundLength: Math.round(wound),
    rollDiameter: Math.round(2 * rMax),
    bars: wbars,
    minAngle: round1(minAngle),
    idealAngle: round1(ideal),
    okAngle: minAngle >= 0.8 * ideal - 1e-9,
    ...(p.withPath ? { path } : {}),
  };
}

const round1 = (v) => Math.round(v * 10) / 10;
