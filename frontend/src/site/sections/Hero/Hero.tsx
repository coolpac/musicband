import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSection } from '../../content/SiteDataContext';
import { Button } from '../../components/ui/Button';
import { Picture } from '../../components/ui/Picture';
import { VideoLightbox } from '../../components/ui/VideoLightbox';
import { siteImages } from '../../assets/opt/manifest';
import type { HeroPanel } from '../../content/sections/hero';
import './Hero.css';

const TITLE_ID = 'site-hero-title';

/**
 * Horizontal focal point of the shared poster for panel `index`.
 * Only the phone carousel uses it: every panel draws the SAME file (one download) and
 * crops to its own half of the diptych — 24% for the first line-up, 78% for the last.
 */
function focalPoint(index: number, total: number): string {
  if (total < 2) return '50%';
  return `${Math.round(24 + (index * 54) / (total - 1))}%`;
}

/**
 * Both Figma panels carry the SAME headline (spec/hero.md §9.1), so a dot named after the
 * headline alone would produce two identically named buttons. The badge is what actually tells
 * the two offers apart, and the ordinal keeps the names unique even when everything else is blank.
 */
function dotLabel(panel: HeroPanel, index: number): string {
  const name = [panel.badge, panel.titleLine2 || panel.titleLine1]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' — ');
  return name ? `Предложение ${index + 1}: ${name}` : `Предложение ${index + 1}`;
}

/**
 * First screen: one full-bleed poster, one content column per show.
 *
 * The poster is the LCP element, so it is never faded in and never waits for JS — the only
 * entrance it gets is a CSS scale-settle. Desktop lays the panels out as a grid and each
 * panel's <picture> is `panelCount × 100%` wide, shifted left by its own index, so the two
 * halves reassemble into one seamless, continuous image. Below 900px the same markup becomes
 * a CSS scroll-snap carousel — no JS is involved in swiping.
 */
export function Hero() {
  const { panels, image, imageAlt } = useSection('hero');
  const poster = image ?? siteImages['hero/hero-poster-bg'];
  const count = panels.length;

  const trackRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [browsed, setBrowsed] = useState(false);
  const [promoIndex, setPromoIndex] = useState<number | null>(null);

  // Which panel the carousel is showing. Progressive enhancement: without JS the dots simply
  // keep pointing at the first panel while swiping still works.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || count < 2 || typeof IntersectionObserver === 'undefined') return;
    const items = panelRefs.current.slice(0, count).filter((el): el is HTMLElement => el !== null);
    if (items.length < 2) return;

    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios.set(entry.target, entry.intersectionRatio);
        let best = 0;
        let bestRatio = -1;
        items.forEach((el, index) => {
          const ratio = ratios.get(el) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = index;
          }
        });
        setActive(best);
      },
      { root: track, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [count]);

  // The «swipe» hint has done its job the moment the visitor swipes once.
  useEffect(() => {
    if (active !== 0) setBrowsed(true);
  }, [active]);

  if (count === 0) return null;

  const goTo = (index: number) => {
    const track = trackRef.current;
    const el = panelRefs.current[index];
    if (!track || !el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Scrolling the track itself — rather than scrollIntoView — guarantees the page never moves
    // vertically, and lands on the panel's own snap position instead of «just enough to be seen».
    track.scrollTo({ left: el.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
  };

  // An empty heading element would be worse than an unnamed region, so the section is only
  // labelled by a headline that actually has words in it.
  const firstPanel = panels[0];
  const labelledBy = firstPanel.titleLine1.trim() || firstPanel.titleLine2.trim() ? TITLE_ID : undefined;

  const promoPanel = promoIndex === null ? null : (panels[promoIndex] ?? null);
  const promoTitle = promoPanel
    ? `${promoPanel.titleLine1} ${promoPanel.titleLine2}`.trim() || promoPanel.secondaryLabel
    : '';

  return (
    <>
      <section id="hero" className="site-hero" aria-labelledby={labelledBy}>
        <div className="site-hero__track" ref={trackRef} style={{ '--hero-panels': count } as CSSProperties}>
          {panels.map((panel, index) => {
            const Heading = index === 0 ? 'h1' : 'h2';
            const hasPromo = panel.promoVideoUrl.trim().length > 0 && panel.secondaryLabel.trim().length > 0;
            const hasTitle = panel.titleLine1.trim().length > 0 || panel.titleLine2.trim().length > 0;
            return (
              <div
                key={index}
                className="site-hero__panel"
                ref={(el) => {
                  panelRefs.current[index] = el;
                }}
                style={{ '--hero-index': index, '--hero-focal': focalPoint(index, count) } as CSSProperties}
              >
                <Picture
                  image={poster}
                  /* One poster, several crops: only the first copy carries the description. */
                  alt={index === 0 ? imageAlt : ''}
                  /* Keep in step with `imagesizes` of the hero preload in seo/head.ts: a different value
                     makes the browser fetch a second candidate and waste the preloaded one. */
                  sizes="100vw"
                  priority
                  wrapperClassName="site-hero__panel-media"
                  className="site-hero__panel-img"
                />
                <div className="site-hero__panel-content">
                  {panel.badge.trim() ? <p className="site-hero__badge">{panel.badge}</p> : null}
                  {hasTitle ? (
                    <Heading className="site-hero__title" id={index === 0 ? TITLE_ID : undefined}>
                      {panel.titleLine1.trim() ? <span className="site-hero__title-line">{panel.titleLine1}</span> : null}
                      {/* The lines are block-level, so visually this space is nothing — but without it the
                          heading's text content is «В гостях уЛементалия» for crawlers and screen readers. */}
                      {panel.titleLine1.trim() && panel.titleLine2.trim() ? ' ' : null}
                      {panel.titleLine2.trim() ? (
                        <span className="site-hero__title-line site-hero__title-line--accent">{panel.titleLine2}</span>
                      ) : null}
                    </Heading>
                  ) : null}
                  {panel.primaryLabel.trim() || hasPromo ? (
                    <div className="site-hero__actions">
                      {panel.primaryLabel.trim() ? (
                        <Button to="/booking" size="lg">
                          {panel.primaryLabel}
                        </Button>
                      ) : null}
                      {hasPromo ? (
                        <Button
                          variant="outline"
                          size="lg"
                          aria-haspopup="dialog"
                          aria-expanded={promoIndex === index}
                          onClick={() => setPromoIndex(index)}
                        >
                          {panel.secondaryLabel}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {count > 1 ? (
          <div className={browsed ? 'site-hero__nav is-browsed' : 'site-hero__nav'}>
            <p className="site-hero__hint" aria-hidden="true">
              Листайте
            </p>
            {/* `list-style: none` (styles/base.css) drops list semantics in Safari/VoiceOver. */}
            <ul className="site-hero__dots" role="list" aria-label="Выбор предложения">
              {panels.map((panel, index) => (
                <li key={index}>
                  <button
                    type="button"
                    className="site-hero__dot"
                    aria-current={index === active ? 'true' : undefined}
                    aria-label={dotLabel(panel, index)}
                    onClick={() => goTo(index)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Outside the section on purpose: `container-type` on .site-hero would become the
          containing block of a position:fixed dialog and trap it inside the hero. */}
      <VideoLightbox
        open={promoPanel !== null}
        url={promoPanel?.promoVideoUrl ?? ''}
        title={promoTitle}
        onClose={() => setPromoIndex(null)}
      />
    </>
  );
}
