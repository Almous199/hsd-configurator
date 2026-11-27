// Эталон: DSO-26659 Type 2, 2000×2600, алюминий, 0,75 кВт, мотор слева, 5 ворот.
// Ожидаемые числа посчитаны вручную по согласованным формулам (бриф, журнал решений 25.11.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateHsr, exportAssemblyCsv } from '../products/hsr/index.js';
import { cat, loadOrder, line, codes } from './helpers.js';

const doc = loadOrder('DSO-26659');
const { calc, spec } = calculateHsr(doc, cat, { now: '2026-11-25T00:00:00+07:00' });

test('расчёт не заблокирован', () => {
  assert.equal(calc.status, 'ok', JSON.stringify(calc.errors));
});

test('рама: S 274×234, φ114, длины по W+230 / W+120 / H+200', () => {
  const f = calc.frame;
  assert.equal(f.sidePlate, 'S');
  assert.equal(f.shaftDiameter, 114);
  assert.equal(f.boxLength, 2230);
  assert.equal(f.shaftLength, 2120);
  assert.equal(f.beamLength, 2229);
  assert.equal(f.guideLength, 2800);
  assert.equal(f.overallHeight, 3070);
  assert.equal(f.sketch.overallWidth, 2530); // как на чертеже DSO-26659
  assert.equal(f.sketch.headerDepth, 235);
  assert.equal(f.sketch.headerHeight, 270);
});

test('полотно: ширина W+140, длина H+200+137+π·114, стандартная раскладка строки 2500', () => {
  const c = calc.curtain;
  assert.equal(c.width, 2140);
  assert.equal(c.cutWidth, 2390);
  assert.equal(c.length, 3295);
  assert.equal(c.layoutTableH, 2500);
  assert.equal(c.windbars, 2);
  assert.deepEqual(c.sections.map((s) => s.h), [1000, 570, 1510]);
  assert.equal(c.topVisible, 815);
  assert.deepEqual(c.sections.map((s) => s.transparent), [false, true, false]);
  assert.equal(c.sections[0].cut, 1094);
  assert.equal(c.sections[1].filmCut, 560);
  assert.equal(c.sections[2].cut, 1677);
  assert.equal(c.windows[0].bottomFromFloor, 1175);
  assert.equal(c.rollDiameter, 153);
});

test('привод: A2 0,75 кВт, RV50 1:20, кабеля в комплекте хватает', () => {
  const d = calc.drive;
  assert.equal(d.motorSku, 'A2-PE200motor');
  assert.equal(d.gearbox, 'RV50');
  assert.equal(d.ratio, '1:20');
  assert.equal(d.plateSku, 'LF-R039');
  assert.equal(d.motorCoverSku, 'LF-R005-S-0.75-L');
  assert.equal(d.cableLength, 3070 - 1200 + 1000);
  assert.equal(d.cableToBuy, 0);
});

test('ткань: синий ПВХ 1100 г/м² — PVC-0.8-blue, все SKU есть', () => {
  assert.equal(calc.curtain.pvc.sku, 'PVC-0.8-blue');
  assert.ok(!codes(calc).includes('PVC_NO_SKU'));
  assert.deepEqual(spec.missingSku, []);
});

test('сетка бывает только жёлтая (PVCM-1.0-yellow); другой цвет сетки — предупреждение', () => {
  const run = (pvc) => calculateHsr({ ...doc, options: { ...doc.options, pvc } }, cat, { now: '2026-11-25T00:00:00+07:00' });
  const y = run('mesh-yellow');
  assert.equal(y.calc.curtain.pvc.sku, 'PVCM-1.0-yellow');
  assert.deepEqual(y.spec.missingSku, []);
  const b = run('mesh-blue');
  assert.ok(codes(b.calc).includes('PVC_NO_SKU'));
  assert.deepEqual(b.spec.missingSku, ['pvc']);
});

