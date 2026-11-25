// Правила выбора по журналу решений 25.11.2026: границы рамы, мотора, раскладки.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateHsr } from '../products/hsr/index.js';
import { cat, order, line, codes } from './helpers.js';

const run = (W, H, o) => calculateHsr(order(W, H, o), cat);

test('рама: 4000×4000 ещё S/φ114, шаг за границу → M/φ140', () => {
  assert.equal(run(4000, 4000).calc.frame.sidePlate, 'S');
  assert.equal(run(4001, 4000).calc.frame.sidePlate, 'M');
  assert.equal(run(3000, 4001).calc.frame.shaftDiameter, 140);
  assert.equal(run(3000, 4001).calc.frame.overallHeight, 4521);
});

test('проём больше 28 м² не допускается: 6000×5000, 6000×6000', () => {
  for (const [W, H] of [[6000, 5000], [6000, 6000]]) {
    const { calc, spec } = run(W, H);
    assert.equal(calc.status, 'blocked');
    assert.ok(codes(calc).includes('NOT_AVAILABLE'));
    assert.equal(spec, null);
  }
  assert.equal(run(4666, 6000).calc.status, 'ok'); // 27,996 м²
});

test('мотор по каталогу Powever: φ140 до 14 м² — 0,75, до 28 — 1,5', () => {
  assert.equal(run(4500, 3100).calc.drive.powerKw, 0.75); // 13,95 м²
  assert.equal(run(4500, 3200).calc.drive.powerKw, 1.5);  // 14,4 м²
  const big = run(5000, 5000).calc.drive;                  // 25 м²
  assert.equal(big.gearbox, 'RV63');
  assert.equal(big.ratio, '1:15');
  assert.equal(big.plateSku, 'LF-R003');
  assert.equal(big.bumpers, 2);
  assert.equal(big.motorCoverSku, 'LF-R005-M-1.5-L');
  assert.equal(run(4000, 4000).calc.drive.powerKw, 0.75); // φ114, 16 м²
});

test('ручная замена мотора без причины не принимается', () => {
  const r = run(3000, 3000, { overrides: [{ path: 'drive.motor', value: 'a2-1.5' }] });
  assert.ok(codes(r.calc).includes('OVERRIDE_NO_REASON'));
  const ok = run(3000, 3000, { overrides: [{ path: 'drive.motor', value: 'a2-1.5', reason: 'запас' }] });
  assert.equal(ok.calc.drive.powerKw, 1.5);
});

test('ручная замена боковины S → M с причиной', () => {
  const r = run(3000, 3000, { overrides: [{ path: 'frame.sidePlate', value: 'M', reason: 'запас по ветру' }] });
  assert.equal(r.calc.frame.sidePlate, 'M');
  assert.equal(r.calc.frame.sidePlateAuto, 'S');
  assert.equal(r.calc.frame.shaftDiameter, 140);
});

test('таблица раскладок воспроизводится формулой длины полотна (±1 мм)', () => {
  for (const row of cat.layouts.rows) {
    const W = row.shaftDia === 114 ? 3000 : 4001;
    const plateOv = row.shaftDia === 140 && row.H <= 4000
      ? [{ path: 'frame.sidePlate', value: 'M', reason: 'тест' }] : [];
    const { calc } = run(W, row.H, { overrides: plateOv });
    const c = calc.curtain;
    assert.equal(calc.frame.shaftDiameter, row.shaftDia);
    assert.deepEqual(c.sections.slice(0, -1).map((s) => s.h), row.sectionsBelowTop, `φ${row.shaftDia} H${row.H}`);
    assert.equal(c.topVisible, row.topVisible, `видимая верхняя φ${row.shaftDia} H${row.H}`);
    assert.ok(Math.abs(c.sections.at(-1).h - row.topEff) <= 1, `верхняя φ${row.shaftDia} H${row.H}: ${c.sections.at(-1).h} vs ${row.topEff}`);
    assert.equal(c.windows[0].bottomFromFloor, row.windowBottomFromFloor);
    assert.ok(Math.abs(c.rollDiameter - row.rollDia) <= 3, `рулон φ${row.shaftDia} H${row.H}: ${c.rollDiameter} vs ${row.rollDia}`);
  }
});

test('ручной «+1» делит нижнюю секцию, окно поднимается на секцию', () => {
  const r = run(3000, 3000, { sections: { extraWindbars: 1 } }).calc;
  assert.deepEqual(r.curtain.sections.slice(0, 3).map((s) => s.h), [500, 500, 580]);
  assert.equal(r.curtain.windbars, 3);
  assert.deepEqual(r.curtain.windows.map((w) => w.section), [3]);
  assert.equal(r.curtain.windows[0].bottomFromFloor, 135 + 1000 + 80);
  assert.ok(codes(r).includes('LAYOUT_SPLIT_PROVISIONAL'));
});

test('ручной «+2» делит и верхнюю секцию', () => {
  const base = run(3000, 3000).calc.curtain.topVisible; // 1205
  const r = run(3000, 3000, { sections: { extraWindbars: 2 } }).calc.curtain;
  assert.equal(r.windbars, 4);
  // «+1» уже отнял 40 у верхней секции, новый ветровик отнимает ещё 40, остаток делится пополам
  const tv1 = base - 40;
  const mid = r.sections[3].h;
  assert.equal(mid, Math.round((tv1 - 40) / 2));
  assert.equal(r.topVisible, tv1 - 40 - mid);
});

test('нержавейка: ширина W+105, короб W+184, стойка 1,5 мм до H 3500', () => {
  const { calc, spec } = run(3000, 3500, { frameMaterial: 'ss304' });
  assert.equal(calc.curtain.width, 3105);
  assert.equal(calc.frame.boxLength, 3184);
  assert.equal(calc.frame.shaftLength, 3074);
  assert.equal(calc.frame.sketch.overallWidth, 3000 + 315 + 150);
  assert.equal(line(spec, 'LF-R125-1.5-SS').qty, 7.4);
  assert.equal(line(spec, 'LF-R101-S-SS').qty, 3.184);
  assert.equal(line(spec, 'LF-R105-S-0.75-L-SS').qty, 1);
  assert.equal(line(spec, 'LF-R025'), undefined);
  assert.ok(spec.pendingImport.includes('LF-R125-1.5-SS'));
  assert.equal(line(run(3000, 3600, { frameMaterial: 'ss304' }).spec, 'LF-R125-2.0-SS').qty, 7.6);
});

test('кабель: пульт на другой стороне добавляет W + 300', () => {
  const d = run(3000, 3000, { controlSide: 'R' }).calc.drive;
  // (3000 + 470 − 1000) + 3300 + 1000 = 6770; в комплекте 4 м
  assert.equal(d.cableLength, 6770);
  assert.equal(d.cableToBuy, 2770);
  assert.equal(line(run(3000, 3000, { controlSide: 'R' }).spec, 'HSD 5005').qty, 2.77);
});

test('ворота на стороне (SDA): расчёт есть, спецификации нет', () => {
  const r = run(3000, 3000, { supply: 'outsourced' });
  assert.equal(r.calc.status, 'ok');
  assert.equal(r.spec, null);
});

test('пост на 2 кнопки недоступен', () => {
  const r = run(3000, 3000, { accessories: [{ type: 'push_button', sku: null, qty: 1 }] });
  assert.ok(codes(r.calc).includes('ACCESSORY_UNAVAILABLE'));
});

test('прозрачной не может быть верхняя секция', () => {
  const r = run(3000, 3000, { transparentSections: [3] });
  assert.ok(codes(r.calc).includes('TRANSPARENT_SECTION'));
});
