// Спецификация HSR в единицах Zoho на ОДНИ ворота (тред 06, hsr-assemblies-draft.md).
// Разделы: curtain (= сборка DUS-055), header, guides, drive (все вместе = SDA-DS).
// Нормы крепежа (LF-R015, R020, R023, R024) ещё не заданы — в спецификацию не входят.
import { requireItem } from '../../core/catalog.js';
import { mmToM, mm2ToM2 } from '../../core/units.js';

/** Комментарий строки спецификации на языке интерфейса (en / th / ru). */
export function ruleText(l, lang) {
  if (lang === 'ru' || !l.ruleI18n) return l.rule;
  return l.ruleI18n[lang] || l.ruleI18n.en || l.rule;
}

export function buildSpecLines(inp, frame, curtain, drive, cat, bySku) {
  const lines = [];
  const add = (section, partId, sku, qty, ruleIn, extra = {}) => {
    if (!(qty > 0)) return;
    // rule — по-русски; ruleI18n — переводы для интерфейса ({ en, th }), см. ruleText
    const tr = ruleIn && typeof ruleIn === 'object';
    const rule = tr ? ruleIn.ru : ruleIn;
    if (tr) extra = { ruleI18n: { en: ruleIn.en, th: ruleIn.th || ruleIn.en }, ...extra };
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
  add('curtain', 'pvc', c.pvc.sku, mm2ToM2(c.pvc.areaMm2), { ru: 'ширина раскроя × Σ раскроя непрозрачных секций и полос окна', en: 'cut width × Σ cuts of opaque sections and window strips', th: 'ความกว้างตัด × Σ ความยาวตัดเซกชันทึบและแถบหน้าต่าง' });
  add('curtain', 'pvc.clear', c.clear.sku, mm2ToM2(c.clear.areaMm2), { ru: 'ширина раскроя × Σ (h − 10) прозрачных секций', en: 'cut width × Σ (h − 10) of transparent sections', th: 'ความกว้างตัด × Σ (h − 10) ของเซกชันใส' });
  add('curtain', 'windbar', c.windbarProfile.sku, mmToM(n * c.windbarProfile.length), { ru: 'n × ширина полотна', en: 'n × curtain width', th: 'n × ความกว้างม่าน' });
  add('curtain', 'windbar.plug', c.windbarProfile.plug, n, { ru: 'n пар', en: 'n pairs', th: 'n คู่' });
  add('curtain', 'bottom', c.bottomProfile.sku, mmToM(c.bottomProfile.length), { ru: 'ширина полотна', en: 'curtain width', th: 'ความกว้างม่าน' });
  add('curtain', 'bottom.plug', c.bottomProfile.plug, 1, { ru: '1 пара', en: '1 pair', th: '1 คู่' });
  add('curtain', 'bottom.seal', c.bottomProfile.seal, mmToM(c.bottomProfile.length), { ru: 'ширина полотна', en: 'curtain width', th: 'ความกว้างม่าน' });
  add('curtain', 'nylon', c.windbarProfile.nylon || 'LF-R043', mmToM(c.nylonLength), { ru: '(2n + 1) × ширина полотна', en: '(2n + 1) × curtain width', th: '(2n + 1) × ความกว้างม่าน' });

  // ── Короб и вал ───────────────────────────────────────────
  const f = frame;
  const material = cat.frameMaterials.options.find((m) => m.id === f.material);
  const hdr = material.header[f.sidePlate];
  add('header', 'header.cover', hdr.cover, mmToM(f.boxLength), { ru: 'длина короба', en: 'box length', th: 'ความยาวกล่อง' });
  add('header', 'header.endPlates', hdr.endPlates, 1, { ru: '1 пара', en: '1 pair', th: '1 คู่' });
  add('header', 'shaft', f.shaftSku, mmToM(f.shaftLength), { ru: 'длина вала', en: 'shaft length', th: 'ความยาวเพลา' });
  add('header', 'shaft.flange', f.flangeSku, 4, { ru: 'по 2 на полуось', en: '2 per stub axle', th: '2 ต่อแกนเพลา' });
  add('header', 'axle.motor', cat.header.axles.motorSide.sku, cat.header.axles.motorSide.qty, { ru: 'сторона привода', en: 'drive side', th: 'ด้านมอเตอร์' });
  add('header', 'axle.other', cat.header.axles.otherSide.sku, cat.header.axles.otherSide.qty, { ru: 'другая сторона', en: 'other side', th: 'อีกด้าน' });
  add('header', 'bearing', cat.header.bearing.sku, cat.header.bearing.qty, '');
  add('header', 'lockingCup', cat.header.lockingCup.sku, cat.header.lockingCup.qty, '');
  add('header', 'beam', cat.header.connectionBeam.sku, mmToM(f.beamQty * f.beamLength), { ru: '2 × (длина короба − 1)', en: '2 × (box length − 1)', th: '2 × (ความยาวกล่อง − 1)' });

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
    add('guides', 'guide.topBracket', r.topBracket, 2, { ru: '1 на стойку', en: '1 per column', th: '1 ต่อเสา' });
    add('guides', 'guide.footBracket', r.footBracket, 2, { ru: '1 на стойку', en: '1 per column', th: '1 ต่อเสา' });
    add('guides', 'guide.pad', r.guidePad, 4, { ru: '2 на стойку', en: '2 per column', th: '2 ต่อเสา' });
  } else {
    const byH = material.guideByHeight.find((g) => g.maxHeight == null || inp.H <= g.maxHeight);
    const p = material.guideParts;
    add('guides', 'guide.rail', byH.rail, mmToM(q * G), { ru: '2 × (H + 200); толщина по H', en: '2 × (H + 200); thickness by H', th: '2 × (H + 200); ความหนาตาม H' });
    add('guides', 'guide.seal', p.seal, mmToM(4 * G), { ru: '4 × (H + 200) — как щётка у алюминия, не подтверждено', en: '4 × (H + 200) — as the brush on aluminium, not confirmed', th: '4 × (H + 200) — เหมือนแปรงของอลูมิเนียม ยังไม่ยืนยัน' }, { provisional: true });
    add('guides', 'guide.fittingStrip', p.fittingStrip, mmToM(4 * G), { ru: '4 × (H + 200) — как полоса износа у алюминия, не подтверждено', en: '4 × (H + 200) — as the wear strip on aluminium, not confirmed', th: '4 × (H + 200) — เหมือนแถบกันสึกของอลูมิเนียม ยังไม่ยืนยัน' }, { provisional: true });
    add('guides', 'guide.topBracket', byH.topBracket, 2, { ru: '1 на стойку', en: '1 per column', th: '1 ต่อเสา' });
    add('guides', 'guide.footBracket', p.footBracket, 2, { ru: '1 на стойку', en: '1 per column', th: '1 ต่อเสา' });
    add('guides', 'guide.pad', 'LF-R011', 4, { ru: '2 на стойку', en: '2 per column', th: '2 ต่อเสา' });
  }
  add('guides', 'photocell.support', acc.photocell.support, inp.photocells.pairs * acc.photocell.supportsPerPair, { ru: `2 на пару фотоэлементов; уровень ${inp.photocells.levels.join(' / ')} мм`, en: `2 per photocell pair; level ${inp.photocells.levels.join(' / ')} mm`, th: `2 ต่อโฟโตเซลล์หนึ่งคู่; ระดับ ${inp.photocells.levels.join(' / ')} มม.` });

  // ── Привод ────────────────────────────────────────────────
  const d = drive;
  add('drive', 'motor', d.motorSku, 1, { ru: `${d.powerKw} кВт, ${d.gearbox} ${d.ratio}`, en: `${d.powerKw} kW, ${d.gearbox} ${d.ratio}`, th: `${d.powerKw} kW, ${d.gearbox} ${d.ratio}` });
  add('drive', 'controlUnit', d.controlUnitSku, 1, '');
  add('drive', 'motor.plate', d.plateSku, 1, { ru: `кронштейн привода по редуктору ${d.gearbox}`, en: `drive bracket for reducer ${d.gearbox}`, th: `แผ่นยึดมอเตอร์ตามเกียร์ ${d.gearbox}` });
  add('drive', 'motor.bumper', 'LF-R012', d.bumpers, { ru: '1 при RV50, 2 при RV63', en: '1 with RV50, 2 with RV63', th: '1 สำหรับ RV50, 2 สำหรับ RV63' });
  add('drive', 'motor.cover', d.motorCoverSku, 1, { ru: `боковина ${f.sidePlate}, сторона ${d.driveSide}`, en: `end plate ${f.sidePlate}, side ${d.driveSide}`, th: `แผ่นปิดข้าง ${f.sidePlate}, ด้าน ${d.driveSide}` });
  for (const k of acc.standardKit) add('drive', `std.${k.sku}`, k.sku, k.qty, k.noteEn ? { ru: k.note, en: k.noteEn, th: k.noteTh } : k.note);
  add('drive', 'cable', 'HSD 5005', mmToM(d.cableToBuy), { ru: 'длина кабеля − кабель в комплекте', en: 'cable length − cable in kit', th: 'ความยาวสาย − สายในชุด' });

  if (acc.accessoriesInAssembly) {
    for (const a of inp.accessories) add('drive', `acc.${a.sku}`, a.sku, a.qty, { ru: 'аксессуар из формы', en: 'accessory from the order form', th: 'อุปกรณ์เสริมจากฟอร์มสั่งซื้อ' });
  }
  return lines;
}
