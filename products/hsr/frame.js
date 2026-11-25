// Рама SDA: боковина и вал, длины короба, вала, балки и направляющих, размеры для эскиза.
// Правило (тред 03, Alex 25.11.2026):
//   W ≤ 4000 и H ≤ 4000 → боковина S 274×234, вал φ114, полная высота H+470;
//   иначе при площади ≤ 28 м² → M 322×284, φ140, H+520;
//   площадь > 28 м² → проём не допускается.
// Ручная замена боковины — override frame.sidePlate с причиной.
import { error, warning } from '../../core/messages.js';
import { getOverride } from '../../core/overrides.js';

export function calcFrame(inp, cat, messages) {
  const { W, H, areaM2 } = inp;
  const material = cat.frameMaterials.options.find((m) => m.id === inp.frameMaterial);
  if (!material) {
    messages.push(error('FRAME_MATERIAL', `Неизвестный материал рамы «${inp.frameMaterial}»`));
    return null;
  }
  const guide = cat.guides.items.find((g) => g.id === material.guide);

  // 1. Ступень по таблице header.json → selection
  const sel = cat.header.selection;
  let sidePlateId = null;
  for (const step of sel.steps) {
    const fitsSize = W <= step.maxWidth && H <= step.maxHeight;
    const fitsArea = step.maxArea_m2 == null || areaM2 <= step.maxArea_m2 + 1e-9;
    if (fitsSize && fitsArea) { sidePlateId = step.sidePlate; break; }
  }
  if (!sidePlateId) {
    messages.push(error('NOT_AVAILABLE',
      `Not available: проём ${W}×${H} (${areaM2.toFixed(2)} м²) больше ${sel.maxArea_m2} м², SDA такой не делаем`,
      { areaM2, maxAreaM2: sel.maxArea_m2 }));
    return null;
  }

  const ov = getOverride(inp.options, 'frame.sidePlate', messages);
  let sidePlateAuto = sidePlateId;
  if (ov) {
    const p = cat.header.sidePlates.find((s) => s.id === ov.value && s.active);
    if (!p) messages.push(error('OVERRIDE_SIDE_PLATE', `Боковина «${ov.value}» не используется для SDA`));
    else {
      sidePlateId = ov.value;
      messages.push(warning('OVERRIDE_APPLIED', `Боковина заменена вручную на ${ov.value}: ${ov.reason}`));
    }
  }

  const plate = cat.header.sidePlates.find((s) => s.id === sidePlateId);
  const shaftDia = plate.shaftDia;
  const shaft = cat.header.shafts.find((s) => s.dia === shaftDia);

  // 2. Длины (guides.json → offsets)
  const boxLength = W + guide.offsets.headerLength;
  const shaftLength = W + guide.offsets.shaftLength;
  const guideLength = H + guide.columnLength.plusH;
  const beamLength = boxLength - 1;
  const overallHeight = H + plate.overOpening;

  // 3. Размеры для эскиза (space.json, кит. ред. 2020.09.09)
  const spaceSet = material.guide === 'ss304' ? cat.space.stainless : cat.space.aluminium;
  const step = spaceSet.steps.find((s) => s.sidePlate === sidePlateId);
  const sketch = {
    headerDepth: step.headerDepth,
    headerHeight: step.headerHeight,
    overOpening: step.overOpening,
    motorCoverEdge: step.motorCoverEdge,
    column: { ...spaceSet.column },
    motorSideWidth: spaceSet.motorSide,
    nonMotorSideWidth: spaceSet.nonMotorSide,
    overallWidth: W + spaceSet.motorSide + spaceSet.nonMotorSide,
    overallHeight,
    installGap: cat.space.installGap,
  };

  if (W > cat.header.wideShaftWarning.widthOver) {
    messages.push(warning('WIDE_SHAFT', `W > ${cat.header.wideShaftWarning.widthOver}: ${cat.header.wideShaftWarning.text}`));
  }

  return {
    material: material.id,
    guide: guide.id,
    guideSize: { ...guide.size },
    sidePlate: sidePlateId,
    sidePlateAuto,
    sidePlateSize: { ...plate.size },
    shaftDiameter: shaftDia,
    shaftSku: shaft.sku,
    flangeSku: shaft.flange,
    boxLength,
    shaftLength,
    beamLength,
    beamQty: cat.header.connectionBeam.qty,
    guideLength,
    guideQty: guide.qty,
    overallHeight,
    sketch,
  };
}
