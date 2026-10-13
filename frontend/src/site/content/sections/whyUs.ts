import type { RemoteImage } from '../types';
import type { SectionSchema } from '../schema';

export interface WhyUsCard {
  /** Red eyebrow, «номер / тема» — e.g. «01 / ШОУ». */
  label: string;
  text: string;
}

export interface WhyUsContent {
  heading: string;
  cards: WhyUsCard[];
  /** Full-bleed background photo. null = the concert shot bundled with the site. */
  image: RemoteImage | null;
}

/**
 * Copy verbatim from Figma `WhyUsSection` 345:1358 (spec/why-us.md), including the straight
 * ASCII quotes around "ПРИЗВАНИЕ АРТИСТ 2025" on card 3 — as drawn, so the text wraps in the
 * same four lines as the design.
 */
export const whyUsDefaults: WhyUsContent = {
  heading: 'Почему мы?',
  cards: [
    {
      label: '01 / ШОУ',
      text: 'Профессиональные музыканты, свои инструменты, авторские аранжировки и целых 3 мужских вокала для невероятного звучания.',
    },
    {
      label: '02 / РЕПЕРТУАР',
      text: 'Возможность составления индивидуального репертуара под концепт вашего мероприятия (не позднее чем за месяц).',
    },
    {
      label: '03 / СТАТУС',
      text: 'Призеры престижной профессиональной премии "ПРИЗВАНИЕ АРТИСТ 2025". Гарантия высочайшего качества работы.',
    },
  ],
  image: null,
};

export const whyUsSchema: SectionSchema = {
  id: 'whyUs',
  title: 'Почему мы',
  description: 'Блок преимуществ на фоне концертной фотографии. Без карточек блок не показывается.',
  fields: [
    {
      kind: 'text',
      key: 'heading',
      label: 'Заголовок',
      hint: 'Крупный белый заголовок по центру блока.',
      maxLength: 80,
    },
    {
      kind: 'image',
      key: 'image',
      label: 'Фоновая фотография',
      hint: 'Тёмный горизонтальный кадр, от 1920×1080. Пусто — используется фото из макета.',
    },
    {
      kind: 'list',
      key: 'cards',
      label: 'Карточки преимуществ',
      itemLabel: 'Карточка',
      titleKey: 'label',
      minItems: 1,
      maxItems: 6,
      hint: 'На широком экране — 3 в ряд, на планшете 2, на телефоне 1.',
      fields: [
        {
          kind: 'text',
          key: 'label',
          label: 'Подпись',
          hint: 'Красным, заглавными: «01 / ШОУ». Номер проставляется вручную.',
          placeholder: '01 / ШОУ',
          maxLength: 40,
        },
        {
          kind: 'textarea',
          key: 'text',
          label: 'Текст',
          rows: 4,
          maxLength: 240,
          hint: 'Одно-два предложения, ориентир — 120 символов.',
        },
      ],
    },
  ],
};
