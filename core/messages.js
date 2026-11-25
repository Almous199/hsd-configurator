// Сообщения расчёта: error блокирует сохранение и спецификацию, warning — только показывается.

export function error(code, text, data) {
  return data === undefined ? { level: 'error', code, text } : { level: 'error', code, text, data };
}

export function warning(code, text, data) {
  return data === undefined ? { level: 'warning', code, text } : { level: 'warning', code, text, data };
}

export const hasErrors = (messages) => messages.some((m) => m.level === 'error');
