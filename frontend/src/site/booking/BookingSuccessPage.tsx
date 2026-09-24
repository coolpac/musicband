import { useEffect, type CSSProperties } from 'react';
import { useSection } from '../content/SiteDataContext';
import { useRouter } from '../router/Router';
import { Button } from '../components/ui/Button';
import { Picture } from '../components/ui/Picture';
import { siteImages } from '../assets/opt/manifest';
import checkUrl from '../assets/booking-success-v2/icon-check.svg';
import { BookingStep, BookingStepFallback, BOOKING_TITLE_ID } from './BookingStep';
import { formatDateLong } from './dates';
import { clearBookingInput, readBookingState, useSubmittedBooking } from './state';
import './BookingSuccessPage.css';

/** «{role} {manager}» → real names from Contacts; an unset name must not leave a gap. */
function interpolate(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Ember burst: hand-picked so the server and the client render byte-identical markup. */
const SPARKS: ReadonlyArray<{ x: number; y: number; r: number; delay: number; accent: boolean }> = [
  { x: -172, y: -96, r: -220, delay: 0, accent: true },
  { x: -128, y: 44, r: 160, delay: 60, accent: false },
  { x: -96, y: -152, r: -90, delay: 30, accent: true },
  { x: -54, y: 108, r: 240, delay: 110, accent: true },
  { x: -28, y: -184, r: 40, delay: 10, accent: false },
  { x: 16, y: 140, r: -140, delay: 90, accent: true },
  { x: 48, y: -168, r: 200, delay: 45, accent: true },
  { x: 92, y: 62, r: -60, delay: 130, accent: false },
  { x: 124, y: -118, r: 120, delay: 25, accent: true },
  { x: 168, y: 26, r: -200, delay: 75, accent: true },
  { x: 196, y: -76, r: 80, delay: 145, accent: false },
  { x: -206, y: 12, r: 300, delay: 55, accent: true },
];

/** Step 3 — «Заявка принята!». */
export function BookingSuccessPage() {
  const copy = useSection('booking');
  const contacts = useSection('contacts');
  const submitted = useSubmittedBooking();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!readBookingState().submitted) {
      navigate('/booking', { replace: true });
      return;
    }
    // The confirmation is on screen, so the half-filled flow behind it can go. The result itself
    // stays for the rest of the tab's life, so a refresh still shows this page.
    clearBookingInput();
  }, [navigate]);

  if (!submitted) {
    return (
      <BookingStepFallback
        title={copy.successTitle}
        message={copy.successEmptyMessage}
        actionLabel={copy.dateTitle}
        actionTo="/booking"
      />
    );
  }

  const message = interpolate(copy.successText, {
    manager: contacts.managerName.trim(),
    role: contacts.managerRole.trim(),
  });

  return (
    <BookingStep step={3} decor={<SuccessPhoto />} maxWidth={720}>
      <div className="site-bsuccess site-booking-card">
        <span className="site-bsuccess__badge" aria-hidden="true">
          <img className="site-bsuccess__check" src={checkUrl} width={36} height={36} alt="" />
        </span>

        <h1 className="site-bsuccess__title" id={BOOKING_TITLE_ID}>
          {copy.successTitle}
        </h1>
        <p className="site-bsuccess__text">{message}</p>

        <dl className="site-bsuccess__echo">
          <div className="site-bsuccess__echo-item">
            <dt>{copy.successDateLabel}</dt>
            <dd>{formatDateLong(submitted.bookingDate)}</dd>
          </div>
          {submitted.bookingTime ? (
            <div className="site-bsuccess__echo-item">
              <dt>{copy.successTimeLabel}</dt>
              <dd>{submitted.bookingTime}</dd>
            </div>
          ) : null}
        </dl>

        {import.meta.env.DEV && submitted.mock ? <p className="site-bsuccess__devbadge">DEV: mock data</p> : null}

        <Button to="/" variant="outline" size="md" shape="rounded" className="site-bsuccess__action">
          {copy.backHomeLabel}
        </Button>

        <span className="site-bsuccess__sparks" aria-hidden="true">
          {SPARKS.map((spark, index) => (
            <span
              key={index}
              className={`site-bsuccess__spark${spark.accent ? ' is-accent' : ''}`}
              style={
                {
                  '--spark-x': `${spark.x}px`,
                  '--spark-y': `${spark.y}px`,
                  '--spark-r': `${spark.r}deg`,
                  '--spark-delay': `${spark.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      </div>
    </BookingStep>
  );
}

/**
 * Full-bleed stage photo. It is only 1280 × 854 — below the 1440 box it fills — so a scrim and a
 * touch of blur do double duty: they hide the softness and keep the card's red glow readable.
 */
function SuccessPhoto() {
  return (
    <span className="site-bsuccess-photo">
      <Picture
        image={siteImages['booking-success-v2/bg-band-photo']}
        alt=""
        sizes="100vw"
        wrapperClassName="site-bsuccess-photo__frame"
        className="site-bsuccess-photo__img"
      />
      <span className="site-bsuccess-photo__scrim" />
    </span>
  );
}
