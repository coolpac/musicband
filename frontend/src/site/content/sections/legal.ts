import type { SectionSchema } from '../schema';

export interface LegalDocument {
  title: string;
  /**
   * Plain text. Blank line = new paragraph; a line starting with «## » = subheading.
   * Rendered as text nodes only (never as HTML), so admin input cannot inject markup.
   * Empty body = the page returns 404 and its links are hidden.
   */
  body: string;
}

export interface LegalContent {
  privacy: LegalDocument;
  terms: LegalDocument;
  offer: LegalDocument;
  /** Shown under the booking form submit button; «{privacy}» is replaced by a link to /privacy. */
  consentText: string;
}

export const legalDefaults: LegalContent = {
  privacy: { title: 'Политика конфиденциальности', body: '' },
  terms: { title: 'Пользовательское соглашение', body: '' },
  offer: { title: 'Оферта', body: '' },
  consentText: 'Нажимая «Отправить заявку», вы соглашаетесь на обработку персональных данных согласно {privacy}.',
};

export const legalSchema: SectionSchema = {
  id: 'legal',
  title: 'Документы',
  description:
    'Тексты юридических страниц. Пока текст пуст, страница и ссылка на неё в подвале скрыты. Формат: пустая строка — новый абзац, строка с «## » в начале — подзаголовок.',
  fields: [
    {
      kind: 'group', key: 'privacy', label: 'Политика конфиденциальности (/privacy)',
      fields: [
        { kind: 'text', key: 'title', label: 'Заголовок', maxLength: 120 },
        { kind: 'textarea', key: 'body', label: 'Текст', rows: 14, maxLength: 60000 },
      ],
    },
    {
      kind: 'group', key: 'terms', label: 'Пользовательское соглашение (/terms)',
      fields: [
        { kind: 'text', key: 'title', label: 'Заголовок', maxLength: 120 },
        { kind: 'textarea', key: 'body', label: 'Текст', rows: 14, maxLength: 60000 },
      ],
    },
    {
      kind: 'group', key: 'offer', label: 'Оферта (/offer)',
      fields: [
        { kind: 'text', key: 'title', label: 'Заголовок', maxLength: 120 },
        { kind: 'textarea', key: 'body', label: 'Текст', rows: 14, maxLength: 60000 },
      ],
    },
    { kind: 'textarea', key: 'consentText', label: 'Текст согласия под формой заявки', hint: '{privacy} заменяется ссылкой на политику', rows: 2, maxLength: 400 },
  ],
};
