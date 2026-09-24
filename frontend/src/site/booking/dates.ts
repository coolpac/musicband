/**
 * Calendar maths for the booking flow.
 *
 * Every date is a plain «YYYY-MM-DD» string built from LOCAL year/month/day. `toISOString()`
 * is never used: it converts to UTC and silently moves the date by one day for anyone east of
 * Greenwich (all of Russia) after 19:00 local — which would book the wrong evening.
 *
 * All `Date` objects are constructed at local 12:00 so a DST jump at midnight can never roll
 * the calendar day over.
 */

/** «YYYY-MM-DD» */
export type DateKey = string;
/** «YYYY-MM» */
export type MonthKey = string;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

export function makeDateKey(year: number, month0: number, day: number): DateKey {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

export function makeMonthKey(year: number, month0: number): MonthKey {
  return `${year}-${pad2(month0 + 1)}`;
}

/** Local «today». Client-only: never call this during render — see SiteApp SSR rules. */
export function todayKey(): DateKey {
  const now = new Date();
  return makeDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

interface Parts {
  year: number;
  month0: number;
  day: number;
}

export function parseDateKey(date: DateKey): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const year = Number(m[1]);
  const month0 = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month0 < 0 || month0 > 11 || day < 1 || day > 31) return null;
  // Reject 31 February and friends.
  const probe = new Date(year, month0, day, 12);
  if (probe.getFullYear() !== year || probe.getMonth() !== month0 || probe.getDate() !== day) return null;
  return { year, month0, day };
}

export function parseMonthKey(month: MonthKey): { year: number; month0: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const month0 = Number(m[2]) - 1;
  if (month0 < 0 || month0 > 11) return null;
  return { year: Number(m[1]), month0 };
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const parsed = parseMonthKey(month);
  if (!parsed) return month;
  const d = new Date(parsed.year, parsed.month0 + delta, 1, 12);
  return makeMonthKey(d.getFullYear(), d.getMonth());
}

/** Whole months from `from` to `to` (negative when `to` is earlier). */
export function monthDistance(from: MonthKey, to: MonthKey): number {
  const a = parseMonthKey(from);
  const b = parseMonthKey(to);
  if (!a || !b) return 0;
  return (b.year - a.year) * 12 + (b.month0 - a.month0);
}

export function addDays(date: DateKey, delta: number): DateKey {
  const parsed = parseDateKey(date);
  if (!parsed) return date;
  const d = new Date(parsed.year, parsed.month0, parsed.day + delta, 12);
  return makeDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0, 12).getDate();
}

/** 0 = Monday … 6 = Sunday, the way a Russian calendar is read. */
export function mondayFirstWeekday(year: number, month0: number, day: number): number {
  return (new Date(year, month0, day, 12).getDay() + 6) % 7;
}

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
export const WEEKDAYS_FULL = [
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
  'воскресенье',
] as const;

const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

/** «2025-12» → «Декабрь 2025». Hand-written tables, not Intl: the SSR container has no ICU data. */
export function formatMonthLabel(month: MonthKey): string {
  const parsed = parseMonthKey(month);
  if (!parsed) return month;
  return `${MONTHS_NOMINATIVE[parsed.month0]} ${parsed.year}`;
}

/** «2025-12-18» → «18 декабря 2025». */
export function formatDateLong(date: DateKey): string {
  const parsed = parseDateKey(date);
  if (!parsed) return date;
  return `${parsed.day} ${MONTHS_GENITIVE[parsed.month0]} ${parsed.year}`;
}

/** «2025-12-18» → «18 декабря 2025, четверг» — the accessible name of a calendar cell. */
export function formatDateFull(date: DateKey): string {
  const parsed = parseDateKey(date);
  if (!parsed) return date;
  const weekday = WEEKDAYS_FULL[mondayFirstWeekday(parsed.year, parsed.month0, parsed.day)];
  return `${formatDateLong(date)}, ${weekday}`;
}

export interface CalendarCell {
  /** null = a leading/trailing blank that keeps the 7-column rhythm. */
  date: DateKey | null;
  day: number;
}

/**
 * Weeks of `month` as rows of 7, Monday first, with blanks around the edges.
 * Always 6 rows so the card does not jump height between months.
 */
export function buildMonthGrid(month: MonthKey): CalendarCell[][] {
  const parsed = parseMonthKey(month);
  if (!parsed) return [];
  const { year, month0 } = parsed;
  const total = daysInMonth(year, month0);
  const lead = mondayFirstWeekday(year, month0, 1);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i += 1) cells.push({ date: null, day: 0 });
  for (let day = 1; day <= total; day += 1) cells.push({ date: makeDateKey(year, month0, day), day });
  while (cells.length < 42) cells.push({ date: null, day: 0 });

  const rows: CalendarCell[][] = [];
  for (let i = 0; i < 42; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** Clamp a date to the month it should live in after arrow-key navigation. */
export function clampToMonthRange(date: DateKey, minMonth: MonthKey, maxMonth: MonthKey): DateKey {
  const month = monthOf(date);
  if (monthDistance(minMonth, month) < 0) return `${minMonth}-01`;
  if (monthDistance(month, maxMonth) < 0) {
    const parsed = parseMonthKey(maxMonth);
    if (!parsed) return date;
    return makeDateKey(parsed.year, parsed.month0, daysInMonth(parsed.year, parsed.month0));
  }
  return date;
}
