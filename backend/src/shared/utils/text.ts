/**
 * Нормализация свободного текста из публичных форм.
 * Управляющие символы (C0/C1) выбрасываем: они не несут смысла, но ломают логи,
 * CSV-экспорт и сообщения Telegram.
 *
 * Фильтр написан посимвольно, а не регуляркой: литерал с управляющими символами
 * внутри класса запрещён правилом eslint `no-control-regex`, а подавлять его
 * ради одной строки не хочется.
 */

/** C0 (0x00–0x1F), DEL (0x7F) и C1 (0x80–0x9F) */
function isControlCode(code: number): boolean {
  return code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f);
}

/**
 * Заменяет управляющие символы. `keepNewlines` сохраняет `\n` (и превращает `\r\n`/`\r` в `\n`),
 * остальное заменяется на `replacement`.
 */
function stripControlChars(value: string, replacement: string, keepNewlines: boolean): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const code = char.charCodeAt(0);

    if (!isControlCode(code)) {
      out += char;
      continue;
    }

    if (keepNewlines && (code === 0x0a || code === 0x0d)) {
      // \r\n → один \n
      if (code === 0x0d && value.charCodeAt(i + 1) === 0x0a) i++;
      out += '\n';
      continue;
    }

    out += replacement;
  }
  return out;
}

/**
 * Однострочное поле (имя, город, телефон): без переводов строк,
 * схлопнутые пробелы, обрезка по maxLength.
 */
export function sanitizeLine(value: string, maxLength: number): string {
  return stripControlChars(value, ' ', false).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/**
 * Многострочное поле (комментарий): переводы строк сохраняем,
 * остальные управляющие символы убираем, подряд идущие пустые строки схлопываем.
 */
export function sanitizeMultiline(value: string, maxLength: number): string {
  return stripControlChars(value, '', true)
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}
