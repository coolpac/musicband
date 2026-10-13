import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link, useRouter } from '../../router/Router';
import { useSiteData } from '../../content/SiteDataContext';
import { phoneToHref } from '../../content/sections/contacts';
import { sanitizeNav } from '../../content/sections/header';
import { visibleNav } from '../../content/visibility';
import { isSocialNetwork, toExternalHref, type SocialNetwork } from '../../content/sections/social';
import { Button } from '../ui/Button';
import { Logo } from './Logo';
import { navHash, useActiveNav } from './useActiveNav';
import { useMenuDialog } from './useMenuDialog';
import './Header.css';

const MENU_ID = 'site-menu';

const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  vk: 'ВКонтакте',
  telegram: 'Telegram',
  youtube: 'YouTube',
  instagram: 'Instagram',
  rutube: 'Rutube',
  dzen: 'Дзен',
  tiktok: 'TikTok',
};

/** Stagger steps are capped so the last item of a long menu is not left waiting. */
const MAX_STAGGER = 5;

/**
 * Fixed site header (Figma 345:1298): wordmark left, five uppercase nav links centred,
 * phone + red pill CTA right. The phone is the `contacts.phone` field — empty means no phone.
 *
 * One nav lives in the DOM and CSS decides what it is: a centred row at ≥1024px, a
 * full-screen dialog behind the burger below it, and a plain stacked list when JS never
 * boots (`html.site-js` is the switch). Nothing here is hidden from crawlers.
 */
export function Header() {
  const { pathname, hash } = useRouter();
  const data = useSiteData();
  const { content } = data;
  // Stable identity matters: the scroll-spy observer is keyed on this array.
  const nav = useMemo(() => visibleNav(sanitizeNav(content.header.nav), data), [content.header.nav, data]);
  const ctaLabel = content.header.ctaLabel.trim();
  const phone = content.contacts.phone.trim();
  const phoneHref = phoneToHref(phone);
  // Same guards as the Social section, so a profile entered as «vk.com/vgul» shows up in both
  // places — and a hand-edited row with a non-string network can never reach React as a child.
  const socials = useMemo(
    () =>
      content.social.links
        .filter((link) => !!link && typeof link.network === 'string' && isSocialNetwork(link.network))
        .map((link) => ({ network: link.network, href: toExternalHref(typeof link.url === 'string' ? link.url : '') }))
        .filter((link) => link.href.length > 0),
    [content.social.links]
  );

  const activeIndex = useActiveNav(nav, pathname);
  const hasMenu = nav.length > 0 || !!phone || !!ctaLabel || socials.length > 0;

  const panelRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const { open, toggle, close } = useMenuDialog(panelRef, burgerRef);

  const [scrolled, setScrolled] = useState(false);

  // Passive + rAF: the listener never reads layout and never runs more than once a frame.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  // Back/forward and every route change close the menu.
  useEffect(() => {
    close();
  }, [pathname, hash, close]);

  // …and so does following a link inside it, including one that only re-uses the current hash.
  const onPanelClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('a')) close();
  };

  const className = ['site-header', scrolled ? 'is-scrolled' : '', open ? 'is-menu-open' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <header className={className}>
      <div className="site-header__bar">
        <Logo className="site-header__logo" />

        {/* Nothing to reveal — no nav, no phone, no CTA, no socials — means no burger either. */}
        {hasMenu ? (
          <button
            ref={burgerRef}
            type="button"
            className="site-header__burger"
            aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={open}
            aria-controls={MENU_ID}
            onClick={toggle}
          >
            <span className="site-header__burger-box" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        ) : null}

        <div
          ref={panelRef}
          id={MENU_ID}
          className={open ? 'site-header__panel is-open' : 'site-header__panel'}
          role={open ? 'dialog' : undefined}
          aria-modal={open ? true : undefined}
          aria-label={open ? 'Меню сайта' : undefined}
          tabIndex={-1}
          onClick={onPanelClick}
        >
          {/*
            The burger is the visible close control, but it sits outside this dialog where
            `aria-modal` hides it from screen readers. This one is the first thing inside, so a
            screen-reader or keyboard user reaches the way out before the whole menu, not after it.
          */}
          {open ? (
            <button type="button" className="site-header__close" onClick={close}>
              Закрыть меню
            </button>
          ) : null}

          {nav.length > 0 ? (
            <nav className="site-header__nav" aria-label="Основная навигация">
              <ul className="site-header__nav-list">
                {nav.map((item, index) => (
                  // Two identical rows are a content mistake, not a crash: index keeps keys unique.
                  <li
                    key={`${index}-${item.href}`}
                    className="site-header__nav-item"
                    style={{ '--i': Math.min(index, MAX_STAGGER) } as CSSProperties}
                  >
                    <Link
                      to={item.href}
                      className="site-header__nav-link"
                      data-label={item.label}
                      aria-current={index === activeIndex ? (navHash(item.href) ? 'location' : 'page') : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {phone || ctaLabel ? (
            <div className="site-header__actions" style={{ '--i': Math.min(nav.length, MAX_STAGGER) } as CSSProperties}>
              {phone ? (
                phoneHref ? (
                  <a className="site-header__phone" href={phoneHref}>
                    {phone}
                  </a>
                ) : (
                  <span className="site-header__phone">{phone}</span>
                )
              ) : null}
              {ctaLabel ? (
                <Button to="/booking" size="sm" className="site-header__cta">
                  {ctaLabel}
                </Button>
              ) : null}
            </div>
          ) : null}

          {socials.length > 0 ? (
            <ul
              className="site-header__social"
              aria-label="Мы в социальных сетях"
              style={{ '--i': Math.min(nav.length + 1, MAX_STAGGER) } as CSSProperties}
            >
              {socials.map((link, index) => (
                <li key={`${index}-${link.network}`}>
                  <a className="site-header__social-link" href={link.href} target="_blank" rel="me noopener noreferrer">
                    {SOCIAL_LABELS[link.network]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </header>
  );
}
