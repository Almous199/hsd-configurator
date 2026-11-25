// Привод SDA (тред 04, Alex 25.11.2026).
//   Только Powever (Baojiu) A2: 0,75 кВт RV50 1:20 (пластина LF-R039) и 1,5 кВт RV63 1:15 (LF-R003), блок A2control.
//   Подбор строго по каталогу Powever 2025, по площади проёма и валу:
//     φ114: 0,75 до 17 м²;  φ140: 0,75 до 14 м², 1,5 до 28 м²;  больше — не допускается.
//   Кожух мотора — по боковине и стороне привода, из комплекта материала рамы.
//   Кабель: длина = (полная высота − h_блока) + (W + 300, если блок на стороне без мотора) + 1000;
//           докупка = длина − кабель в комплекте (4 м / 5 м), если > 0.
import { error, warning } from '../../core/messages.js';
import { getOverride } from '../../core/overrides.js';

export function calcDrive(inp, frame, cat, messages) {
  const D = String(frame.shaftDiameter);
  const motors = cat.drives.motors.slice().sort((a, b) => a.kw - b.kw);

  let motor = motors.find((m) => m.maxArea[D] != null && inp.areaM2 <= m.maxArea[D] + 1e-9);
  const ov = getOverride(inp.options, 'drive.motor', messages);
  if (ov) {
    const m = motors.find((x) => x.id === ov.value);
    if (!m) messages.push(error('OVERRIDE_MOTOR', `Мотор «${ov.value}» не используется для SDA`));
    else if (m.maxArea[D] == null || inp.areaM2 > m.maxArea[D] + 1e-9) {
      messages.push(error('OVERRIDE_MOTOR_LIMIT', `Мотор ${m.id} на валу φ${D} тянет до ${m.maxArea[D]} м², проём ${inp.areaM2.toFixed(2)} м²`));
    } else {
      motor = m;
      messages.push(warning('OVERRIDE_APPLIED', `Мотор заменён вручную на ${m.id}: ${ov.reason}`));
    }
  }
  if (!motor) {
    messages.push(error('MOTOR_NOT_AVAILABLE',
      `Not available: на вал φ${D} нет мотора для ${inp.areaM2.toFixed(2)} м² (каталог Powever)`));
    return null;
  }

  const material = cat.frameMaterials.options.find((m) => m.id === frame.material);
  const coverSet = material.motorCover[frame.sidePlate];
  const motorCover = coverSet ? coverSet[inp.driveSide] : null;
  if (!motorCover) messages.push(warning('MOTOR_COVER_NO_SKU', `Нет кожуха мотора для боковины ${frame.sidePlate}`));

  // Кабель
  const hBlock = inp.controlBoxHeight ?? cat.drives.cable.hBlockDefault;
  const blockOnOtherSide = inp.controlSide !== inp.driveSide;
  const cableLength = (frame.overallHeight - hBlock) + (blockOnOtherSide ? inp.W + 300 : 0) + 1000;
  const includedMm = cat.drives.cable.includedM[motor.id] * 1000;
  const cableToBuy = Math.max(0, cableLength - includedMm);

  return {
    motorId: motor.id,
    motorSku: motor.sku,
    powerKw: motor.kw,
    gearbox: motor.reducer,
    ratio: motor.ratio,
    plateSku: motor.plate,
    bumpers: motor.bumpers,
    maxAreaM2: motor.maxArea[D],
    areaM2: Math.round(inp.areaM2 * 100) / 100,
    controlUnitSku: cat.drives.controlUnit.sku,
    motorCoverSku: motorCover,
    driveSide: inp.driveSide,
    controlSide: inp.controlSide,
    controlBoxHeight: hBlock,
    cableLength,
    cableIncluded: includedMm,
    cableToBuy,
  };
}
