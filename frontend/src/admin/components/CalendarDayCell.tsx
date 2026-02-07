import { memo } from 'react';

/** Минимальный контракт дня для ячейки календаря (для стабильного memo) */
export interface CalendarDayCellDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isBlocked: boolean;
  hasBooking: boolean;
  booking?: { status: 'pending' | 'confirmed' | 'cancelled' } | null;
  isPast: boolean;
}

export interface CalendarDayCellProps {
  day: CalendarDayCellDay;
  onDayClick: (day: CalendarDayCellDay) => void;
}

function CalendarDayCellComponent({ day, onDayClick }: CalendarDayCellProps) {
  const {
    date,
    isCurrentMonth,
    isToday,
    isBlocked,
    hasBooking,
    booking,
    isPast,
  } = day;

  const classNames = [
    'calendar-day',
    !isCurrentMonth && 'calendar-day--other-month',
    isToday && 'calendar-day--today',
    isBlocked && 'calendar-day--blocked',
    hasBooking && 'calendar-day--booked',
    isPast && 'calendar-day--past',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classNames}
      onClick={() => onDayClick(day)}
      disabled={isPast && !hasBooking}
      aria-label={`${date.getDate()}${isBlocked ? ', заблокировано' : ''}${hasBooking ? ', есть заявка' : ''}`}
    >
      <span className="calendar-day__number">{date.getDate()}</span>
      {hasBooking && booking?.status && (
        <span className={`calendar-day__status calendar-day__status--${booking.status}`}>
          {booking.status === 'confirmed' && '✓'}
          {booking.status === 'pending' && '⏳'}
          {booking.status === 'cancelled' && '✗'}
        </span>
      )}
      {isBlocked && <span className="calendar-day__blocked-icon">🚫</span>}
    </button>
  );
}

export const CalendarDayCell = memo(CalendarDayCellComponent);
