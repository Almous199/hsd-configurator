// Сообщения расчёта: error блокирует сохранение и спецификацию, warning — только показывается.
// text — по-русски (журнал, тесты, CLI); i18n — переводы для интерфейса: { en, th }.
// В вызов можно передать строку или объект { ru, en, th }.

function make(level, code, text, data) {
  const m = { level, code };
  if (text && typeof text === 'object') {
    m.text = text.ru;
    m.i18n = { en: text.en, th: text.th || text.en };
  } else m.text = text;
  if (data !== undefined) m.data = data;
  return m;
}

export const error = (code, text, data) => make('error', code, text, data);
export const warning = (code, text, data) => make('warning', code, text, data);

/** Текст сообщения на языке интерфейса (en / th / ru); нет перевода — английский, затем русский. */
export function msgText(m, lang) {
  if (lang === 'ru') return m.text;
  return (m.i18n && (m.i18n[lang] || m.i18n.en)) || m.text;
}

export const hasErrors = (messages) => messages.some((m) => m.level === 'error');
