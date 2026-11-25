// Спецификация HSR в единицах Zoho на ОДНИ ворота (тред 06, hsr-assemblies-draft.md).
// Разделы: curtain (= сборка DUS-055), header, guides, drive (все вместе = SDA-DS).
// Нормы крепежа (LF-R015, R020, R023, R024) ещё не заданы — в спецификацию не входят.
import { requireItem } from '../../core/catalog.js';
import { mmToM, mm2ToM2 } from '../../core/units.js';

export function buildSpecLines(inp, frame, curtain, drive, cat, bySku) {
  const lines = [];
  const add = (section, partId, sku, qty, rule, extra = {}) => {
    if (!(qty > 0)) return;
    if (!sku) {
      lines.push({ section, partId, sku: null, name: null, unit: null, qty, rule, missingSku: true, ...extra });
      return;
    }
    const it = requireItem(bySku, sku);
    lines.push({ section, partId, sku, name: it.zohoName || it.name, unit: it.unit, qty, rule,
      ...(it.pendingImport ? { pendingImport: true } : {}), ...extra });
  };

  // ── Полотно ───────────────────────────────────────────────
  const c = curtain;
  const n = c.windbars;
  add('curtain', 'pvc', c.pvc.sku, mm2ToM2(c.pvc.areaMm2), 'ширина раскроя × Σ раскроя непрозрачных секций и полос окна');
  add('curtain', 'pvc.clear', c.clear.sku, mm2ToM2(c.clear.areaMm2), 'ширина раскроя × Σ (h − 10) прозрачных секций');
  add('curtain', 'windbar', c.windbarProfile.sku, mmToM(n * c.windbarProfile.length), 'n × ширина полотна');
  add('curtain', 'windbar.plug', c.windbarProfile.plug, n, 'n пар');
  add('curtain', 'bottom', c.bottomProfile.sku, mmToM(c.bottomProfile.length), 'ширина полотна');
  add('curtain', 'bottom.plug', c.bottomProfile.plug, 1, '1 пара');
  add('curtain', 'bottom.seal', c.bottomProfile.seal, mmToM(c.bottomProfile.length), 'ширина полотна');
  add('curtain', 'nylon', c.windbarProfile.nylon || 'LF-R043', mmToM(c.nylonLength), '(2n + 1) × ширина полотна');

  // ── Короб и вал ───────────────────────────────────────────
  const f = frame;
  const material = cat.frameMaterials.options.find((m) => m.id === f.material);
  const hdr = material.header[f.sidePlate];
  add('header', 'header.cover', hdr.cover, mmToM(f.boxLength), 'длина короба');
  add('header', 'header.endPlates', hdr.endPlates, 1, '1 пара');
  add('header', 'shaft', f.shaftSku, mmToM(f.shaftLength), 'длина вала');
  add('header', 'shaft.flange', f.flangeSku, 4, 'по 2 на полуось');
  add('header', 'axle.motor', cat.header.axles.motorSide.sku, cat.header.axles.motorSide.qty, 'сторона привода');
  add('header', 'axle.other', cat.header.axles.otherSide.sku, cat.header.axles.otherSide.qty, 'другая сторона');
  add('header', 'bearing', cat.header.bearing.sku, cat.header.bearing.qty, '');
  add('header', 'lockingCup', cat.header.lockingCup.sku, cat.header.lockingCup.qty, '');
  add('header', 'beam', cat.header.connectionBeam.sku, mmToM(f.beamQty * f.beamLength), '2 × (длина короба − 1)');

  // ── Направляющие ──────────────────────────────────────────
  const G = f.guideLength;
  const q = f.guideQty; // 2 стойки
  const acc = cat.accessories;
  if (f.guide === 'alu-hjg1765') {
    const r = cat.guides.items.find((g) => g.id === f.guide).roles;
    add('guides', 'guide.rail', r.rail, mmToM(q * G), '2 × (H + 200)');
    add('guides', 'guide.brush', r.brush, mmToM(4 * G), '4 × (H + 200) [Lefast]');
    add('guides', 'guide.wearStrip', r.wearStrip, mmToM(4 * G), '4 × (H + 200) [Lefast]');
    add('guides', 'guide.cover', r.cover, mmToM(q * G), '2 × (H + 200)');
    add('guides', 'guide.topBracket', r.topBracket, 2, '1 на стойку');
    add('guides', 'guide.footBracket', r.footBracket, 2, '1 на стойку');
    add('guides', 'guide.pad', r.guidePad, 4, '2 на стойку');
  } else {
    const byH = material.guideByHeight.find((g) => g.maxHeight == null || inp.H <= g.maxHeight);
    const p = material.guideParts;
    add('guides', 'guide.rail', byH.rail, mmToM(q * G), '2 × (H + 200); толщина по H');
    add('guides', 'guide.seal', p.seal, mmToM(4 * G), '4 × (H + 200) — как щётка у алюминия, не подтверждено', { provisional: true });
    add('guides', 'guide.fittingStrip', p.fittingStrip, mmToM(4 * G), '4 × (H + 200) — как полоса износа у алюминия, не подтверждено', { provisional: true });
    add('guides', 'guide.topBracket', byH.topBracket, 2, '1 на стойку');
    add('guides', 'guide.footBracket', p.footBracket, 2, '1 на стойку');
    add('guides', 'guide.pad', 'LF-R011', 4, '2 на стойку');
  }
  add('guides', 'photocell.support', acc.photocell.support, acc.photocell.pairsStandard * acc.photocell.supportsPerPair, '2 на пару фотоэлементов');

  // ── Привод ────────────────────────────────────────────────
  const d = drive;
  add('drive', 'motor', d.motorSku, 1, `${d.powerKw} кВт, ${d.gearbox} ${d.ratio}`);
  add('drive', 'controlUnit', d.controlUnitSku, 1, '');
  add('drive', 'motor.plate', d.plateSku, 1, d.gearbox);
  add('drive', 'motor.bumper', 'LF-R012', d.bumpers, '1 при RV50, 2 при RV63');
  add('drive', 'motor.cover', d.motorCoverSku, 1, `боковина ${f.sidePlate}, сторона ${d.driveSide}`);
  for (const k of acc.standardKit) add('drive', `std.${k.sku}`, k.sku, k.qty, k.note);
  add('drive', 'cable', 'HSD 5005', mmToM(d.cableToBuy), 'длина кабеля − кабель в комплекте');

  if (acc.accessoriesInAssembly) {
    for (const a of inp.accessories) add('drive', `acc.${a.sku}`, a.sku, a.qty, 'аксессуар из формы');
  }
  return lines;
}
