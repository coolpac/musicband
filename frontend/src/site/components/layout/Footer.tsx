import { useSiteData } from '../../content/SiteDataContext';
import { Link } from '../../router/Router';
import { phoneToHref } from '../../content/sections/contacts';
import { sanitizeNav } from '../../content/sections/header';
import { visibleNav } from '../../content/visibility';
import { legalDefaults } from '../../content/sections/legal';
import { Reveal } from '../ui/Reveal';
import { Logo } from './Logo';
import './Footer.css';

/** Order of the «Документы» column; each one appears only once its text is filled in. */
const LEGAL_DOCS = [
  { key: 'privacy', path: '/privacy' },
  { key: 'terms', path: '/terms' },
  { key: 'offer', path: '/offer' },
] as const;

/**
 * Site footer (Figma 345:1451): brand block + three link columns, hairline, centred copyright.
 * Everything data-driven disappears when empty — the Figma placeholders («hello@vgul.ru»,
 * «+7 (999) 123-45-67») are not defaults anywhere, so an unconfigured site shows no fake contacts.
 */
export function Footer() {
  const data = useSiteData();
  const { footer, header, contacts, legal } = data.content;

  const tagline = footer.tagline.trim();
  const nav = visibleNav(sanitizeNav(header.nav), data);
  const docs = LEGAL_DOCS.filter((doc) => legal[doc.key].body.trim().length > 0);
  const phone = contacts.phone.trim();
  const phoneHref = phoneToHref(phone);
  const email = contacts.email.trim();
  const mailable = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Server and client agree on this except for a few hours around New Year (and in the static
  // fallback snapshot, which is rebuilt on every deploy) — which is what the
  // suppressHydrationWarning below covers: React keeps the server text and never warns.
  const copyright = footer.copyright.replace(/\{year\}/g, String(new Date().getFullYear()));

  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="site-footer__top">
          <Reveal className="site-footer__brand">
            <Logo className="site-footer__logo" />
            {tagline ? <p className="site-footer__tagline">{tagline}</p> : null}
          </Reveal>

          {nav.length > 0 ? (
            <Reveal as="nav" className="site-footer__col" aria-labelledby="site-footer-nav" index={1}>
              <h2 id="site-footer-nav" className="site-footer__heading">
                {footer.navHeading}
              </h2>
              <ul className="site-footer__list">
                {nav.map((item) => (
                  <li key={`${item.href}-${item.label}`}>
                    <Link className="site-footer__link" to={item.href}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          ) : null}

          {docs.length > 0 ? (
            <Reveal as="nav" className="site-footer__col" aria-labelledby="site-footer-docs" index={2}>
              <h2 id="site-footer-docs" className="site-footer__heading">
                {footer.docsHeading}
              </h2>
              <ul className="site-footer__list">
                {docs.map((doc) => (
                  <li key={doc.key}>
                    <Link className="site-footer__link" to={doc.path}>
                      {legal[doc.key].title.trim() || legalDefaults[doc.key].title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          ) : null}

          {phone || email ? (
            <Reveal className="site-footer__col" index={3}>
              <h2 className="site-footer__heading">{footer.contactsHeading}</h2>
              <ul className="site-footer__list site-footer__list--plain">
                {email ? (
                  <li>
                    <span className="site-footer__label">Email: </span>
                    {mailable ? (
                      <a className="site-footer__link" href={`mailto:${email}`}>
                        {email}
                      </a>
                    ) : (
                      <span className="site-footer__label">{email}</span>
                    )}
                  </li>
                ) : null}
                {phone ? (
                  <li>
                    <span className="site-footer__label">Телефон: </span>
                    {phoneHref ? (
                      <a className="site-footer__link" href={phoneHref}>
                        {phone}
                      </a>
                    ) : (
                      <span className="site-footer__label">{phone}</span>
                    )}
                  </li>
                ) : null}
              </ul>
            </Reveal>
          ) : null}
        </div>

        <hr className="site-footer__divider" />

        <p className="site-footer__copy" suppressHydrationWarning>
          {copyright}
        </p>
      </div>
    </footer>
  );
}
