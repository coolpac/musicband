import { useId, useRef, type KeyboardEvent } from 'react';
import { useSection } from '../content/SiteDataContext';
import { Button } from '../components/ui/Button';
import medallionUrl from '../assets/booking-datetime-v2/decor-ellipse-249.svg';
import signatureUrl from '../assets/booking-datetime-v2/decor-objects.svg';
import { BookingStep, BookingDateDecor } from './BookingStep';
import { Calendar } from './Calendar';
import { setBookingDate, setBookingTime, useBookingDate, useBookingTime } from './state';
import './BookingDatePage.css';

/** Step 1 — «Выберите дату и время». */
export function BookingDatePage() {
  const copy = useSection('booking');
  const date = useBookingDate();
  const time = useBookingTime();
  const timeTitleId = useId();

  // Defensive: the section merge only guarantees «an array», not a clean array of strings.
  const slots = Array.from(
    new Set(copy.timeSlots.filter((slot) => typeof slot === 'string' && slot.trim().length > 0).map((slot) => slot.trim()))
  );
  const needsTime = slots.length > 0;
  const ready = Boolean(date) && (!needsTime || Boolean(time));

  return (
    <BookingStep step={1} title={copy.dateTitle} hint={copy.dateHint} decor={<BookingDateDecor />}>
      <div className="site-booking__cards">
        <Calendar value={date} onSelect={setBookingDate} />

        {needsTime ? (
          <div className="site-booking-time site-booking-card">
            <h2 className="site-booking-time__title" id={timeTitleId}>
              {copy.timeTitle}
            </h2>
            <TimeSlots slots={slots} value={time} onChange={setBookingTime} labelledBy={timeTitleId} />
            <div className="site-booking-time__action">
              <ContinueButton ready={ready} label={copy.continueLabel} />
            </div>
            {/* The greyed-out button says «not yet» to anyone who can see it; this says what is
                still missing to anyone who cannot. */}
            <p className="site-visually-hidden" role="status">
              {ready ? '' : !date ? copy.dateTitle : copy.timeTitle}
            </p>

            {/* The signature medallion deliberately breaks the card's bottom-right corner in
                Figma. It only has room to do that on a wide screen, so it is desktop-only. */}
            <span className="site-booking-time__sign" aria-hidden="true">
              <img src={medallionUrl} width={134} height={135} alt="" />
              <img className="site-booking-time__ink" src={signatureUrl} width={118} height={87} alt="" />
            </span>
          </div>
        ) : (
          <div className="site-booking-time__action site-booking-time__action--bare">
            <ContinueButton ready={ready} label={copy.continueLabel} />
          </div>
        )}
      </div>
    </BookingStep>
  );
}

/** A real <a href> once the flow can advance, an inert button before that — never a fake link. */
function ContinueButton({ ready, label }: { ready: boolean; label: string }) {
  if (!ready) {
    return (
      <Button variant="primary" size="md" shape="rounded" disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button to="/booking/form" variant="primary" size="md" shape="rounded">
      {label}
    </Button>
  );
}

interface TimeSlotsProps {
  slots: string[];
  value: string | null;
  onChange: (slot: string) => void;
  labelledBy: string;
}

/** Single-select chips as a WAI-ARIA radiogroup: arrows move and select, one stop in the tab order. */
function TimeSlots({ slots, value, onChange, labelledBy }: TimeSlotsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(0, slots.indexOf(value ?? ''));

  const focusSlot = (index: number) => {
    const wrapped = (index + slots.length) % slots.length;
    onChange(slots[wrapped]);
    refs.current[wrapped]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        focusSlot(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        focusSlot(index - 1);
        break;
      case 'Home':
        focusSlot(0);
        break;
      case 'End':
        focusSlot(slots.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div className="site-booking-time__slots" role="radiogroup" aria-labelledby={labelledBy}>
      {slots.map((slot, index) => (
        <button
          key={slot}
          type="button"
          role="radio"
          ref={(node) => {
            refs.current[index] = node;
          }}
          className={`site-booking-time__slot${slot === value ? ' is-selected' : ''}`}
          aria-checked={slot === value}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={() => onChange(slot)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {slot}
        </button>
      ))}
    </div>
  );
}
