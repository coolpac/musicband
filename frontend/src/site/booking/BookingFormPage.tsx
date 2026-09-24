import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useSection, useSiteData } from '../content/SiteDataContext';
import { Link, useRouter } from '../router/Router';
import { Button } from '../components/ui/Button';
import { trackGoal } from '../seo/analytics';
import { BookingStep, BookingFormDecor, BookingStepFallback } from './BookingStep';
import { BookingSubmitError, submitBooking } from './api';
import { formatDateLong } from './dates';
import { HoneypotField, PhoneField, SelectField, TextAreaField, TextField } from './fields';
import { isValidPhone, phoneForSubmit } from './phone';
import {
  EMPTY_DRAFT,
  flushBookingState,
  markBookingFormOpened,
  readBookingState,
  setBookingDraft,
  setSubmittedBooking,
  useBookingDate,
  useBookingTime,
  type BookingDraft,
} from './state';
import type { BookingContent } from '../content/sections/booking';
import './BookingFormPage.css';

type FieldName = keyof BookingDraft;

/** Tab order — also the order the first invalid field is looked for in. */
const FIELD_ORDER: FieldName[] = ['fullName', 'phone', 'email', 'city', 'formatId', 'comment'];

const COMMENT_MAX = 2000;

type FieldErrors = Partial<Record<FieldName, string>>;

function validate(values: BookingDraft, copy: BookingContent): FieldErrors {
  const errors: FieldErrors = {};

  const fullName = values.fullName.trim();
  if (!fullName) errors.fullName = copy.errors.required;
  else if (fullName.length < 2 || !/\p{L}/u.test(fullName)) errors.fullName = copy.errors.fullName;

  if (!values.phone.trim()) errors.phone = copy.errors.required;
  else if (!isValidPhone(values.phone)) errors.phone = copy.errors.phone;

  const email = values.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = copy.errors.email;

  return errors;
}

interface FormError {
  message: string;
  /** 409: the visitor has to go back and pick a different day. */
  offerAnotherDate: boolean;
  /**
   * Whether focus should land on the message itself. `Button loading` renders a `disabled`
   * button, which drops focus on <body> the moment the submit starts; for a failure that no
   * single field can explain, the message is where the visitor has to be put back.
   */
  takeFocus: boolean;
}

