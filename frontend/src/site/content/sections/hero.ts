import type { RemoteImage } from '../types';
import type { SectionSchema } from '../schema';

/**
 * One offer of the hero diptych. Figma draws exactly two (the classic ВГУЛ show on the left,
 * the «90е / Пацановые русские» show on the right) over one shared poster; the site renders
 * as many as the admin keeps — side by side on desktop, as a swipeable carousel on phones.
 */
export interface HeroPanel {
  badge: string;
  titleLine1: string;
  /** Rendered in brand red. */
  titleLine2: string;
  primaryLabel: string;
  secondaryLabel: string;
  /** Promo video opened by the secondary button in a lightbox. Empty = the button is not shown. */
  promoVideoUrl: string;
}

export interface HeroContent {
  /** Exactly two: left (classic show) and right (90s show). */
  panels: HeroPanel[];
  image: RemoteImage | null;
  imageAlt: string;
}

/**
 * Verbatim Figma copy (frame 345:1667), with these deliberate deviations:
 *  1. stored in sentence case — the design's ALL CAPS is done by CSS `text-transform`, so the
 *     admin types normal Russian and the layout stays uppercase (Figma's own right badge is
 *     typed lowercase «порядочные события» and only *rendered* uppercase);
 *  2. «Лементалия» is kept exactly as the design renders it. The Figma layer is *named*
 *     «В ГОСТЯХ У ЭЛЕМЕНТАЛИЯ», but the typed text lost its leading «Э» — spec/hero.md §9.2
 *     says the rendered string is the source of truth, so it ships unchanged;
 *  3. both Figma headlines are identical (spec §9.1 calls the right one placeholder copy).
 *     Kept as the default and editable per panel, per the plan's «Figma gaps» table;
 *  4. the right button reads «Смотреть промо 90х» with a Cyrillic «х» (Figma's rendered
 *     string), not a Latin «x»;
 *  5. the designer's stray «Афиша» text inside the hero overlay (345:1755) is NOT a field here:
 *     it duplicates the title of the next section.
 * The promo links are the band's real Rutube videos (the same ones the Telegram Mini App uses):
 * left — «ГАНГСТЕРЫ» 2025, right — «По-новее русские!» (the 90s show).
 */
export const heroDefaults: HeroContent = {
  panels: [
    {
      badge: 'Эксклюзивные события',
      titleLine1: 'В гостях у',
      titleLine2: 'Лементалия',
      primaryLabel: 'Оставить заявку',
      secondaryLabel: 'Смотреть промо',
      promoVideoUrl: 'https://rutube.ru/video/56fd172a86aff0d705834ea2bab83d2d/',
    },
    {
      badge: 'Порядочные события',
      titleLine1: 'В гостях у',
      titleLine2: 'Лементалия',
      primaryLabel: 'Оставить заявку',
      secondaryLabel: 'Смотреть промо 90х',
      promoVideoUrl: 'https://rutube.ru/video/d51aff7f8075421432de4660a262ba38/',
    },
  ],
  image: null,
  imageAlt: 'Кавер-группа ВГУЛ: два состава — классическая программа и шоу 90-х',
};

export const heroSchema: SectionSchema = {
  id: 'hero',
  title: 'Первый экран',
  description:
    'Самый первый блок сайта: общий постер на весь экран и два предложения поверх него. ' +
    'На телефоне предложения листаются пальцем.',
  fields: [
    {
      kind: 'image',
      key: 'image',
      label: 'Постер на весь экран',
      hint: 'Горизонтальная фотография 1920×1080 и больше. Левая половина — один состав, правая — второй. Пусто — остаётся постер из макета',
    },
    {
      kind: 'text',
      key: 'imageAlt',
      label: 'Описание постера для поиска и незрячих',
      hint: 'Одно предложение: кто и что на фотографии. Видно только поисковикам и скринридерам',
      maxLength: 160,
    },
    {
      kind: 'list',
      key: 'panels',
      label: 'Предложения',
      itemLabel: 'Предложение',
      titleKey: 'titleLine2',
      minItems: 1,
      maxItems: 3,
      fields: [
        {
          kind: 'text',
          key: 'badge',
          label: 'Плашка над заголовком',
          hint: 'Короткая фраза, 2–3 слова. На сайте печатается заглавными',
          maxLength: 40,
        },
        {
          kind: 'text',
          key: 'titleLine1',
          label: 'Заголовок, первая строка',
          hint: 'Белая строка. Печатается заглавными',
          maxLength: 30,
        },
        {
          kind: 'text',
          key: 'titleLine2',
          label: 'Заголовок, вторая строка',
          hint: 'Красная строка — название шоу или площадки. Печатается заглавными',
          maxLength: 30,
        },
        {
          kind: 'text',
          key: 'primaryLabel',
          label: 'Текст красной кнопки',
          hint: 'Ведёт на страницу брони. Пусто — кнопка не показывается',
          maxLength: 30,
        },
        {
          kind: 'text',
          key: 'secondaryLabel',
          label: 'Текст кнопки промо',
          hint: 'Открывает видео в окне поверх сайта',
          maxLength: 30,
        },
        {
          kind: 'url',
          key: 'promoVideoUrl',
          label: 'Ссылка на промо-видео',
          hint: 'YouTube, VK Видео, Rutube или прямая ссылка на mp4. Пусто — кнопка промо не показывается',
          maxLength: 300,
        },
      ],
    },
  ],
};
