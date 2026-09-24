/**
 * Нормализация российского номера телефона к единому формату +79XXXXXXXXX.
 * Иначе возвращает строку без изменений (для email и прочих контактов).
 */

const RUSSIAN_COUNTRY_CODE = '7';

/**
 * Проверяет, что строка после удаления нецифровых символов похожа на российский номер
 * (10 цифр с ведущей 9 или 11 цифр с ведущей 7/8).
 */
function looksLikeRussianPhone(digits: string): boolean {
  if (digits.length === 10 && digits[0] === '9') return true;
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) return true;
  return false;
}

/**
 * Строгая нормализация телефона для публичной формы сайта: только цифры имеют значение,
 * результат всегда `+7XXXXXXXXXX` (10 цифр национального номера). Если номер не похож
 * на российский — возвращает null, и форма показывает ошибку поля.
 *
 * В отличие от normalizeContactValue() здесь нет «пропустим как есть»: заявка с сайта
 * приходит от анонима, и телефон — единственный способ с ним связаться.
 */
export function normalizeRussianPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');

  let national: string;
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    national = digits.slice(1);
  } else if (digits.length === 10) {
    national = digits;
  } else {
    return null;
  }

  // Российские коды (мобильные и городские) начинаются с 3, 4, 8 или 9
  if (!/^[3489]\d{9}$/.test(national)) {
    return null;
  }

  return `+${RUSSIAN_COUNTRY_CODE}${national}`;
}

/**
 * Нормализует контактное значение: если это российский номер — к формату +79XXXXXXXXX,
 * иначе возвращает исходную строку (trim).
 */
export function normalizeContactValue(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!looksLikeRussianPhone(digits)) {
    return trimmed;
  }
  const tenDigits =
    digits.length === 11
      ? digits[0] === '7' || digits[0] === '8'
        ? digits.slice(1)
        : digits
      : digits;
  if (tenDigits.length !== 10 || tenDigits[0] !== '9') {
    return trimmed;
  }
  return `+${RUSSIAN_COUNTRY_CODE}${tenDigits}`;
}
