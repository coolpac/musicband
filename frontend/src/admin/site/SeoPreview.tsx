import { isRemoteImage } from './contentModel';

/** Пороги, по которым поисковики обрезают сниппет. */
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function domainFrom(siteUrl: string): string {
  const cleaned = siteUrl.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return cleaned || 'vgulcover.ru';
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

function Meter({ label, length, limit }: { label: string; length: number; limit: number }) {
  const ratio = Math.min(length / limit, 1);
  const tone = length > limit ? 'over' : length > limit * 0.9 ? 'near' : 'ok';

  return (
    <div className={`site-admin-meter site-admin-meter--${tone}`}>
      <div className="site-admin-meter__row">
        <span className="site-admin-meter__label">{label}</span>
        <span className="site-admin-meter__value">
          {length} / {limit}
        </span>
      </div>
      <div className="site-admin-meter__track">
        <span className="site-admin-meter__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * Живое превью сниппета в Яндексе/Google и карточки в соцсетях.
 * Показывает ровно то, что уйдёт в <title>, <meta description> и og:*.
 */
export default function SeoPreview({ value }: { value: Record<string, unknown> }) {
  const title = asString(value.title);
  const description = asString(value.description);
  const siteName = asString(value.siteName);
  const domain = domainFrom(asString(value.siteUrl));
  const ogImage = isRemoteImage(value.ogImage) ? value.ogImage : null;
  const noindex = value.noindex === true;

  return (
    <div className="site-admin-preview">
      <h3 className="site-admin-preview__title">Как это выглядит снаружи</h3>

      {noindex && (
        <p className="site-admin-preview__warning" role="status">
          Сейчас включён запрет индексации: сайт не появится в поиске, пока переключатель не выключен.
        </p>
      )}

      <div className="site-admin-preview__grid">
        <div className="site-admin-serp">
          <span className="site-admin-serp__badge">Поиск</span>
          <span className="site-admin-serp__url">{domain}</span>
          <span className="site-admin-serp__headline">
            {truncate(title, TITLE_LIMIT) || 'Заголовок не заполнен'}
          </span>
          <span className="site-admin-serp__desc">
            {truncate(description, DESCRIPTION_LIMIT) || 'Описание не заполнено'}
          </span>
        </div>

        <div className="site-admin-og">
          <span className="site-admin-serp__badge">Ссылка в Telegram / VK</span>
          <div className="site-admin-og__media">
            {ogImage ? (
              <img src={ogImage.src} alt="" className="site-admin-og__img" loading="lazy" />
            ) : (
              <span className="site-admin-og__placeholder">Картинка из макета</span>
            )}
          </div>
          <div className="site-admin-og__body">
            <span className="site-admin-og__domain">{domain}</span>
            <span className="site-admin-og__title">{title || siteName || 'ВГУЛ'}</span>
            <span className="site-admin-og__desc">{truncate(description, 110)}</span>
          </div>
        </div>
      </div>

      <div className="site-admin-preview__meters">
        <Meter label="Title" length={title.length} limit={TITLE_LIMIT} />
        <Meter label="Description" length={description.length} limit={DESCRIPTION_LIMIT} />
      </div>
    </div>
  );
}
