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

  if (!(W > 0) || !(H > 0)) messages.push(error('OPENING_SIZE', 'Не заданы ширина и высота проёма'));
  if (W > LIMITS.maxWidth || H > LIMITS.maxHeight) {
    messages.push(error('OPENING_TOO_BIG', `Проём ${W}×${H} больше предела SDA ${LIMITS.maxWidth}×${LIMITS.maxHeight}`));
  }
  if (!(quantity >= 1) || !Number.isInteger(quantity)) messages.push(error('QUANTITY', 'Количество ворот должно быть целым ≥ 1'));

  const driveSide = o.driveSide || 'L';
  if (!['L', 'R'].includes(driveSide)) messages.push(error('DRIVE_SIDE', 'Сторона привода: L или R (вид изнутри)'));
  let controlSide = o.controlSide;
  if (!controlSide) {
    controlSide = driveSide;
    messages.push(warning('CONTROL_SIDE_DEFAULT', 'Сторона пульта не указана, принята сторона привода'));
  }
  if (!['L', 'R'].includes(controlSide)) messages.push(error('CONTROL_SIDE', 'Сторона пульта: L или R (вид изнутри)'));

  const supply = o.supply || 'own';
  if (!['own', 'outsourced'].includes(supply)) messages.push(error('SUPPLY', 'Исполнение: own (SDA-DS) или outsourced (SDA)'));

  return {
    W, H, quantity,
    areaM2: (W * H) / 1e6,
    supply,
    frameMaterial: o.frameMaterial || 'alu-galv',
    pvc: o.pvc || 'blue',
    pvcThickness: o.pvcThickness,
    clearThickness: o.clearThickness,
    driveSide, controlSide,
    controlBoxHeight: o.controlBoxHeight,
    extraWindbars: (o.sections && o.sections.extraWindbars) || 0,
    transparentSections: o.transparentSections,
    accessories: o.accessories || [],
    options: o,
  };
}