test('спецификация на одни ворота в единицах Zoho', () => {
  const expect = {
    'PVC-2-tr': 1.338,
    'LF-R031': 4.28, 'LF-R032': 2, 'LF-R033': 2.14, 'LF-R035': 1, 'LF-R036': 2.14, 'LF-R043': 10.7,
    'LF-R001-S': 2.23, 'LF-R002-S': 1, 'LF-R007-114': 2.12, 'LF-R006-114': 4, 'LF-R008': 1, 'LF-R009': 1,
    'LF-R013': 2, 'LF-R022': 1, 'MET50x25': 4.458,
    'LF-R025': 5.6, 'LF-R026': 11.2, 'LF-R027': 11.2, 'LF-R028': 5.6, 'LF-R004': 2, 'LF-R029': 2, 'LF-R011': 4, 'LF-R041': 2,
    'A2-PE200motor': 1, 'A2control': 1, 'LF-R039': 1, 'LF-R012': 1, 'LF-R005-S-0.75-L': 1, 'WSD-001': 1,
  };
  for (const [sku, qty] of Object.entries(expect)) {
    const l = line(spec, sku);
    assert.ok(l, `нет строки ${sku}`);
    assert.equal(l.qty, qty, sku);
  }
  const pvc = spec.lines.find((l) => l.partId === 'pvc');
  assert.equal(pvc.qty, 7.024); // 2390 × (1094 + 2·84 + 1677)
  assert.equal(line(spec, 'HSD 5005'), undefined); // докупать кабель не нужно
  assert.equal(line(spec, 'Orca').qty, 1); // аксессуары из заказа входят в сборку SDA-DS (Alex 26.11)
  assert.equal(line(spec, 'Orca').section, 'drive');
  assert.equal(spec.bundleNumber, 'BUN-26659-2');
});

test('CSV сборки не выпускается, пока у ткани нет SKU', () => {
  const d = { ...doc, options: { ...doc.options, pvc: 'orange' } };
  const out = exportAssemblyCsv(d, calculateHsr(d, cat), cat, { date: '2026-11-25' });
  assert.ok(out.problems.some((p) => p.includes('нет SKU')));
  assert.deepEqual(exportAssemblyCsv(doc, { calc, spec }, cat, { date: '2026-11-25' }).problems, []);
});

test('ручная раскладка с чертежа (4 ветровика, окно 3-я секция)', () => {
  const manual = structuredClone(doc);
  manual.options.overrides = [{ path: 'curtain.sections', value: [460, 410, 510, 560], reason: 'Доп. ветровики по просьбе заказчика' }];
  manual.options.transparentSections = [3];
  const r = calculateHsr(manual, cat);
  assert.equal(r.calc.status, 'ok');
  assert.equal(r.calc.curtain.windbars, 4);
  assert.equal(r.calc.curtain.topVisible, 365);
  assert.equal(r.calc.curtain.sections.at(-1).h, 1060);
  assert.equal(line(r.spec, 'LF-R031').qty, 8.56);
  assert.equal(line(r.spec, 'LF-R043').qty, 19.26);
});

test('намотка с утолщением: Ø рулона открытых ворот и разнос ветровиков', () => {
  const w = calc.curtain.winding;
  assert.equal(calc.curtain.rollDiameter, w.rollDiameter);
  assert.equal(w.bars.length, 2);
  assert.ok(w.okAngle, `мин. угол ${w.minAngle}`);
  assert.ok(w.minAngle > 160 && w.minAngle <= 180, String(w.minAngle));
  // висит от рулона до верха проёма: 200 + 274/2 − 57 = 280
  assert.equal(w.woundLength, Math.round(calc.curtain.lengthExact - 280));
});

test('высоты по центрам ветровиков: нижняя от низа резинки, верхняя до низа короба, сумма H+200', () => {
  const c = calc.curtain;
  assert.deepEqual(c.pitches, [1155, 610, 1035]);
  assert.deepEqual(c.barCentres, [1155, 1765]);
  assert.equal(c.pitches.reduce((a, b) => a + b, 0), 2600 + 200);
});

test('фотоэлементы: 1 пара на 400 по умолчанию, вторая пара удваивает кронштейны', () => {
  assert.equal(line(spec, 'LF-R041').qty, 2);
  const two = calculateHsr({ ...doc, options: { ...doc.options, photocells: { pairs: 2, levels: [400, 1000] } } }, cat);
  assert.equal(line(two.spec, 'LF-R041').qty, 4);
  const bad = calculateHsr({ ...doc, options: { ...doc.options, photocells: { pairs: 1, levels: [2700] } } }, cat);
  assert.ok(codes(bad.calc).includes('PHOTOCELL_LEVEL'));
});
