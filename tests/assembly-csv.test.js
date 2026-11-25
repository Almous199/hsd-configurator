import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateHsr, exportAssemblyCsv } from '../products/hsr/index.js';
import { HEADER } from '../core/assembly-csv.js';
import { cat, order } from './helpers.js';

const doc = { ...order(2000, 2600, { pvc: 'yellow' }), id: 'DSO-26659-2' };
doc.opening.quantity = 5;
const result = calculateHsr(doc, cat);

test('SDA-DS: формат как у секционных (BOM, CRLF, шапка в каждой строке, количество × ворота)', () => {
  const out = exportAssemblyCsv(doc, result, cat, { date: '2026-11-25' });
  assert.deepEqual(out.problems, []);
  assert.equal(out.fileName, 'BUN-26659-2_SDA-DS.csv');
  assert.ok(out.csv.startsWith('﻿'));
  const rows = out.csv.slice(1).trimEnd().split('\r\n');
  assert.equal(rows[0], HEADER.join(','));
  assert.equal(rows.length - 1, result.spec.lines.length);
  const bar = rows.find((r) => r.includes(',LF-R031,'));
  assert.equal(bar, 'SDA-DS,Main Warehouse,High-speed PVC door Dasima,BUN-26659-2,2026-11-25,5,Aluminum middle bar,LF-R031,21.4,"SDA 2000x2600, alu-galv, yellow, 0.75 kW L"');
  const nut = result.spec.lines.find((l) => l.sku === 'LF-R023');
  assert.equal(nut, undefined); // крепёж — нормы позже
});

test('DUS-055: только раздел «Полотно»', () => {
  const out = exportAssemblyCsv(doc, result, cat, { assemblySku: 'DUS-055', date: '2026-11-25' });
  const rows = out.csv.slice(1).trimEnd().split('\r\n').slice(1);
  const skus = rows.map((r) => r.split(',')[7]);
  assert.deepEqual(skus, ['PVC-0.8-yellow', 'PVC-2-tr', 'LF-R031', 'LF-R032', 'LF-R033', 'LF-R035', 'LF-R036', 'LF-R043']);
  assert.ok(rows.every((r) => r.startsWith('DUS-055,Main Warehouse,SDA curtain set assembly,BUN-26659-2,')));
});

test('неверная дата и сборка блокируют экспорт', () => {
  assert.ok(exportAssemblyCsv(doc, result, cat, { date: '25.11.2026' }).problems.length > 0);
  assert.ok(exportAssemblyCsv(doc, result, cat, { assemblySku: 'DUS-056', date: '2026-11-25' }).problems.length > 0);
});
