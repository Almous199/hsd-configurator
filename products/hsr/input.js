// Нормализация входа заказа HSR: значения по умолчанию и проверка полей формы.
import { error, warning } from '../../core/messages.js';

export const LIMITS = { maxWidth: 6000, maxHeight: 6000 };

/**
 * Приводит order/opening/options к виду, который ждут модули расчёта.
 * Ничего не досчитывает: только значения по умолчанию из согласованных правил.
 */
export function normalizeInput(order, messages) {
  const opening = order.opening || {};
  const o = order.options || {};
  const W = Math.round(Number(opening.width));
  const H = Math.round(Number(opening.height));
  const quantity = opening.quantity == null ? 1 : Number(opening.quantity);

  if (!(W > 0) || !(H > 0)) messages.push(error('OPENING_SIZE', { ru: 'Не заданы ширина и высота проёма', en: 'Opening width and height are not set', th: 'ยังไม่ได้ระบุความกว้างและความสูงของช่องเปิด' }));
  if (W > LIMITS.maxWidth || H > LIMITS.maxHeight) {
    messages.push(error('OPENING_TOO_BIG', { ru: `Проём ${W}×${H} больше предела SDA ${LIMITS.maxWidth}×${LIMITS.maxHeight}`, en: `Opening ${W}×${H} is over the SDA limit ${LIMITS.maxWidth}×${LIMITS.maxHeight}`, th: `ช่องเปิด ${W}×${H} เกินขีดจำกัด SDA ${LIMITS.maxWidth}×${LIMITS.maxHeight}` }));
  }
  if (!(quantity >= 1) || !Number.isInteger(quantity)) messages.push(error('QUANTITY', { ru: 'Количество ворот должно быть целым ≥ 1', en: 'Door quantity must be a whole number ≥ 1', th: 'จำนวนประตูต้องเป็นจำนวนเต็ม ≥ 1' }));

  const driveSide = o.driveSide || 'L';
  if (!['L', 'R'].includes(driveSide)) messages.push(error('DRIVE_SIDE', { ru: 'Сторона привода: L или R (вид изнутри)', en: 'Drive side: L or R (view from inside)', th: 'ด้านมอเตอร์: L หรือ R (มองจากด้านใน)' }));
  let controlSide = o.controlSide;
  if (!controlSide) {
    controlSide = driveSide;
    messages.push(warning('CONTROL_SIDE_DEFAULT', { ru: 'Сторона пульта не указана, принята сторона привода', en: 'Control box side not set, drive side used', th: 'ไม่ได้ระบุด้านตู้ควบคุม ใช้ด้านมอเตอร์' }));
  }
  if (!['L', 'R'].includes(controlSide)) messages.push(error('CONTROL_SIDE', { ru: 'Сторона пульта: L или R (вид изнутри)', en: 'Control box side: L or R (view from inside)', th: 'ด้านตู้ควบคุม: L หรือ R (มองจากด้านใน)' }));

  const supply = o.supply || 'own';
  if (!['own', 'outsourced'].includes(supply)) messages.push(error('SUPPLY', { ru: 'Исполнение: own (SDA-DS) или outsourced (SDA)', en: 'Supply: own (SDA-DS) or outsourced (SDA)', th: 'การผลิต: own (SDA-DS) หรือ outsourced (SDA)' }));

  return {
    W, H, quantity,
    areaM2: (W * H) / 1e6,
    supply,
    frameMaterial: o.frameMaterial || 'alu-galv',
    pvc: o.pvc || 'blue',
    pvcThickness: o.pvcThickness,
    clearThickness: o.clearThickness,
    profileThickness: o.profileThickness,
    photocells: normalizePhotocells(o.photocells, H, messages),
    driveSide, controlSide,
    controlBoxHeight: o.controlBoxHeight,
    extraWindbars: (o.sections && o.sections.extraWindbars) || 0,
    transparentSections: o.transparentSections,
    accessories: o.accessories || [],
    options: o,
  };
}

/** Фотоэлементы: пары (1 стандарт, 2 опция) и уровни от пола; по умолчанию 1 пара на 400 мм (Alex 26.11). */
function normalizePhotocells(pc, H, messages) {
  const pairs = pc && pc.pairs != null ? Number(pc.pairs) : 1;
  const def = [400, 1000];
  const levels = [];
  for (let i = 0; i < pairs; i++) levels.push(Math.round(Number((pc && pc.levels && pc.levels[i]) ?? def[i] ?? def[0])));
  if (![1, 2].includes(pairs)) messages.push(error('PHOTOCELL_PAIRS', { ru: 'Фотоэлементов: 1 или 2 пары', en: 'Photocells: 1 or 2 pairs', th: 'โฟโตเซลล์: 1 หรือ 2 คู่' }));
  for (const l of levels) {
    if (!(l > 0) || (H > 0 && l >= H)) messages.push(error('PHOTOCELL_LEVEL', { ru: `Уровень фотоэлемента ${l} мм вне проёма`, en: `Photocell level ${l} mm is outside the opening`, th: `ระดับโฟโตเซลล์ ${l} มม. อยู่นอกช่องเปิด` }));
  }
  return { pairs, levels };
}
