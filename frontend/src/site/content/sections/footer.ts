import type { SectionSchema } from '../schema';
import type { NavItem } from './header';

export interface FooterContent {
  tagline: string;
  navHeading: string;
  /** The «Навигация» column. Its own list — it is NOT the header menu. */
  nav: NavItem[];
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
 * The footer menu «Главная / О нас / Репертуар / Афиша / Контакты» is stored as drawn; the design
 * gives no targets, so each label points at the matching landing block («Контакты» → the
 * social block, which is where the band's contact channels live).
 */
export const footerDefaults: FooterContent = {
  tagline: 'Эксклюзивные события и живой звук для ваших мероприятий.',
  navHeading: 'Навигация',
  nav: [
    { label: 'Главная', href: '/' },
    { label: 'О нас', href: '/#why-us' },
    { label: 'Репертуар', href: '/#repertoire' },
    { label: 'Афиша', href: '/#events' },
    { label: 'Контакты', href: '/#social' },
  ],
  docsHeading: 'Документы',
  contactsHeading: 'Контакты',
  copyright: '© {year} ВГУЛ. Все права защищены.',
};

export const footerSchema: SectionSchema = {
  id: 'footer',
  title: 'Подвал',
  description:
    'Нижний блок сайта. «Навигация» — собственный список ссылок подвала (не меню шапки), «Документы» ведут на страницы политики, соглашения и оферты, «Контакты» — телефон и e-mail из раздела «Контакты».',
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
      kind: 'list',
      key: 'nav',
      label: 'Ссылки колонки «Навигация»',
      hint: 'Пусто — колонка скрыта. Ссылка на блок «Афиша» или «Партнёры» пропадает сама, пока этот блок пуст.',
      itemLabel: 'Ссылка',
      titleKey: 'label',
      maxItems: 8,
      fields: [
        {
          kind: 'text',
          key: 'label',
          label: 'Название',
          hint: 'Пишите обычным текстом («О нас») — на сайте буквы станут заглавными автоматически.',
          placeholder: 'О нас',
          maxLength: 30,
        },
        {
          kind: 'text',
          key: 'href',
          label: 'Ссылка',
          hint: '/ — начало главной, /#why-us — блок на главной, /booking — страница бронирования, https://… — внешний сайт.',
          placeholder: '/#why-us',
          maxLength: 120,
        },
      ],
    },
    {
      kind: 'text',
      key: 'docsHeading',
      label: 'Заголовок колонки с документами',
      hint: 'Колонка выводится всегда. Пока текст документа не заполнен в разделе «Документы», его страница отвечает «не найдено».',
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
