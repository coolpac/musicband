import type { SectionSchema } from '../schema';

export interface CtaContent {
  heading: string;
  tagline: string;
  buttonLabel: string;
}

/**
 * Verbatim from the Figma band «cta-pick-date» (345:1477 — misnamed `Footer` in the file).
 * The band is placed BEFORE the footer, not after it as drawn on the canvas (design plan §7).
 * The informal «Выбери…» is kept as the designer wrote it; the booking screens address the
 * visitor formally, which is a copy decision for the product owner, not a typo to fix here.
 */
export const ctaDefaults: CtaContent = {
  heading: 'Выбери дату своего события',
  tagline: 'Не для всех. Для своих.',
  buttonLabel: 'Забронировать выступление',
};

export const ctaSchema: SectionSchema = {
  id: 'cta',
  title: 'Призыв к действию',
  description: 'Красная полоса в самом низу главной страницы. Кнопка ведёт на первый шаг бронирования.',
  fields: [
    {
      kind: 'text',
      key: 'heading',
      label: 'Заголовок',
      hint: 'Крупный текст на красном фоне. Пусто — блок не выводится.',
      placeholder: 'Выбери дату своего события',
      maxLength: 80,
    },
    {
      kind: 'text',
      key: 'tagline',
      label: 'Подзаголовок',
      hint: 'Короткая строка под заголовком. Пусто — строка не выводится.',
      placeholder: 'Не для всех. Для своих.',
      maxLength: 120,
    },
    {
      kind: 'text',
      key: 'buttonLabel',
      label: 'Текст кнопки',
      hint: 'Пусто — кнопка не выводится.',
      placeholder: 'Забронировать выступление',
      maxLength: 40,
    },
  ],
};
