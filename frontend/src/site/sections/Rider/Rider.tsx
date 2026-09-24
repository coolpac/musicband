import { useSection } from '../../content/SiteDataContext';
import { toFileHref } from '../../content/sections/repertoire';
import { riderDefaults } from '../../content/sections/rider';
import { Button } from '../../components/ui/Button';
import { Reveal } from '../../components/ui/Reveal';
import './Rider.css';

/**
 * Райдер. The Figma frame (345:1402) is an empty red band with one word on it, so the body is
 * designed here: a dark #111 card with a red edge instead of a second red slab, because the section
 * sits directly under the repertoire block, which is brand red in its default (collapsed) state.
 *
 * Nothing is invented: with no text and no file the section renders nothing at all.
 */
export function Rider() {
  const content = useSection('rider');
  const text = content.text.trim();
  const fileHref = toFileHref(content.fileUrl);
  // A field cleared to an empty string in the admin must not leave an empty <h2> labelling the
  // section, nor silently swallow the download link of a rider that *was* uploaded.
  const buttonLabel = content.buttonLabel.trim() || riderDefaults.buttonLabel;
  const heading = content.heading.trim() || riderDefaults.heading;

  if (!text && !fileHref) return null;

  return (
    <section id="rider" className="site-section site-rider" aria-labelledby="rider-title">
      <div className="site-container">
        <Reveal className="site-rider__card">
          <div className="site-rider__body">
            <h2 id="rider-title" className="site-rider__title">
              {heading}
            </h2>
            {text ? <p className="site-rider__text">{text}</p> : null}
          </div>
          {fileHref ? (
            <Button href={fileHref} download variant="light" size="lg" className="site-rider__cta">
              {buttonLabel}
            </Button>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
