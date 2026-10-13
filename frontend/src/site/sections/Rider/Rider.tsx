import { useSection } from '../../content/SiteDataContext';
import { toFileHref } from '../../content/sections/repertoire';
import { riderDefaults } from '../../content/sections/rider';
import { Button } from '../../components/ui/Button';
import { Reveal } from '../../components/ui/Reveal';
import './Rider.css';

/**
 * Райдер. Figma 345:1402 is a full-width #ff3135 band with «РАЙДЕР» centred on it. The band always
 * renders. The optional text and the download button appear only once the admin fills them, and
 * they extend the band downwards; with neither, the band is exactly the Figma frame.
 */
export function Rider() {
  const content = useSection('rider');
  const text = content.text.trim();
  const fileHref = toFileHref(content.fileUrl);
  // A field cleared to an empty string in the admin must not leave an empty <h2> labelling the
  // section, nor silently swallow the download link of a rider that *was* uploaded.
  const buttonLabel = content.buttonLabel.trim() || riderDefaults.buttonLabel;
  const heading = content.heading.trim() || riderDefaults.heading;

  return (
    <section id="rider" className="site-section site-rider" aria-labelledby="rider-title">
      <div className="site-container site-rider__inner">
        <Reveal as="h2" id="rider-title" className="site-rider__title">
          {heading}
        </Reveal>
        {text ? (
          <Reveal as="p" index={1} className="site-rider__text">
            {text}
          </Reveal>
        ) : null}
        {fileHref ? (
          <Reveal index={2}>
            <Button href={fileHref} download variant="light" size="lg">
              {buttonLabel}
            </Button>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
