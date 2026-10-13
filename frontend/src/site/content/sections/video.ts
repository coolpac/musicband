import type { RemoteImage } from '../types';
import type { SectionSchema } from '../schema';

export interface VideoContent {
  heading: string;
  text: string;
  buttonLabel: string;
  /** YouTube / VK Video / Rutube link or a direct .mp4. Empty = the default showreel plays. */
  videoUrl: string;
  poster: RemoteImage | null;
  /** ISO date the video was published (YYYY-MM-DD). Required for VideoObject rich results; empty = no video markup. */
  uploadDate: string;
}

/**
 * Copy verbatim from Figma `VideoSection` 345:1389 (spec/video.md §5). The headline is stored
 * as one string — Figma's hard line break after «Посмотрите наше » was a manual wrap and would
 * fight the responsive column, so the browser breaks it instead.
 * `videoUrl` is the band's real Rutube showreel «Наши форматы» (the link the Telegram Mini App
 * uses); the design itself has no URL. The section is always rendered.
 */
export const videoDefaults: VideoContent = {
  heading: 'Посмотрите наше Live-видео',
  text: 'Почувствуйте невероятную энергетику живого звука и убедитесь в непревзойденном мастерстве наших музыкантов. Никакой фанеры, только чистый драйв.',
  buttonLabel: 'Смотреть шоурил',
  videoUrl: 'https://rutube.ru/video/a9885aeae1d2219c9378d86b4314be76/',
  poster: null,
  uploadDate: '',
};

export const videoSchema: SectionSchema = {
  id: 'video',
  title: 'Видео',
  description:
    'Блок с шоурилом: обложка с кнопкой «play», заголовок, описание и кнопка. Блок показывается всегда; если ссылку на видео убрать, играет шоурил по умолчанию. Описание и обложка необязательны.',
  fields: [
    {
      kind: 'url',
      key: 'videoUrl',
      label: 'Ссылка на видео',
      hint: 'YouTube, VK Видео, Rutube или прямой файл .mp4. Пусто — играет шоурил по умолчанию («Наши форматы» на Rutube).',
      placeholder: 'https://vkvideo.ru/video-12345_67890',
      maxLength: 500,
    },
    {
      kind: 'text',
      key: 'heading',
      label: 'Заголовок',
      hint: 'Две строки в макете; перенос браузер делает сам.',
      maxLength: 80,
    },
    {
      kind: 'textarea',
      key: 'text',
      label: 'Описание',
      rows: 4,
      maxLength: 320,
      hint: 'Серый текст под заголовком. Пусто — абзац не показывается.',
    },
    {
      kind: 'text',
      key: 'buttonLabel',
      label: 'Подпись кнопки',
      placeholder: 'Смотреть шоурил',
      maxLength: 40,
    },
    {
      kind: 'image',
      key: 'poster',
      label: 'Обложка видео',
      hint: 'Горизонтальная 16:9, от 1200×675. Пусто — кадр из макета.',
    },
    {
      kind: 'text',
      key: 'uploadDate',
      label: 'Дата публикации видео',
      hint: 'ГГГГ-ММ-ДД. Нужна Яндексу и Google для карточки видео в выдаче; без неё разметка не выводится.',
      placeholder: '2025-09-01',
      maxLength: 10,
    },
  ],
};
