/**
 * Проверка черновика секции перед сохранением.
 * Ключ ошибки — путь до поля («panels.0.promoVideoUrl»), он же используется
 * для aria-describedby у контрола.
 */

import type { Field } from '../../site/content/schema';
import { isPlainObject } from './contentModel';

export type FieldErrors = Record<string, string>;

/**
 * Разрешены только те схемы, которые сайт реально умеет открывать.
 * Всё остальное (в первую очередь javascript:) отклоняем — ссылка из админки
 * попадает в href на публичной странице.
 */
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

function isSafeContentUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  // «//example.com» выглядит как относительный путь, но ведёт на чужой домен по текущему протоколу.
  if (trimmed.startsWith('//')) return false;
  return SAFE_URL.test(trimmed);
}

const URL_ERROR =
  'Ссылка должна начинаться с https://, / (страница сайта), # (якорь), mailto: или tel:';

function joinPath(base: string, key: string | number): string {
  return base ? `${base}.${key}` : String(key);
}

function validateField(field: Field, value: unknown, path: string, errors: FieldErrors): void {
  switch (field.kind) {
    case 'text':
    case 'url':
    case 'tel':
    case 'email': {
      const text = typeof value === 'string' ? value : '';
      if (field.maxLength != null && text.length > field.maxLength) {
        errors[path] = `Не больше ${field.maxLength} символов (сейчас ${text.length})`;
        return;
      }
      if (field.kind === 'url' && !isSafeContentUrl(text)) {
        errors[path] = URL_ERROR;
      }
      break;
    }
    case 'textarea': {
      const text = typeof value === 'string' ? value : '';
      if (field.maxLength != null && text.length > field.maxLength) {
        errors[path] = `Не больше ${field.maxLength} символов (сейчас ${text.length})`;
      }
      break;
    }
    case 'stringList': {
      const items = Array.isArray(value) ? value : [];
      if (field.maxItems != null && items.length > field.maxItems) {
        errors[path] = `Не больше ${field.maxItems} строк (сейчас ${items.length})`;
      }
      break;
    }
    case 'group': {
      const nested = isPlainObject(value) ? value : {};
      for (const child of field.fields) {
        validateField(child, nested[child.key], joinPath(path, child.key), errors);
      }
      break;
    }
    case 'list': {
      const items = Array.isArray(value) ? value : [];
      if (field.minItems != null && items.length < field.minItems) {
        errors[path] = `Нужно минимум ${field.minItems} шт.`;
      } else if (field.maxItems != null && items.length > field.maxItems) {
        errors[path] = `Не больше ${field.maxItems} шт. (сейчас ${items.length})`;
      }
      items.forEach((item, index) => {
        const nested = isPlainObject(item) ? item : {};
        for (const child of field.fields) {
          validateField(child, nested[child.key], joinPath(joinPath(path, index), child.key), errors);
        }
      });
      break;
    }
    case 'image':
    case 'toggle':
    default:
      break;
  }
}

export function validateSectionValue(fields: Field[], value: Record<string, unknown>): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fields) {
    validateField(field, value[field.key], field.key, errors);
  }
  return errors;
}
