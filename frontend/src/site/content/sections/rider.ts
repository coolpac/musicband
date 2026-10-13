import type { SectionSchema } from '../schema';

export interface RiderContent {
  heading: string;
  text: string;
  buttonLabel: string;
  /** Technical/household rider file. Empty = button hidden. */
  fileUrl: string;
}

/**
 * Figma (345:1402) is a red band with «РАЙДЕР» and nothing else — no copy, no button. The band
 * always renders; the text and the download button stay empty until the client supplies them.
 * Nothing is invented here.
 */
export const riderDefaults: RiderContent = {
  // Verbatim from Figma (345:1403).
  heading: 'РАЙДЕР',
  text: '',
  buttonLabel: 'Скачать райдер',
  fileUrl: '',
};

export const riderSchema: SectionSchema = {
  id: 'rider',
  title: 'Райдер',
  description: 'Красная полоса с заголовком выводится всегда. Текст и кнопка скачивания появятся, когда их заполнят.',
  fields: [
    { kind: 'text', key: 'heading', label: 'Заголовок', hint: 'На сайте выводится заглавными буквами', maxLength: 40 },
    {
      kind: 'textarea',
      key: 'text',
      label: 'Текст',
      rows: 4,
      hint: 'Коротко: что нужно группе на площадке. Переносы строк сохраняются',
      maxLength: 1200,
    },
    { kind: 'text', key: 'buttonLabel', label: 'Текст кнопки', maxLength: 40 },
    {
      kind: 'url',
      key: 'fileUrl',
      label: 'Файл райдера',
      placeholder: '/uploads/rider.pdf',
      hint: 'Ссылка на PDF. Пусто — кнопка не выводится',
      maxLength: 500,
    },
  ],
};
