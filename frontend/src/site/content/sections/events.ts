import type { SectionSchema } from '../schema';

export interface EventsContent {
  heading: string;
  /** CTA of a card that has its own link. */
  detailsLabel: string;
  /** CTA of a card without a link — routes to the booking flow. */
  bookLabel: string;
}

/**
 * Verbatim Figma copy (frame 345:1327). The design uses «ЗАБРОНИРОВАТЬ» in caps on the
 * photo card and «Подробнее» in sentence case elsewhere; both are stored in sentence case
 * because the CTA style is chosen by CSS, not by the string.
 * The афиша itself is not content — cards come from the shared `posters` collection.
 */
export const eventsDefaults: EventsContent = {
  heading: 'Афиша',
  detailsLabel: 'Подробнее',
  bookLabel: 'Забронировать',
};

export const eventsSchema: SectionSchema = {
  id: 'events',
  title: 'Афиша',
  description:
    'Заголовок и подписи кнопок. Сами события берутся из раздела «Афиша» — там же задаются дата, площадка и фото. ' +
    'Если ближайших событий нет, блок на сайте не показывается.',
  fields: [
    { kind: 'text', key: 'heading', label: 'Заголовок блока', maxLength: 40 },
    {
      kind: 'text',
      key: 'detailsLabel',
      label: 'Кнопка на карточке со ссылкой',
      hint: 'Показывается, когда у события заполнена ссылка',
      maxLength: 24,
    },
    {
      kind: 'text',
      key: 'bookLabel',
      label: 'Кнопка на карточке без ссылки',
      hint: 'Ведёт на страницу брони',
      maxLength: 24,
    },
  ],
};
