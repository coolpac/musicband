import type { SectionSchema } from '../schema';

export interface FormatsContent {
  heading: string;
  /**
   * Names of formats from the shared collection that the website does not show (case-insensitive,
   * whole name). The Mini App and the booking form are unaffected — they read the collection directly.
   */
  hiddenNames: string[];
}

export const formatsDefaults: FormatsContent = {
  heading: 'Форматы выступлений',
  // The owner wants the site to show only the three formats drawn in Figma; «Дуэт» stays bookable in the app.
  hiddenNames: ['Дуэт'],
};

const normaliseName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');

/** True when `name` is listed in `hiddenNames` (same normalisation on both sides). */
export function isHiddenFormat(name: string, hiddenNames: readonly string[]): boolean {
  const target = normaliseName(name);
  return hiddenNames.some((hidden) => typeof hidden === 'string' && hidden.trim() !== '' && normaliseName(hidden) === target);
}

/**
 * A format as it ships with the site, used only while the admin collection is empty
 * (`SiteData.formats` === []). Photos are NOT part of this data: the section pairs the
 * bundled Figma photo to a card by its name, so this file stays pure data and can be
 * imported by the admin bundle without dragging in image assets.
 */
export interface FallbackFormat {
  name: string;
  shortDescription: string;
}

/**
 * The three formats drawn in Figma `FormatsSection` 345:1371 (spec/formats.md §5).
 * Quote characters normalised to «ёлочки» — Figma mixes three styles inside one block
 * (curly “ГАНГСТЕРЫ”, straight "В гостях у Лементалия", guillemets «WELCOME»), which is
 * a paste-in artefact, not a design decision. Also dropped is the manual leading space
 * in « “ПО-НОВЕЕ РУССКИЕ”», which Figma used to fake centring of the title's second line.
 */
export const fallbackFormats: FallbackFormat[] = [
  {
    name: 'Основная программа «ГАНГСТЕРЫ»',
    shortDescription: 'Основной масштабный формат группы «В гостях у Лементалия» для крупных мероприятий.',
  },
  {
    name: 'ШОУ-ПЕРФОМАНС «ПО-НОВЕЕ РУССКИЕ»',
    shortDescription: 'Вокал + гитара и бэк-вокал. Уютное ламповое звучание для камерных вечеров.',
  },
  {
    name: '«WELCOME»',
    shortDescription: 'Встреча и разогрев гостей полным составом или изысканным акустическим дуэтом.',
  },
];

export const formatsSchema: SectionSchema = {
  id: 'formats',
  title: 'Форматы',
  description:
    'Заголовок блока. Карточки (название, описание, фото) редактируются в общем списке форматов — он же используется в приложении и в форме брони. Если у формата нет своего фото, подставляется фото из макета по названию («Welcome», «По-новее русские», «Гангстеры»).',
  fields: [
    {
      kind: 'text',
      key: 'heading',
      label: 'Заголовок',
      hint: 'Белый заголовок по центру, поверх красной волны.',
      maxLength: 80,
    },
    {
      kind: 'stringList',
      key: 'hiddenNames',
      label: 'Не показывать на сайте',
      hint: 'Названия форматов из общего списка, которые сайт скрывает — по одному в строке, точно как в списке форматов (регистр не важен). В приложении и при бронировании они остаются.',
      itemPlaceholder: 'Дуэт',
      maxItems: 20,
    },
  ],
};
