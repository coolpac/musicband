/**
 * Forgiving Russian phone mask: «+7 (999) 000-00-00».
 *
 * Rules the visitor never has to know about:
 *  • a leading 7 or 8 is read as the country code and dropped, so «89227500000»,
 *    «+7 922 750-00-00» and «9227500000» all land on the same ten digits;
 *  • anything that is not a digit is ignored, so pasting from a contact card works;
 *  • deleting a separator deletes the digit in front of it instead of doing nothing —
 *    otherwise Backspace appears to be broken;
 *  • the caret is placed after the digit the visitor was actually editing, not at the end.
 */

/** The ten national digits, or fewer while the visitor is still typing. */
export function toNationalDigits(input: string): string {
  const digits = input.replace(/\D/g, '');
  const withoutCountry = digits.length > 0 && (digits[0] === '7' || digits[0] === '8') ? digits.slice(1) : digits;
  return withoutCountry.slice(0, 10);
}

/** «9227500000» → «+7 (922) 750-00-00»; partial input formats as far as it goes. */
export function formatPhone(national: string): string {
  if (national.length === 0) return '';
  let out = '+7 (';
  out += national.slice(0, 3);
  if (national.length >= 3) out += ') ';
  if (national.length > 3) out += national.slice(3, 6);
  if (national.length > 6) out += `-${national.slice(6, 8)}`;
  if (national.length > 8) out += `-${national.slice(8, 10)}`;
  return out;
}

export function isValidPhone(value: string): boolean {
  const national = toNationalDigits(value);
  // Russian subscriber numbers are ten digits and never start with 0.
  return national.length === 10 && national[0] !== '0';
}

/** Where the caret belongs once `national.length` digits have been typed up to `nationalIndex`. */
function caretAfterNationalDigit(formatted: string, nationalIndex: number): number {
  if (nationalIndex <= 0) return Math.min(4, formatted.length); // just inside «+7 (»
  let seen = 0;
  let countrySkipped = false;
  for (let i = 0; i < formatted.length; i += 1) {
    if (formatted[i] < '0' || formatted[i] > '9') continue;
    if (!countrySkipped) {
      countrySkipped = true; // the «7» of «+7»
      continue;
    }
    seen += 1;
    if (seen === nationalIndex) return i + 1;
  }
  return formatted.length;
}

export interface MaskResult {
  value: string;
  caret: number;
}

/**
 * @param raw        the input's value straight out of the change event
 * @param caret      the input's selectionStart at that moment
 * @param previous   the value the input held before this edit
 */
export function applyPhoneMask(raw: string, caret: number, previous: string): MaskResult {
  const head = raw.slice(0, caret);
  let digitsBefore = (head.match(/\d/g) ?? []).length;
  let digits = raw.replace(/\D/g, '');

  // Backspace over a separator removes no digit at all; take the digit in front of it instead.
  const deleting = raw.length < previous.length;
  if (deleting && digits === previous.replace(/\D/g, '') && digitsBefore > 0) {
    digits = digits.slice(0, digitsBefore - 1) + digits.slice(digitsBefore);
    digitsBefore -= 1;
  }

  const hadCountryDigit = digits.length > 0 && (digits[0] === '7' || digits[0] === '8');
  const national = (hadCountryDigit ? digits.slice(1) : digits).slice(0, 10);
  // Someone who starts with the habitual «8» must see something happen, not an empty field.
  const value = national.length === 0 && hadCountryDigit ? '+7 (' : formatPhone(national);

  const nationalBefore = Math.min(hadCountryDigit ? Math.max(0, digitsBefore - 1) : digitsBefore, national.length);
  return { value, caret: caretAfterNationalDigit(value, nationalBefore) };
}

/** What goes on the wire: «+79227500000», or '' when the field is empty. */
export function phoneForSubmit(value: string): string {
  const national = toNationalDigits(value);
  return national.length === 10 ? `+7${national}` : value.trim();
}
