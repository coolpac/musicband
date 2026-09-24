import type { CSSProperties } from 'react';
import { useSection, useSiteData } from '../../content/SiteDataContext';
import { partnersDefaults } from '../../content/sections/partners';
import { toExternalHref } from '../../content/sections/social';
import type { SitePartner } from '../../content/types';
import { demoPartners } from '../../content/demo/partners';
import { Picture } from '../../components/ui/Picture';
import { Reveal } from '../../components/ui/Reveal';
import './Partners.css';

/** Above this many tiles a static row stops working at 1440, and the desktop layout becomes a marquee. */
const MARQUEE_FROM = 6;

const LOGO_SIZES = '(min-width: 1280px) 200px, (min-width: 768px) 22vw, 42vw';

function PartnerTile({ partner, cloned = false }: { partner: SitePartner; cloned?: boolean }) {
  const name = partner.name.trim();
  const href = toExternalHref(partner.link ?? '');
  // An upload row that lost its file leaves `{ src: '' }` behind; <img src=""> re-requests the
  // page itself and paints a broken image, so an empty source falls back to the partner's name.
  const logo = partner.logo && typeof partner.logo.src === 'string' && partner.logo.src.trim() ? partner.logo : null;
  const content = logo ? (
    <Picture
      image={logo}
      alt={name}
      sizes={LOGO_SIZES}
      className="site-partners__logo"
      wrapperClassName="site-partners__logo-wrap"
    />
  ) : (
    <span className="site-partners__name">{name}</span>
  );

  return (
    <li className="site-partners__item">
      {href ? (
        <a
          className="site-partners__tile"
          href={href}
          target="_blank"
          // nofollow: a partner link is a courtesy, not an endorsement search engines should weigh.
          rel="noopener noreferrer nofollow"
          tabIndex={cloned ? -1 : undefined}
        >
          {content}
        </a>
      ) : (
        <div className="site-partners__tile">{content}</div>
      )}
    </li>
  );
}

/**
 * Партнёры. Figma 345:1420 draws six «LOGO» placeholders — none of that ships: tiles come from the
 * partners collection managed in the admin, and with no partners the section is not rendered at
 * all. Local development without a backend falls back to six neutral text placeholders.
 */
export function Partners() {
  const content = useSection('partners');
  const data = useSiteData();

  const source =
    data.partners.length > 0 ? data.partners : data.source === 'fallback' && import.meta.env.DEV ? demoPartners : [];
  // A partner without a name has no accessible label for its tile — treat it as incomplete data.
  const partners = source.filter((partner) => typeof partner?.name === 'string' && partner.name.trim().length > 0);

  if (partners.length === 0) return null;

  const marquee = partners.length > MARQUEE_FROM;
  // A section cleared to an empty string in the admin must not leave an empty <h2> labelling it.
  const heading = content.heading.trim() || partnersDefaults.heading;

  return (
    <section id="partners" className="site-section site-partners" aria-labelledby="partners-title">
      <div className="site-container">
        <Reveal as="h2" id="partners-title" className="site-partners__title">
          {heading}
        </Reveal>
      </div>

      <Reveal
        className={`site-partners__viewport${marquee ? ' is-marquee' : ''}`}
        index={1}
        style={{ '--marquee-items': partners.length } as CSSProperties}
      >
        <div className="site-partners__track site-container">
          <ul className="site-partners__row" role="list">
            {partners.map((partner) => (
              <PartnerTile key={partner.id} partner={partner} />
            ))}
          </ul>
          {marquee ? (
            // The second copy exists only to make the loop seamless: hidden from assistive tech,
            // out of the tab order, and removed from layout whenever the marquee is not running.
            <ul className="site-partners__row site-partners__row--clone" aria-hidden="true">
              {partners.map((partner) => (
                <PartnerTile key={`clone-${partner.id}`} partner={partner} cloned />
              ))}
            </ul>
          ) : null}
        </div>
      </Reveal>
    </section>
  );
}
