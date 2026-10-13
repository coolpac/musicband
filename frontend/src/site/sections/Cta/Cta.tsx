import { useSection } from '../../content/SiteDataContext';
import { Button } from '../../components/ui/Button';
import { Reveal } from '../../components/ui/Reveal';
import './Cta.css';

/**
 * Closing call-to-action band (Figma «cta-pick-date», 345:1477): a flat full-bleed brand-red slab,
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
