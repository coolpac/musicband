import { useSection } from '../../content/SiteDataContext';
import { isSocialNetwork, socialDefaults, toExternalHref, type SocialNetwork } from '../../content/sections/social';
import { Reveal } from '../../components/ui/Reveal';
import instagramIcon from '../../assets/social/icon-instagram.svg';
// The exported icon-youtube.svg lost its play triangle in Figma's SVG export (body path only),
// so the 4× PNG of the same node — the glyph as it is actually drawn — is used instead.
import youtubeIcon from '../../assets/social/icon-youtube-4x.png';
import './Social.css';

/** Either a real exported asset or, for networks we have no licensed mark for, a text badge. */
type Glyph = { kind: 'icon'; src: string } | { kind: 'badge'; text: string };

interface NetworkMeta {
  /** Accessible name of the icon-only button. */
  label: string;
  glyph: Glyph;
}

/*
 * Figma's VK and Telegram buttons hold generic placeholder glyphs (circle-x, arrow-up-right) from
 * a stock icon set — shipping an ✕ where VK should be is worse than shipping no mark at all, and
 * hand-drawing brand logos is not an option. Those networks get a typographic badge until the real
 * marks are supplied.
 */
const NETWORKS: Record<SocialNetwork, NetworkMeta> = {
  vk: { label: 'ВГУЛ во ВКонтакте', glyph: { kind: 'badge', text: 'VK' } },
  telegram: { label: 'ВГУЛ в Telegram', glyph: { kind: 'badge', text: 'TG' } },
  youtube: { label: 'ВГУЛ на YouTube', glyph: { kind: 'icon', src: youtubeIcon } },
  instagram: { label: 'ВГУЛ в Instagram', glyph: { kind: 'icon', src: instagramIcon } },
  rutube: { label: 'ВГУЛ на RUTUBE', glyph: { kind: 'badge', text: 'RT' } },
  dzen: { label: 'ВГУЛ в Дзене', glyph: { kind: 'badge', text: 'ДЗ' } },
  tiktok: { label: 'ВГУЛ в TikTok', glyph: { kind: 'badge', text: 'TT' } },
};

/**
 * Мы в социальных сетях. Figma 345:1435. Only networks with a real URL are rendered, so the site
 * never ships a button that leads nowhere; with no links at all the section is not rendered.
 */
export function Social() {
  const content = useSection('social');
  const text = content.text.trim();
  // A section cleared to an empty string in the admin must not leave an empty <h2> labelling it.
  const heading = content.heading.trim() || socialDefaults.heading;

  // One button per network: a second row for the same network would repeat an aria-label
  // («ВГУЛ во ВКонтакте») on two different links, so the first one entered wins.
  const seen = new Set<SocialNetwork>();
  const items = content.links
    .filter((link) => link && typeof link.network === 'string' && isSocialNetwork(link.network))
    .map((link) => ({
      network: link.network,
      href: toExternalHref(typeof link.url === 'string' ? link.url : ''),
    }))
    .filter((item) => {
      if (!item.href || seen.has(item.network)) return false;
      seen.add(item.network);
      return true;
    });

  if (items.length === 0) return null;

  return (
    <section id="social" className="site-section site-social" aria-labelledby="social-title">
      <div className="site-container site-social__inner">
        <Reveal as="h2" id="social-title" className="site-social__title">
          {heading}
        </Reveal>
        {text ? (
          <Reveal as="p" index={1} className="site-social__text">
            {text}
          </Reveal>
        ) : null}
        <Reveal as="ul" index={2} className="site-social__list" role="list">
          {items.map((item) => {
            const meta = NETWORKS[item.network];
            return (
              <li key={item.network} className="site-social__item">
                <a
                  className="site-social__link"
                  href={item.href}
                  target="_blank"
                  // `me` marks the page as another profile of the same entity (RFC 6415 / microformats).
                  rel="me noopener noreferrer"
                  aria-label={meta.label}
                >
                  {meta.glyph.kind === 'icon' ? (
                    <img className="site-social__icon" src={meta.glyph.src} alt="" width={22} height={22} />
                  ) : (
                    <span className="site-social__badge" aria-hidden="true">
                      {meta.glyph.text}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