/** Step 2 — «Заполните анкету». */
export function BookingFormPage() {
  const copy = useSection('booking');
  const legal = useSection('legal');
  const { formats } = useSiteData();
  const date = useBookingDate();
  const time = useBookingTime();
  const { navigate } = useRouter();

  const [values, setValues] = useState<BookingDraft>(EMPTY_DRAFT);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mountedAt = useRef(0);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const formatRef = useRef<HTMLSelectElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  /* Guard + seed. Both read the store imperatively: the hooks above are still on their empty
     server snapshot during the hydration commit this effect runs in. */
  useEffect(() => {
    mountedAt.current = Date.now();
    const stored = readBookingState();
    if (!stored.date) {
      navigate('/booking', { replace: true });
      return;
    }
    markBookingFormOpened();
    setValues(stored.draft);
  }, [navigate]);

  /* Leaving the page — a link, the back button, a reload, closing the tab — must not drop a
     keystroke that is still sitting in the 400ms autosave debounce. */
  useEffect(() => {
    window.addEventListener('pagehide', flushBookingState);
    return () => {
      window.removeEventListener('pagehide', flushBookingState);
      flushBookingState();
    };
  }, []);

  useEffect(() => {
    if (formError?.takeFocus) alertRef.current?.focus();
  }, [formError]);

  if (!date) {
    return (
      <BookingStepFallback
        title={copy.formTitle}
        message={copy.formEmptyMessage}
        actionLabel={copy.dateTitle}
        actionTo="/booking"
      />
    );
  }

  const setField = (name: FieldName) => (value: string) => {
    const next = { ...values, [name]: value };
    setValues(next);
    // Autosave is written here rather than from an effect: an effect cannot tell the seeded
    // first render apart from a real edit, and would overwrite the restored draft with blanks.
    setBookingDraft(next);
    // Typing in a field that is already flagged clears the flag as soon as it becomes valid.
    if (errors[name] && !validate(next, copy)[name]) {
      setErrors((prev) => stripKey(prev, name));
    }
  };

  const blurField = (name: FieldName) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const next = validate(values, copy);
    setErrors((prev) => (next[name] ? { ...prev, [name]: next[name] } : stripKey(prev, name)));
  };

  const focusField = (name: FieldName) => {
    const target =
      name === 'fullName'
        ? fullNameRef.current
        : name === 'phone'
          ? phoneRef.current
          : name === 'email'
            ? emailRef.current
            : name === 'city'
              ? cityRef.current
              : name === 'formatId'
                ? formatRef.current
                : commentRef.current;
    target?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const found = validate(values, copy);
    setErrors(found);
    const allTouched: Partial<Record<FieldName, boolean>> = {};
    for (const name of FIELD_ORDER) allTouched[name] = true;
    setTouched(allTouched);
    const firstInvalid = FIELD_ORDER.find((name) => found[name]);
    if (firstInvalid) {
      setFormError({ message: copy.errors.summary, offerAnotherDate: false, takeFocus: false });
      focusField(firstInvalid);
      return;
    }

    setFormError(null);
    setSubmitting(true);
    const stored = readBookingState();
    try {
      const result = await submitBooking({
        bookingDate: stored.date ?? date,
        ...(stored.time ? { bookingTime: stored.time } : {}),
        fullName: values.fullName.trim(),
        phone: phoneForSubmit(values.phone),
        ...(values.email.trim() ? { email: values.email.trim() } : {}),
        ...(values.city.trim() ? { city: values.city.trim() } : {}),
        ...(values.formatId ? { formatId: values.formatId } : {}),
        ...(values.comment.trim() ? { comment: values.comment.trim() } : {}),
        consent: true,
        website: honeypot,
        // Measured from when the anketa was first opened, which survives a refresh — see state.ts.
        elapsedMs: Math.max(0, Date.now() - (stored.formStartedAt ?? mountedAt.current)),
      });
      setSubmittedBooking(result);
      trackGoal('booking_submitted');
      navigate('/booking/success', { replace: true });
      return;
    } catch (error) {
      // Nothing the visitor typed is touched here — the draft stays, so a retry costs one tap.
      const failure = error instanceof BookingSubmitError ? error : null;
      const serverMessage = failure?.message ?? '';
      // 422 carries «field → message»; hang each one under its own input and focus the first.
      const flagged = failure?.kind === 'validation' ? FIELD_ORDER.filter((name) => failure.fields[name]) : [];

      if (flagged.length > 0) {
        setErrors((prev) => {
          const next = { ...prev };
          for (const name of flagged) next[name] = failure?.fields[name];
          return next;
        });
        setTouched((prev) => {
          const next = { ...prev };
          for (const name of flagged) next[name] = true;
          return next;
        });
        setFormError({ message: copy.errors.summary, offerAnotherDate: false, takeFocus: false });
        focusField(flagged[0]);
      } else if (failure?.kind === 'dateUnavailable') {
        setFormError({ message: copy.errors.dateUnavailable, offerAnotherDate: true, takeFocus: true });
      } else if (failure?.kind === 'rateLimited') {
        setFormError({ message: copy.errors.rateLimited, offerAnotherDate: false, takeFocus: true });
      } else if (failure?.kind === 'network') {
        setFormError({ message: copy.errors.network, offerAnotherDate: false, takeFocus: true });
      } else if (failure?.kind === 'validation') {
        setFormError({ message: serverMessage || copy.errors.generic, offerAnotherDate: false, takeFocus: true });
      } else {
        setFormError({ message: copy.errors.generic, offerAnotherDate: false, takeFocus: true });
      }
    }
    setSubmitting(false);
  };

  const fields = copy.fields;
  const showFormats = formats.length > 0;
  const hasPrivacyDoc = legal.privacy.body.trim().length > 0;

  return (
    <BookingStep step={2} title={copy.formTitle} decor={<BookingFormDecor />} maxWidth={640}>
      <form className="site-bform site-booking-card" noValidate onSubmit={handleSubmit}>
        <HoneypotField value={honeypot} onChange={setHoneypot} />

        <p className="site-bform__summary">
          <span className="site-bform__summary-label">{copy.summaryLabel}</span>
          <strong className="site-bform__summary-value">
            {formatDateLong(date)}
            {time ? `, ${time}` : ''}
          </strong>
          <Link className="site-bform__change" to="/booking">
            {copy.changeDateLabel}
          </Link>
        </p>

        <div className="site-bform__fields">
          <TextField
            id="fullName"
            label={fields.fullName.label}
            placeholder={fields.fullName.placeholder}
            value={values.fullName}
            onChange={setField('fullName')}
            onBlur={blurField('fullName')}
            error={touched.fullName ? errors.fullName : undefined}
            required
            requiredMark={copy.requiredMark}
            autoComplete="name"
            enterKeyHint="next"
            maxLength={120}
            inputRef={fullNameRef}
            className="site-bform__field--wide"
          />

          <PhoneField
            id="phone"
            label={fields.phone.label}
            placeholder={fields.phone.placeholder}
            value={values.phone}
            onChange={setField('phone')}
            onBlur={blurField('phone')}
            error={touched.phone ? errors.phone : undefined}
            required
            requiredMark={copy.requiredMark}
            inputRef={phoneRef}
          />

          <TextField
            id="email"
            type="email"
            label={fields.email.label}
            placeholder={fields.email.placeholder}
            value={values.email}
            onChange={setField('email')}
            onBlur={blurField('email')}
            error={touched.email ? errors.email : undefined}
            requiredMark={copy.requiredMark}
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            maxLength={160}
            inputRef={emailRef}
          />

          <TextField
            id="city"
            label={fields.city.label}
            placeholder={fields.city.placeholder}
            value={values.city}
            onChange={setField('city')}
            onBlur={blurField('city')}
            requiredMark={copy.requiredMark}
            autoComplete="address-level2"
            enterKeyHint="next"
            maxLength={120}
            inputRef={cityRef}
            className={showFormats ? undefined : 'site-bform__field--wide'}
          />

          {showFormats ? (
            <SelectField
              id="formatId"
              label={fields.format.label}
              emptyOption={fields.format.emptyOption}
              options={formats.map((format) => ({ value: format.id, label: format.name }))}
              value={values.formatId}
              onChange={setField('formatId')}
              requiredMark={copy.requiredMark}
              selectRef={formatRef}
            />
          ) : null}

          <TextAreaField
            id="comment"
            label={fields.comment.label}
            placeholder={fields.comment.placeholder}
            value={values.comment}
            onChange={setField('comment')}
            requiredMark={copy.requiredMark}
            rows={3}
            maxLength={COMMENT_MAX}
            enterKeyHint="done"
            textareaRef={commentRef}
            className="site-bform__field--wide"
          />
        </div>

        {formError ? (
          <p className="site-bform__alert" role="alert" tabIndex={-1} ref={alertRef}>
            <span>{formError.message}</span>
            {formError.offerAnotherDate ? (
              <Link className="site-bform__alert-link" to="/booking">
                {copy.pickAnotherDateLabel}
              </Link>
            ) : null}
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="md" shape="rounded" block loading={submitting}>
          {copy.submitLabel}
        </Button>

        <ConsentLine
          text={legal.consentText}
          linkLabel={copy.consentPrivacyLabel}
          link={hasPrivacyDoc ? <Link to="/privacy">{copy.consentPrivacyLabel}</Link> : null}
        />
      </form>
    </BookingStep>
  );
}

function stripKey(errors: FieldErrors, name: FieldName): FieldErrors {
  if (!(name in errors)) return errors;
  const next = { ...errors };
  delete next[name];
  return next;
}

/** «…согласно {privacy}.» — a real link when the policy has a body, plain words when it does not. */
function ConsentLine({ text, linkLabel, link }: { text: string; linkLabel: string; link: ReactNode }) {
  const parts = text.split('{privacy}');
  if (parts.length === 1) return <p className="site-bform__consent">{text}</p>;
  return (
    <p className="site-bform__consent">
      {parts[0]}
      {link ?? linkLabel}
      {parts.slice(1).join('{privacy}')}
    </p>
  );
}
