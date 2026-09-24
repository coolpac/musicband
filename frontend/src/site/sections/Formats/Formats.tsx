import { useSection, useSiteData } from '../../content/SiteDataContext';
import { fallbackFormats } from '../../content/sections/formats';
import { Picture, type OptimizedImage } from '../../components/ui/Picture';
import { Reveal } from '../../components/ui/Reveal';
import { Link } from '../../router/Router';
import { siteImages } from '../../assets/opt/manifest';
import type { RemoteImage, SiteFormat } from '../../content/types';
import ribbonUrl from '../../assets/formats/section-bg-vector.svg';
import welcomeLogoUrl from '../../assets/formats/welcome-band-logo.svg';
import './Formats.css';

/**
 * Photos are matched to cards by position, because a format carries no image of its own until
 * someone uploads one in the admin. Index 0 is the orphan Figma tile 345:2003 — that picture is
 * exactly the photo card 1 is missing (see docs/plans/2026-09-21-website-design.md §7).
 */
const BUNDLED_PHOTOS: OptimizedImage[] = [
  siteImages['hero-banner-image/event-banner-2'],
  siteImages['formats/show-performance-photo'],
  siteImages['formats/welcome-card-photo'],
];

/** The «ВГУЛ» wordmark Figma lays over the WELCOME photo — it belongs to that one bundled shot. */
const BRANDED_INDEX = 2;

const PHOTO_SIZES = '(min-width: 1280px) 405px, (min-width: 1024px) 31vw, (min-width: 640px) 44vw, 92vw';

function toCards(formats: SiteFormat[]): SiteFormat[] {
  if (formats.length) return formats.filter((format) => format.name.trim());
  return fallbackFormats.map((format, index) => ({
    id: `default-${index}`,
    name: format.name,
    shortDescription: format.shortDescription,
    image: null,
  }));
}

/**
 * «Форматы выступлений» — Figma `FormatsSection` 345:1371.
 * A red ribbon burns in from the right behind three staggered cards. Figma clips card 1's bottom
 * padding down to 2px (spec §9.1); every card here gets the full 32px it was designed with.
 */
export function Formats() {
  const content = useSection('formats');
  const { formats } = useSiteData();
  const cards = toCards(formats);
  const heading = content.heading.trim();
  const linkLabel = content.linkLabel.trim();
  if (!cards.length) return null;

  return (
    <section
      id="formats"
      className="site-section site-formats"
      aria-labelledby={heading ? 'formats-title' : undefined}
      aria-label={heading ? undefined : 'Форматы выступлений'}
    >
      <div className="site-formats__decor" aria-hidden="true">
        <img className="site-formats__ribbon" src={ribbonUrl} alt="" width={1440} height={654} />
        <span className="site-formats__scrim site-formats__scrim--x" />
        <span className="site-formats__scrim site-formats__scrim--y" />
      </div>

      <div className="site-container site-formats__inner">
        {heading ? (
          <Reveal as="h2" id="formats-title" className="site-formats__title" variant="fade">
            {heading}
          </Reveal>
        ) : null}

        <ul className="site-formats__grid">
          {cards.map((card, index) => {
            const photo: OptimizedImage | RemoteImage | null = card.image ?? BUNDLED_PHOTOS[index] ?? null;
            const branded = !card.image && index === BRANDED_INDEX;
            const description = card.shortDescription?.trim();

            return (
              <Reveal as="li" className="site-formats__item" key={card.id} index={Math.min(index, 5)}>
                <article className="site-formats__card">
                  {photo ? (
                    <div className="site-formats__media">
                      <div className="site-formats__shot">
                        <Picture
                          image={photo}
                          alt={`Формат выступления: ${card.name}`}
                          sizes={PHOTO_SIZES}
                          className="site-formats__photo"
                          wrapperClassName="site-formats__pic"
                        />
                      </div>
                      {/* Outside the zooming frame: in Figma the wordmark is its own layer over
                          the photo, and a logo that scales with the hover would go soft. */}
                      {branded ? (
                        <img className="site-formats__mark" src={welcomeLogoUrl} alt="" width={175} height={46} />
                      ) : null}
                    </div>
                  ) : null}

                  <div className="site-formats__body">
                    <h3 className="site-formats__name">{card.name}</h3>
                    {description ? <p className="site-formats__desc">{description}</p> : null}
                    {/* All three links lead to the same step; the name keeps them apart in a
                        screen reader's link list while the visible label stays identical. */}
                    {linkLabel ? (
                      <Link to="/booking" className="site-formats__link" aria-label={`${linkLabel} — ${card.name}`}>
                        <span className="site-formats__link-text">{linkLabel}</span>
                      </Link>
                    ) : null}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
