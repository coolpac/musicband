import type { SectionSchema } from '../schema';

export interface FooterContent {
  tagline: string;
  navHeading: string;
  docsHeading: string;
  contactsHeading: string;
  /** «{year}» is replaced with the current year. */
  copyright: string;
}

/**
 * Verbatim from the Figma footer frame (345:1451), with two fixes:
 *  - «© 2026 КГУЛ» → «© {year} ВГУЛ»: «КГУЛ» is a typo (the brand is ВГУЛ in the logo,
 *    the wordmark and the domain vgulcover.ru), and the hard-coded year would go stale (§9.1–9.2);
 *  - the filler contacts («hello@vgul.ru», «+7 (999) 123-45-67») are NOT defaults here —
 *    the column renders from `contacts` and disappears while those fields are empty (§9.3).
 * The Figma footer nav («Главная / О нас / Репертуар / Афиша / Контакты») is not stored either:
 * the footer mirrors `header.nav`, which the design plan declares canonical.
 */
export const footerDefaults: FooterContent = {
  tagline: 'Эксклюзивные события и живой звук для ваших мероприятий.',
  navHeading: 'Навигация',
  docsHeading: 'Документы',
  contactsHeading: 'Контакты',
  copyright: '© {year} ВГУЛ. Все права защищены.',
};

export const footerSchema: SectionSchema = {
  id: 'footer',
  title: 'Подвал',
  description:
    'Нижний блок сайта. Колонка «Навигация» повторяет меню из раздела «Шапка», «Документы» показывает только заполненные юридические страницы, «Контакты» — телефон и e-mail из раздела «Контакты».',
  fields: [
    {
      kind: 'textarea',
      key: 'tagline',
      label: 'Строка под логотипом',
      hint: 'Одно предложение о группе. Пусто — строка не выводится.',
      placeholder: 'Эксклюзивные события и живой звук для ваших мероприятий.',
      rows: 2,
      maxLength: 200,
    },
    {
      kind: 'text',
      key: 'navHeading',
      label: 'Заголовок колонки с меню',
      placeholder: 'Навигация',
      maxLength: 40,
    },
    {
      kind: 'text',
      key: 'docsHeading',
      label: 'Заголовок колонки с документами',
      hint: 'Колонка появляется, только когда заполнен текст хотя бы одного документа в разделе «Документы».',
      placeholder: 'Документы',
      maxLength: 40,
    },
    {
      kind: 'text',
      key: 'contactsHeading',
      label: 'Заголовок колонки с контактами',
      hint: 'Колонка появляется, когда в разделе «Контакты» заполнен телефон или e-mail.',
      placeholder: 'Контакты',
      maxLength: 40,
    },
    {
      kind: 'text',
      key: 'copyright',
      label: 'Строка об авторских правах',
      hint: '{year} автоматически заменяется текущим годом.',
      placeholder: '© {year} ВГУЛ. Все права защищены.',
      maxLength: 160,
    },
  ],
};
