/**
 * Часовой пояс приложения (Челябинск).
 * Все проверки «сегодня», «не в прошлом», доступные даты — в этом поясе.
 */

export const APP_TIMEZONE = 'Asia/Yekaterinburg';

function formatInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Возвращает дату в формате YYYY-MM-DD в поясе приложения (Челябинск).
 */
export function formatDateInTimezone(date: Date, timezone: string = APP_TIMEZONE): string {
  return formatInTimezone(date, timezone);
}

/**
 * Возвращает «сегодня» в поясе приложения как YYYY-MM-DD.
 */
export function getTodayDateString(timezone: string = APP_TIMEZONE): string {
  return formatInTimezone(new Date(), timezone);
}

/**
 * Проверяет, что дата (строка YYYY-MM-DD или Date) уже в прошлом в поясе приложения.
 */
export function isDateInPast(
  dateStrOrDate: string | Date,
  timezone: string = APP_TIMEZONE
): boolean {
  const todayStr = getTodayDateString(timezone);
  const dateStr =
    typeof dateStrOrDate === 'string'
      ? dateStrOrDate
      : formatDateInTimezone(dateStrOrDate, timezone);
  return dateStr < todayStr;
}
