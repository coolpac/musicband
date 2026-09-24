import type { RemoteImage } from '../types';
import type { SectionSchema } from '../schema';

export interface SeoContent {
  /** Canonical origin without trailing slash. Drives canonical, og:url, sitemap, JSON-LD @id. */
  siteUrl: string;
  siteName: string;
  /** <title> of the home page. Keep ≤ 60 chars so Yandex/Google do not truncate it. */
  title: string;
  /** Appended to inner-page titles: «Заявка — ВГУЛ». */
  titleSuffix: string;
  /** Meta description of the home page. 140–160 chars. */
  description: string;
  /** Used by Yandex only marginally; kept short on purpose. */
  keywords: string;
  /** 1200×630. null = bundled default. */
  ogImage: RemoteImage | null;
  /** JSON-LD MusicGroup.genre */
  genres: string[];
  /** JSON-LD areaServed — cities/regions the band plays in. */
  areaServed: string[];
  /** Content of <meta name="yandex-verification">. */
  yandexVerification: string;
  /** Content of <meta name="google-site-verification">. */
  googleVerification: string;
  /** Yandex.Metrika counter id (digits). Empty = counter is not loaded at all. */
  yandexMetrikaId: string;
  /** Google Analytics 4 measurement id (G-XXXX). Empty = not loaded. */
  googleAnalyticsId: string;
  /** Emergency switch: true adds noindex to every page (e.g. while content is being filled). */
  noindex: boolean;
}

export const seoDefaults: SeoContent = {
  siteUrl: 'https://vgulcover.ru',
  siteName: 'ВГУЛ',
  title: 'ВГУЛ — кавер-группа на свадьбу, корпоратив и праздник',
  titleSuffix: ' — ВГУЛ',
  description:
    'Кавер-группа ВГУЛ: живая музыка и шоу-программы на свадьбу, корпоратив, юбилей и городской праздник. Профессиональные музыканты, репертуар под ваше событие. Выберите дату онлайн.',
  keywords: 'кавер-группа, живая музыка, музыканты на свадьбу, группа на корпоратив, ВГУЛ',
  ogImage: null,
  genres: ['Кавер-группа', 'Поп', 'Рок', 'Танцевальная музыка'],
  areaServed: ['Россия'],
  yandexVerification: '',
  googleVerification: '',
  yandexMetrikaId: '',
  googleAnalyticsId: '',
  noindex: false,
};

export const seoSchema: SectionSchema = {
  id: 'seo',
  title: 'SEO и аналитика',
  description: 'То, что видят поисковики и соцсети. Меняйте осознанно: заголовок и описание влияют на позиции и кликабельность.',
  fields: [
    { kind: 'url', key: 'siteUrl', label: 'Адрес сайта', hint: 'Без слэша в конце, например https://vgulcover.ru' },
    { kind: 'text', key: 'siteName', label: 'Название (бренд)', maxLength: 60 },
    { kind: 'text', key: 'title', label: 'Title главной страницы', hint: 'До 60 символов — длиннее поисковики обрежут', maxLength: 90 },
    { kind: 'text', key: 'titleSuffix', label: 'Суффикс title внутренних страниц', maxLength: 30 },
    { kind: 'textarea', key: 'description', label: 'Meta description', hint: '140–160 символов, с призывом к действию', rows: 3, maxLength: 300 },
    { kind: 'text', key: 'keywords', label: 'Ключевые слова', maxLength: 300 },
    { kind: 'image', key: 'ogImage', label: 'Картинка для соцсетей (Open Graph)', hint: '1200×630 px. Показывается при отправке ссылки в Telegram, VK, WhatsApp' },
    { kind: 'stringList', key: 'genres', label: 'Жанры (для разметки Schema.org)', maxItems: 8 },
    { kind: 'stringList', key: 'areaServed', label: 'Где выступаете (города / регионы)', maxItems: 20 },
    { kind: 'text', key: 'yandexVerification', label: 'Код подтверждения Яндекс.Вебмастера', maxLength: 100 },
    { kind: 'text', key: 'googleVerification', label: 'Код подтверждения Google Search Console', maxLength: 100 },
    { kind: 'text', key: 'yandexMetrikaId', label: 'ID счётчика Яндекс.Метрики', hint: 'Только цифры. Пусто — счётчик не загружается', maxLength: 12 },
    { kind: 'text', key: 'googleAnalyticsId', label: 'ID Google Analytics 4', hint: 'Формат G-XXXXXXXXXX', maxLength: 20 },
    { kind: 'toggle', key: 'noindex', label: 'Закрыть сайт от индексации', hint: 'Включайте только на время наполнения сайта' },
  ],
};
