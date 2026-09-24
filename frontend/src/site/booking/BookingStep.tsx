import type { CSSProperties, ReactNode } from 'react';
import { Link } from '../router/Router';
import watermarkUrl from '../assets/booking-datetime-v2/logo-watermark.svg';
import arcDomeUrl from '../assets/booking-datetime-v2/decor-ellipse-239.svg';
import arcWingUrl from '../assets/booking-datetime-v2/decor-vector.svg';
import waveUrl from '../assets/booking-form-v2/bg-vector-glow.svg';
import './booking.css';

/**
 * Frame shared by the three booking steps: decorative background, page title, a step
 * announcement for screen readers, and the slot the step's card lives in.
 *
 * The site header/footer are drawn by the shell — a step never renders its own.
 */

const TOTAL_STEPS = 3;

/** `mask-image` needs the bundler-hashed URL, which only exists in JS. */
function maskVar(url: string): CSSProperties {
  return { '--bk-mask': `url("${url}")` } as CSSProperties;
}

/** Every step labels its <section> with this id — on the <h1> here, or on its own inside a card. */
export const BOOKING_TITLE_ID = 'booking-title';

interface BookingStepProps {
  step: 1 | 2 | 3;
  /** Omit when the step draws its own <h1 id={BOOKING_TITLE_ID}> inside the card (step 3). */
  title?: string;
  /** Optional line under the title. */
  hint?: string;
  /** Decorative layer; always aria-hidden and pointer-events: none. */
  decor?: ReactNode;
  /** Widest the content column may get — Figma: 1200 (step 1), 640 (step 2), 720 (step 3). */
  maxWidth?: number;
  children: ReactNode;
}

export function BookingStep({ step, title, hint, decor, maxWidth, children }: BookingStepProps) {
  const style = maxWidth ? ({ '--bk-inner-max': `${maxWidth}px` } as CSSProperties) : undefined;
  return (
    <section className={`site-booking site-booking--step${step}`} aria-labelledby={BOOKING_TITLE_ID} style={style}>
      {decor ? (
        <div className="site-booking__decor" aria-hidden="true">
          {decor}
        </div>
      ) : null}
      <div className="site-booking__inner">
        <p className="site-visually-hidden">{`Шаг ${step} из ${TOTAL_STEPS}`}</p>
        {title ? (
          <h1 className="site-booking__title" id={BOOKING_TITLE_ID}>
            {title}
          </h1>
        ) : null}
        {hint ? <p className="site-booking__hint">{hint}</p> : null}
        {children}
      </div>
    </section>
  );
}

/**
 * Step 1 art: the giant ВГУЛ wordmark, three red arcs bleeding in from the bottom-left and a
 * right-to-left black gradient sinking the left half of the page.
 *
 * The red vectors ship as `#FF291F` — the logo artwork's red. Per the design doc that drift
 * normalises to `--c-accent`, which is why they are painted as CSS masks rather than <img>:
 * one brand red, no duplicated clipPath ids, and the colour follows the token.
 */
export function BookingDateDecor() {
  return (
    <>
      <span className="site-booking-decor__arcs">
        <span className="site-booking-decor__arc site-booking-decor__arc--dome-a" style={maskVar(arcDomeUrl)} />
        <span className="site-booking-decor__arc site-booking-decor__arc--dome-b" style={maskVar(arcDomeUrl)} />
        <span className="site-booking-decor__arc site-booking-decor__arc--wing" style={maskVar(arcWingUrl)} />
      </span>
      <span className="site-booking-decor__mark" style={maskVar(watermarkUrl)} />
      <span className="site-booking-decor__fade" />
    </>
  );
}

/** Step 2 art: the red wave under a black gradient that dissolves it into the header. */
export function BookingFormDecor() {
  return (
    <span className="site-booking-decor__wave">
      <span className="site-booking-decor__wave-shape" style={maskVar(waveUrl)} />
      <span className="site-booking-decor__wave-fade" />
    </span>
  );
}

interface StepFallbackProps {
  title: string;
  message: string;
  actionLabel: string;
  actionTo: string;
}

/**
 * What /booking/form and /booking/success render when they are opened cold, with nothing in
 * session storage. Identical on the server and on the first client render, so hydration matches;
 * the page then redirects itself from an effect. The link is the no-JS escape hatch.
 */
export function BookingStepFallback({ title, message, actionLabel, actionTo }: StepFallbackProps) {
  return (
    <section className="site-booking site-booking--fallback" aria-labelledby={BOOKING_TITLE_ID}>
      <div className="site-booking__inner">
        <h1 className="site-booking__title" id={BOOKING_TITLE_ID}>
          {title}
        </h1>
        <p className="site-booking__hint">{message}</p>
        <p className="site-booking__fallback-action">
          <Link to={actionTo}>{actionLabel}</Link>
        </p>
      </div>
    </section>
  );
}
