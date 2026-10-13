import type { ReactNode } from 'react';
import { useSection, useSiteData } from '../../content/SiteDataContext';
import { fallbackFormats } from '../../content/sections/formats';
import { Picture, type OptimizedImage } from '../../components/ui/Picture';
import { Reveal } from '../../components/ui/Reveal';
import { siteImages } from '../../assets/opt/manifest';
import type { RemoteImage, SiteFormat } from '../../content/types';
import ribbonUrl from '../../assets/formats/section-bg-vector.svg';
import welcomeLogoUrl from '../../assets/formats/welcome-band-logo.svg';
// Latin-only face for the single «welcome» script word (OFL, ~10 KB, font-display: swap).
import '@fontsource/island-moments/latin-400.css';
import './Formats.css';

/**
 * A format carries no photo of its own until someone uploads one in the admin (`image: null`),
 * so the three Figma photos ship with the site and are matched to a card by what it is CALLED —
 * not by its position, which the admin can change at will. A card that matches nothing simply
 * has no photo (Figma draws such a text-only card too).
 *   · «Основная программа / MAIN SHOW „ГАНГСТЕРЫ“» — the orphan Figma tile 345:2003, the photo
 *     card 1 is missing (docs/plans/2026-09-21-website-design.md §7)
 *   · «ШОУ-ПЕРФОМАНС „ПО-НОВЕЕ РУССКИЕ“ / 90-ые» — 345:2004
 *   · «WELCOME» — 345:2006, with the «ВГУЛ» wordmark and the «welcome» script laid over it
 */
interface BundledPhoto {
  test: RegExp;
  image: OptimizedImage;
  /** The wordmark + script that Figma draws over this one shot. */
  branded?: boolean;
}

const BUNDLED_PHOTOS: BundledPhoto[] = [
  { test: /welcome|вэлком|велком/i, image: siteImages['formats/welcome-card-photo'], branded: true },
  { test: /по-новее|шоу-пер|90/i, image: siteImages['formats/show-performance-photo'] },
  { test: /гангстер|main\s*show|основн/i, image: siteImages['hero-banner-image/event-banner-2'] },
];

const PHOTO_SIZES = '(min-width: 1280px) 405px, (min-width: 1024px) 31vw, (min-width: 640px) 44vw, 92vw';

/**
 * Hyphenated words stay whole: «ШОУ-ПЕРФОМАНС», «По-новее» must not split at the hyphen —
 * Figma sets every title word on one line. Breaks fall on the spaces between them instead.
 */
function renderName(name: string): ReactNode {
  return name.split(/(\s+)/).map((token, index) =>
    token.includes('-') ? (
      <span className="site-formats__nowrap" key={index}>
        {token}
      </span>
    ) : (
      token
    )
  );
}

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
 * A red ribbon burns in from the right behind a row of equal cards. Figma staggers the three
 * cards vertically (card 1 sits 229px lower, the Show card is 29px taller) — a designer slip, so
 * the cards here share one top edge and one height per row; every other number is the Figma one.
 */
export function Formats() {
  const content = useSection('formats');
  const { formats } = useSiteData();
  const cards = toCards(formats);
  const heading = content.heading.trim();
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
            const bundled = card.image ? undefined : BUNDLED_PHOTOS.find((photo) => photo.test.test(card.name));
            const photo: OptimizedImage | RemoteImage | null = card.image ?? bundled?.image ?? null;
            const branded = Boolean(bundled?.branded);
            const description = card.shortDescription?.trim();

            return (
              <Reveal
                as="li"
                className={photo ? 'site-formats__item' : 'site-formats__item site-formats__item--plain'}
                key={card.id}
                index={Math.min(index, 5)}
              >
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
                      {/* Figma lays these over the photo as separate layers; they repeat the card's
                          title, so assistive tech skips them. */}
                      {branded ? (
                        <>
                          <img className="site-formats__mark" src={welcomeLogoUrl} alt="" width={175} height={46} />
                          <span className="site-formats__script" aria-hidden="true">
                            welcome
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="site-formats__body">
                    <h3 className="site-formats__name">{renderName(card.name)}</h3>
                    {description ? <p className="site-formats__desc">{description}</p> : null}
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
