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

test('сетки ПВХ blue 1100 нет в Zoho — предупреждение и пустой SKU', () => {
  assert.ok(codes(calc).includes('PVC_NO_SKU'));
  assert.deepEqual(spec.missingSku, ['pvc']);
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
  assert.equal(line(spec, 'Orca'), undefined); // аксессуары идут отдельной строкой SO
  assert.equal(spec.bundleNumber, 'BUN-26659-2');
});

test('CSV сборки не выпускается, пока у ткани нет SKU', () => {
  const out = exportAssemblyCsv(doc, { calc, spec }, cat, { date: '2026-11-25' });
  assert.ok(out.problems.some((p) => p.includes('нет SKU')));
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
