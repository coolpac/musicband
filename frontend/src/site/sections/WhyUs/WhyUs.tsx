import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useSection } from '../../content/SiteDataContext';
import { Picture } from '../../components/ui/Picture';
import { Reveal } from '../../components/ui/Reveal';
import { siteImages } from '../../assets/opt/manifest';
import './WhyUs.css';

/**
 * «Почему мы?» — Figma `WhyUsSection` 345:1358.
 * A full-bleed concert photograph with three solid cards punched out of it. The photograph is
 * shown exactly as Figma has it — no scrim, no tint. Figma paints the section root red under a
 * photo that covers it completely; the root here is black instead, so a photo that fails to
 * load degrades to the page background rather than to a scarlet band.
 */
export function WhyUs() {
  const content = useSection('whyUs');
  const frame = useRef(0);
  const pending = useRef<{ el: HTMLElement; x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      pending.current = null;
    },
    []
  );

  /** Pointer spotlight: coordinates go in as custom properties, one rAF per frame, never per event. */
  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    // Mouse only — the matching CSS lives behind (hover: hover) and (pointer: fine), so a touch
    // or pen would write custom properties nothing ever reads.
    if (event.pointerType !== 'mouse') return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    pending.current = { el, x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const next = pending.current;
      if (!next) return;
      next.el.style.setProperty('--spot-x', `${next.x}px`);
      next.el.style.setProperty('--spot-y', `${next.y}px`);
      next.el.style.setProperty('--spot-on', '1');
    });
  }, []);

  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const el = event.currentTarget;
    // Only drop the queued update if it belongs to the card being left — the pointer may already
    // be over the next card, whose move event is queued behind this one.
    if (pending.current?.el === el) pending.current = null;
    el.style.setProperty('--spot-on', '0');
  }, []);

  const cards = content.cards.filter((card) => card.label.trim() || card.text.trim());
  if (!cards.length) return null;

  const background = content.image ?? siteImages['why-us/why-us-band-bg'];
  const heading = content.heading.trim();

  return (
    <section
      id="why-us"
      className="site-section site-why"
      aria-labelledby={heading ? 'why-us-title' : undefined}
      aria-label={heading ? undefined : 'Почему мы'}
    >
      <div className="site-why__bg" aria-hidden="true">
        <Picture
          image={background}
          alt=""
          sizes="100vw"
          className="site-why__photo"
          wrapperClassName="site-why__photo-wrap"
        />
      </div>

      <div className="site-container site-why__inner">
        {heading ? (
          <Reveal as="h2" id="why-us-title" className="site-why__title" variant="fade">
            {heading}
          </Reveal>
        ) : null}

        <ul className="site-why__grid">
          {cards.map((card, index) => (
            <Reveal as="li" className="site-why__item" key={`${index}-${card.label}`} index={Math.min(index, 5)}>
              <article
                className="site-why__card"
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
              >
                {card.label.trim() ? <h3 className="site-why__label">{card.label}</h3> : null}
                {card.text.trim() ? <p className="site-why__text">{card.text}</p> : null}
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
