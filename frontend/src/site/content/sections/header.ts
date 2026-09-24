import type { SectionSchema } from '../schema';

export interface NavItem {
  label: string;
  /** In-page anchor («/#formats»), site path («/booking») or an external URL. */
  href: string;
}

export interface HeaderContent {
  nav: NavItem[];
  ctaLabel: string;
}

/**
 * Verbatim from the Figma header frame (345:1298), with three unambiguous fixes:
 *  - the leading space in «` соц. сети`» is trimmed (typing artefact, §9.4 of the spec);
 *  - «РЕПЕРТУАР»/«РАЙДЕР» are stored in sentence case like the other three — all five are
 *    uppercased by CSS, so the admin sees readable labels (§9.6);
 *  - the masked phone «8922750ХХХХ» is not here at all: it lives in `contacts.phone`
 *    and stays empty until a real number is entered.
 */
export const headerDefaults: HeaderContent = {
  nav: [
    { label: 'Главная', href: '/' },
    { label: 'Форматы', href: '/#formats' },
    { label: 'Репертуар', href: '/#repertoire' },
    { label: 'Райдер', href: '/#rider' },
    { label: 'Соц. сети', href: '/#social' },
  ],
  ctaLabel: 'Оставить заявку',
};

/**
 * Content arrays are merged wholesale (see content/resolve.ts), so a hand-edited or stale row
 * in the database reaches rendering untouched. Header and footer both go through this guard
 * rather than trusting `label`/`href` to be strings.
 */
export function sanitizeNav(nav: NavItem[]): NavItem[] {
  return nav.filter(
    (item): item is NavItem =>
      !!item &&
      typeof item.label === 'string' &&
      typeof item.href === 'string' &&
      item.label.trim().length > 0 &&
      item.href.trim().length > 0
  );
}

export const headerSchema: SectionSchema = {
  id: 'header',
  title: 'Шапка',
  description:
    'Меню в верхней строке сайта. Этот же список повторяется в подвале в колонке «Навигация». Телефон рядом с кнопкой берётся из раздела «Контакты».',
  fields: [
    {
      kind: 'list',
      key: 'nav',
      label: 'Пункты меню',
      hint: 'До 7 пунктов: на десктопе они стоят в одну строку, на телефоне открываются в полноэкранном меню.',
      itemLabel: 'Пункт',
      titleKey: 'label',
      minItems: 1,
      maxItems: 7,
      fields: [
        {
          kind: 'text',
          key: 'label',
          label: 'Название',
          hint: 'Пишите обычным текстом («Репертуар») — на сайте буквы станут заглавными автоматически.',
          placeholder: 'Форматы',
          maxLength: 30,
        },
        {
          kind: 'text',
          key: 'href',
          label: 'Ссылка',
          hint: '/ — начало главной, /#formats — блок на главной, /booking — страница бронирования, https://… — внешний сайт.',
          placeholder: '/#formats',
          maxLength: 120,
        },
      ],
    },
    {
      kind: 'text',
      key: 'ctaLabel',
      label: 'Текст красной кнопки',
      hint: 'Кнопка всегда ведёт на первый шаг бронирования. Пусто — кнопка скрыта.',
      placeholder: 'Оставить заявку',
      maxLength: 30,
    },
  ],
};
