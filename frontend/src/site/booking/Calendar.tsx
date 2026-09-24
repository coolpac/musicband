import { useCallback, useEffect, useLayoutEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useSection } from '../content/SiteDataContext';
import chevronLeftUrl from '../assets/booking-datetime-v2/icon-chevron-left.svg';
import chevronRightUrl from '../assets/booking-datetime-v2/icon-chevron-right.svg';
import {
  getCachedAvailability,
  loadAvailability,
  invalidateAvailability,
  prefetchAvailability,
  type MonthAvailability,
} from './api';
import { readBookingState } from './state';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  clampToMonthRange,
  daysInMonth,
  formatDateFull,
  formatMonthLabel,
  makeDateKey,
  monthDistance,
  monthOf,
  mondayFirstWeekday,
  parseDateKey,
  parseMonthKey,
  todayKey,
  WEEKDAYS_FULL,
  WEEKDAYS_SHORT,
  type DateKey,
  type MonthKey,
} from './dates';
import './Calendar.css';

/** How far ahead the band takes bookings. */
const MAX_MONTHS_AHEAD = 18;

/** Six week rows, always, so the card never changes height between months. */
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

/** Focus has to land before the browser paints, or the caret visibly jumps to <body> and back. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type CellState = 'pending' | 'past' | 'blocked' | 'free';
type Status = 'loading' | 'ready' | 'error';

interface CalendarProps {
  /** Currently chosen date, or null. */
  value: DateKey | null;
  onSelect: (date: DateKey) => void;
}

/**
 * Month calendar, Monday first, backed by GET /api/bookings/available-dates.
 *
 * Figma's day grid is 17 cells wide — an auto-layout accident the spec tells us not to
 * reproduce; the weekday row above it is the correct 7-column rhythm and this is built to match
 * it. Keyboard behaviour follows the WAI-ARIA grid pattern (roving tabindex, arrows, Home/End,
 * PageUp/PageDown), and unavailable days stay focusable with aria-disabled so they can be
 * discovered rather than silently skipped.
 *
 * Nothing date-dependent is computed during render: the server and the first client render both
 * produce a neutral skeleton, and «today» arrives from an effect.
 */
