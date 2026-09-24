/**
 * Вспомогательные функции редактора контента сайта.
 * Здесь нет React — только работа с данными секций (см. src/site/content/schema.ts).
 */

import type { Field } from '../../site/content/schema';
import type { RemoteImage, SectionId } from '../../site/content/types';

/** Контент секции — всегда JSON-объект, поэтому клонируем через JSON. */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isRemoteImage(value: unknown): value is RemoteImage {
  return isPlainObject(value) && typeof value.src === 'string' && value.src.length > 0;
}

/** Пустое значение поля — из описания схемы, а не из дефолтного контента (новый элемент списка). */
export function emptyValueForField(field: Field): unknown {
  switch (field.kind) {
    case 'toggle':
      return false;
    case 'image':
      return null;
    case 'stringList':
    case 'list':
      return [];
    case 'group':
      return Object.fromEntries(field.fields.map((child) => [child.key, emptyValueForField(child)]));
    default:
      return '';
  }
}

export function emptyItemForList(fields: Field[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field.key, emptyValueForField(field)]));
}

/** Текст «Строка 1», «Строка 2» и т.п. для свёрнутого элемента списка без titleKey. */
export function listItemTitle(item: unknown, itemLabel: string, index: number, titleKey?: string): string {
  if (titleKey && isPlainObject(item)) {
    const raw = item[titleKey];
    if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  }
  return `${itemLabel} ${index + 1}`;
}

/**
 * Куда ведёт кнопка «Открыть на сайте». Секции без собственного якоря открывают главную.
 * Partial — чтобы добавление новой секции другим автором не ломало сборку админки.
 */
const SECTION_LINKS: Partial<Record<SectionId, string>> = {
  hero: '/#hero',
  events: '/#events',
  whyUs: '/#why-us',
  formats: '/#formats',
  video: '/#video',
  repertoire: '/#repertoire',
  rider: '/#rider',
  partners: '/#partners',
  social: '/#social',
  cta: '/#cta',
  booking: '/booking',
  legal: '/privacy',
};

export function sectionSiteLink(section: string): string {
  return SECTION_LINKS[section as SectionId] ?? '/';
}

export function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}
