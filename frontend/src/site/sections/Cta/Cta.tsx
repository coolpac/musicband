import { useSection } from '../../content/SiteDataContext';
import { Button } from '../../components/ui/Button';
import { Reveal } from '../../components/ui/Reveal';
import './Cta.css';

/** Repeated twice inside the marquee so a −50% shift loops seamlessly. */
const MARQUEE_ROW = 'ВГУЛ · ВГУЛ · ВГУЛ · ВГУЛ · ';

/**
 * Closing call-to-action band (Figma «cta-pick-date», 345:1477): full-bleed brand red,
 * heavy display headline, tagline, white button into the booking flow.
 * The design plan puts it before the footer, not below it as the canvas has it.
 */
export function Cta() {
  const { heading, tagline, buttonLabel } = useSection('cta');
  const title = heading.trim();
  const label = buttonLabel.trim();
  if (!title && !label) return null;

  return (
    <section
      id="cta"
      className="site-section site-cta"
      aria-labelledby={title ? 'site-cta-heading' : undefined}
      aria-label={title ? undefined : 'Забронировать выступление'}
    >
      <div className="site-cta__decor" aria-hidden="true">
        <div className="site-cta__marquee">
          <span className="site-cta__marquee-row">{MARQUEE_ROW}</span>
          <span className="site-cta__marquee-row">{MARQUEE_ROW}</span>
        </div>
      </div>

      <div className="site-container site-cta__inner">
        {title ? (
          <Reveal as="h2" id="site-cta-heading" className="site-cta__heading">
            {title}
          </Reveal>
        ) : null}
        {tagline.trim() ? (
          <Reveal as="p" className="site-cta__tagline" index={1}>
            {tagline}
          </Reveal>
        ) : null}
        {label ? (
          <Reveal className="site-cta__action" index={2}>
            <Button to="/booking" variant="light" size="lg">
              {label}
            </Button>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