export function Calendar({ value, onSelect }: CalendarProps) {
  const copy = useSection('booking');
  const monthId = useId();

  const [today, setToday] = useState<DateKey | null>(null);
  const [viewMonth, setViewMonth] = useState<MonthKey | null>(null);
  const [focusDate, setFocusDate] = useState<DateKey | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev' | 'none'>('none');
  const [availability, setAvailability] = useState<MonthAvailability | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  const gridRef = useRef<HTMLDivElement>(null);
  const wantsFocus = useRef(false);

  const minMonth = today ? monthOf(today) : null;
  const maxMonth = minMonth ? addMonths(minMonth, MAX_MONTHS_AHEAD) : null;

  /* «Today» and the opening month are resolved after mount — never during render. The restored
     date is read straight from the store: the `value` prop is still null this early in hydration. */
  useEffect(() => {
    const t = todayKey();
    const stored = readBookingState().date;
    const start = stored && stored >= t ? stored : t;
    setToday(t);
    setViewMonth(monthOf(start));
    setFocusDate(start);
  }, []);

  /* Availability for the month on screen, then a quiet prefetch of the next one. */
  useEffect(() => {
    if (!viewMonth || !today) return undefined;
    const limit = addMonths(monthOf(today), MAX_MONTHS_AHEAD);
    const warmNextMonth = () => {
      const next = addMonths(viewMonth, 1);
      // Never spend a request on a month the visitor is not allowed to reach.
      if (monthDistance(next, limit) >= 0) prefetchAvailability(next);
    };

    const cached = getCachedAvailability(viewMonth);
    if (cached) {
      setAvailability(cached);
      setStatus('ready');
      warmNextMonth();
      return undefined;
    }
    let cancelled = false;
    setAvailability(null);
    setStatus('loading');
    loadAvailability(viewMonth)
      .then((result) => {
        if (cancelled) return;
        setAvailability(result);
        setStatus('ready');
        warmNextMonth();
      })
      .catch(() => {
        if (cancelled) return;
        setAvailability(null);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [viewMonth, today, reloadToken]);

  /* Roving focus: only ever moved in response to a key press, never on mount or on data arrival. */
  useIsomorphicLayoutEffect(() => {
    if (!wantsFocus.current || !focusDate) return;
    wantsFocus.current = false;
    const cell = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`);
    cell?.focus();
  }, [focusDate, viewMonth]);

  const goToMonth = useCallback(
    (next: MonthKey, dir: 'next' | 'prev') => {
      setDirection(dir);
      setViewMonth(next);
    },
    []
  );

  const canGoPrev = Boolean(viewMonth && minMonth && monthDistance(minMonth, viewMonth) > 0);
  const canGoNext = Boolean(viewMonth && maxMonth && monthDistance(viewMonth, maxMonth) > 0);

  /** `keepFocus` — true for PageUp/PageDown, so focus follows the grid; false for the nav buttons,
      where focus must stay on the button the visitor just pressed. */
  const stepMonth = useCallback(
    (delta: number, keepFocus = false) => {
      if (!viewMonth || !minMonth || !maxMonth) return;
      const target = addMonths(viewMonth, delta);
      if (monthDistance(minMonth, target) < 0 || monthDistance(target, maxMonth) < 0) return;
      if (keepFocus) wantsFocus.current = true;
      goToMonth(target, delta > 0 ? 'next' : 'prev');
      // Keep the roving focus on the same day-of-month, clamped to the shorter month.
      if (focusDate) {
        const parts = parseDateKey(focusDate);
        const targetParts = parseMonthKey(target);
        if (parts && targetParts) {
          const day = Math.min(parts.day, daysInMonth(targetParts.year, targetParts.month0));
          setFocusDate(makeDateKey(targetParts.year, targetParts.month0, day));
        }
      }
    },
    [viewMonth, minMonth, maxMonth, focusDate, goToMonth]
  );

  const moveFocus = useCallback(
    (nextDate: DateKey) => {
      if (!minMonth || !maxMonth) return;
      const clamped = clampToMonthRange(nextDate, minMonth, maxMonth);
      // Arrowing off the first or last allowed month clamps back onto the current cell: nothing
      // re-renders, so the pending-focus flag must not be left armed for a later state change.
      if (clamped === focusDate) return;
      const nextMonth = monthOf(clamped);
      wantsFocus.current = true;
      if (viewMonth && nextMonth !== viewMonth) {
        goToMonth(nextMonth, monthDistance(viewMonth, nextMonth) > 0 ? 'next' : 'prev');
      }
      setFocusDate(clamped);
    },
    [minMonth, maxMonth, viewMonth, focusDate, goToMonth]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!focusDate || event.altKey || event.ctrlKey || event.metaKey) return;
    const parts = parseDateKey(focusDate);
    if (!parts) return;

    switch (event.key) {
      case 'ArrowLeft':
        moveFocus(addDays(focusDate, -1));
        break;
      case 'ArrowRight':
        moveFocus(addDays(focusDate, 1));
        break;
      case 'ArrowUp':
        moveFocus(addDays(focusDate, -7));
        break;
      case 'ArrowDown':
        moveFocus(addDays(focusDate, 7));
        break;
      case 'Home':
        moveFocus(addDays(focusDate, -mondayFirstWeekday(parts.year, parts.month0, parts.day)));
        break;
      case 'End':
        moveFocus(addDays(focusDate, 6 - mondayFirstWeekday(parts.year, parts.month0, parts.day)));
        break;
      case 'PageUp':
        stepMonth(event.shiftKey ? -12 : -1, true);
        break;
      case 'PageDown':
        stepMonth(event.shiftKey ? 12 : 1, true);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const cellState = (date: DateKey): CellState => {
    if (!today || !availability) return 'pending';
    if (date < today) return 'past';
    return availability.available.has(date) ? 'free' : 'blocked';
  };

  const retry = () => {
    if (viewMonth) invalidateAvailability(viewMonth);
    setReloadToken((n) => n + 1);
  };

  const weeks = viewMonth ? buildMonthGrid(viewMonth) : null;
  const loading = status === 'loading';

  return (
    <div className="site-cal site-booking-card">
      <div className="site-cal__nav">
        {/* aria-disabled, not `disabled`: at the range boundary the button that was just pressed
            must keep the focus instead of dropping it on <body>. */}
        <button
          type="button"
          className="site-cal__step"
          aria-label={copy.prevMonthLabel}
          aria-disabled={canGoPrev ? undefined : true}
          onClick={() => {
            if (canGoPrev) stepMonth(-1);
          }}
        >
          <img src={chevronLeftUrl} width={24} height={24} alt="" />
        </button>
        <h2 className="site-cal__month" id={monthId} aria-live="polite">
          {viewMonth ? formatMonthLabel(viewMonth) : <span className="site-cal__month-skeleton" aria-hidden="true" />}
          {viewMonth ? null : <span className="site-visually-hidden">{copy.loadingLabel}</span>}
        </h2>
        <button
          type="button"
          className="site-cal__step"
          aria-label={copy.nextMonthLabel}
          aria-disabled={canGoNext ? undefined : true}
          onClick={() => {
            if (canGoNext) stepMonth(1);
          }}
        >
          <img src={chevronRightUrl} width={24} height={24} alt="" />
        </button>
      </div>

      {import.meta.env.DEV && availability?.mock ? <p className="site-cal__devbadge">DEV: mock data</p> : null}

      <div
        className={`site-cal__grid${loading ? ' is-loading' : ''}`}
        role="grid"
        aria-labelledby={monthId}
        aria-busy={loading || undefined}
        onKeyDown={handleKeyDown}
        ref={gridRef}
      >
        <div role="rowgroup" className="site-cal__head">
          <div role="row" className="site-cal__row">
            {WEEKDAYS_SHORT.map((short, i) => (
              <span key={short} role="columnheader" className="site-cal__weekday" aria-label={WEEKDAYS_FULL[i]}>
                {short}
              </span>
            ))}
          </div>
        </div>

        <div role="rowgroup" className="site-cal__weeks" key={viewMonth ?? 'skeleton'} data-dir={direction}>
          {weeks
            ? weeks.map((row, rowIndex) => (
                <div role="row" className="site-cal__row" key={rowIndex}>
                  {row.map((cell, cellIndex) =>
                    cell.date === null ? (
                      <span role="gridcell" className="site-cal__cell site-cal__cell--blank" key={`b${cellIndex}`} />
                    ) : (
                      <DayCell
                        key={cell.date}
                        date={cell.date}
                        day={cell.day}
                        state={cellState(cell.date)}
                        isToday={cell.date === today}
                        isSelected={cell.date === value}
                        isFocusTarget={cell.date === focusDate}
                        unavailableLabel={copy.unavailableLabel}
                        todayLabel={copy.todayLabel}
                        onSelect={(date) => {
                          setFocusDate(date);
                          onSelect(date);
                        }}
                      />
                    )
                  )}
                </div>
              ))
            : SKELETON_ROWS.map((row) => (
                <div role="row" className="site-cal__row" key={row}>
                  {WEEKDAYS_SHORT.map((weekday) => (
                    <span role="gridcell" className="site-cal__cell site-cal__cell--skeleton" key={weekday} />
                  ))}
                </div>
              ))}
        </div>
      </div>

      {status === 'error' ? (
        <p className="site-cal__error" role="alert">
          <span>{copy.errors.availability}</span>
          <button type="button" className="site-cal__retry" onClick={retry}>
            {copy.retryLabel}
          </button>
        </p>
      ) : null}
    </div>
  );
}

interface DayCellProps {
  date: DateKey;
  day: number;
  state: CellState;
  isToday: boolean;
  isSelected: boolean;
  isFocusTarget: boolean;
  unavailableLabel: string;
  todayLabel: string;
  onSelect: (date: DateKey) => void;
}

function DayCell({
  date,
  day,
  state,
  isToday,
  isSelected,
  isFocusTarget,
  unavailableLabel,
  todayLabel,
  onSelect,
}: DayCellProps) {
  const selectable = state === 'free';
  const notes: string[] = [];
  if (isToday) notes.push(todayLabel);
  if (state === 'blocked' || state === 'past') notes.push(unavailableLabel);

  return (
    <button
      type="button"
      role="gridcell"
      data-date={date}
      className={`site-cal__cell site-cal__cell--${state}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
      // Unavailable days stay reachable (aria-disabled, not disabled) so keyboard users can
      // read why a date is greyed out instead of the arrow keys jumping over it.
      aria-disabled={selectable ? undefined : true}
      aria-selected={isSelected}
      aria-label={notes.length ? `${formatDateFull(date)} — ${notes.join(', ')}` : formatDateFull(date)}
      tabIndex={isFocusTarget ? 0 : -1}
      onClick={() => {
        if (selectable) onSelect(date);
      }}
    >
      {day}
    </button>
  );
}
