import type { SectionSchema } from '../schema';

export interface RiderContent {
  heading: string;
  text: string;
  buttonLabel: string;
  /** Technical/household rider file. Empty = button hidden. */
  fileUrl: string;
}

/**
 * Figma (345:1402) is a stub: a red band with the word «РАЙДЕР» and nothing else — no copy, no
 * button. Nothing is invented here: with an empty `text` and `fileUrl` the section renders nothing
 * at all, so the band appears only once the client supplies the real rider.
 */
export const riderDefaults: RiderContent = {
  // Figma draws «РАЙДЕР»; stored in sentence case and uppercased by CSS.
  heading: 'Райдер',
  text: '',
  buttonLabel: 'Скачать райдер',
  fileUrl: '',
};

export const riderSchema: SectionSchema = {
  id: 'rider',
  title: 'Райдер',
  description: 'Пока не заполнены ни текст, ни файл — секция не выводится на сайте.',
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
