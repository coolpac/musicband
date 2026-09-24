import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  type TextareaHTMLAttributes,
} from 'react';
import chevronDownUrl from '../assets/booking-form-v2/icon-chevron-down.svg';
import { applyPhoneMask } from './phone';
import './fields.css';

/** The select's caret asset only has a URL once the bundler has hashed it. */
const chevronStyle = { '--field-chevron': `url("${chevronDownUrl}")` } as CSSProperties;

/**
 * Form controls for step 2. Every field is a real <label for>, its message is wired with
 * aria-describedby + aria-invalid, and nothing is styled by placeholder alone.
 */

/** Focus has to land before paint, or the caret visibly jumps to the end of the masked value. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface ShellProps {
  id: string;
  label: string;
  required?: boolean;
  requiredMark: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

function FieldShell({ id, label, required, requiredMark, error, className, children }: ShellProps) {
  return (
    <div className={`site-field${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}>
      <label className="site-field__label" htmlFor={id}>
        {label}
        {required ? (
          <>
            <span className="site-field__required" aria-hidden="true">
              {requiredMark}
            </span>
            <span className="site-visually-hidden">, обязательное поле</span>
          </>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="site-field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface CommonProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  requiredMark: string;
  placeholder?: string;
  className?: string;
}

interface TextFieldProps extends CommonProps {
  type?: 'text' | 'email';
  autoComplete?: string;
  inputMode?: 'text' | 'email';
  enterKeyHint?: 'next' | 'done';
  maxLength?: number;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  required,
  requiredMark,
  placeholder,
  className,
  type = 'text',
  autoComplete,
  inputMode,
  enterKeyHint,
  maxLength,
  inputRef,
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} required={required} requiredMark={requiredMark} error={error} className={className}>
      <input
        className="site-field__control"
        id={id}
        name={id}
        ref={inputRef}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </FieldShell>
  );
}

interface PhoneFieldProps extends CommonProps {
  inputRef?: RefObject<HTMLInputElement | null>;
}

/** Phone input with the forgiving RU mask. See phone.ts for why the caret is managed by hand. */
export function PhoneField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  required,
  requiredMark,
  placeholder,
  className,
  inputRef,
}: PhoneFieldProps) {
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;
  const pendingCaret = useRef<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    ref.current?.setSelectionRange(caret, caret);
  }, [value, ref]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const caret = event.target.selectionStart ?? raw.length;
    const result = applyPhoneMask(raw, caret, value);
    pendingCaret.current = result.caret;
    onChange(result.value);
  };

  return (
    <FieldShell id={id} label={label} required={required} requiredMark={requiredMark} error={error} className={className}>
      <input
        className="site-field__control"
        id={id}
        name={id}
        ref={ref}
        type="tel"
        value={value}
        placeholder={placeholder}
        autoComplete="tel"
        inputMode="tel"
        enterKeyHint="next"
        // The mask caps the value at «+7 (999) 000-00-00» (18) on its own. The attribute is only
        // a paste guard, and a tight 18 would truncate «8 (922) 750-00-00 доб. …» before the mask
        // ever got to normalise it.
        maxLength={32}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={handleChange}
        onBlur={onBlur}
      />
    </FieldShell>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends CommonProps {
  options: SelectOption[];
  emptyOption: string;
  selectRef?: RefObject<HTMLSelectElement | null>;
}

/**
 * A native <select>: it gets the platform picker on a phone, keyboard type-ahead on a desktop and
 * correct semantics everywhere. Only the closed state is drawn in Figma, and this matches it.
 */
export function SelectField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  required,
  requiredMark,
  className,
  options,
  emptyOption,
  selectRef,
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} required={required} requiredMark={requiredMark} error={error} className={className}>
      <select
        className="site-field__control site-field__control--select"
        id={id}
        name={id}
        ref={selectRef}
        style={chevronStyle}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      >
        <option value="">{emptyOption}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends CommonProps {
  rows?: number;
  maxLength?: number;
  enterKeyHint?: TextareaHTMLAttributes<HTMLTextAreaElement>['enterKeyHint'];
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  required,
  requiredMark,
  placeholder,
  className,
  rows = 3,
  maxLength,
  enterKeyHint,
  textareaRef,
}: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} required={required} requiredMark={requiredMark} error={error} className={className}>
      <textarea
        className="site-field__control site-field__control--textarea"
        id={id}
        name={id}
        ref={textareaRef}
        rows={rows}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        enterKeyHint={enterKeyHint}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </FieldShell>
  );
}

/**
 * Anti-spam honeypot. Off-screen, out of the tab order and hidden from assistive tech, so only a
 * script that fills every input it finds will touch it. Never `display: none` — many bots skip those.
 */
export function HoneypotField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="site-visually-hidden" aria-hidden="true">
      <label htmlFor="website">Не заполняйте это поле</label>
      <input
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
