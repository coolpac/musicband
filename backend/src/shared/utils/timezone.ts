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
 * `YYYY-MM-DD` → Date в UTC-полночь (так Prisma хранит и отдаёт колонки `@db.Date`).
 * Возвращает null, если строка не является настоящей календарной датой
 * («2026-02-31» Date молча нормализует в 3 марта — такое отбрасываем).
 */
export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (formatInTimezone(date, 'UTC') !== value) return null;
  return date;
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
