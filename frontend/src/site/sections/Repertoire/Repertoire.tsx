import { useEffect, useState, type CSSProperties } from 'react';
import { useSection } from '../../content/SiteDataContext';
import { repertoireDefaults, toFileHref } from '../../content/sections/repertoire';
import { Button } from '../../components/ui/Button';
import { Reveal } from '../../components/ui/Reveal';
import wordmarkUrl from '../../assets/repertoire-collapsed/vgul-wordmark-large.svg';
import './Repertoire.css';

const PANEL_ID = 'repertoire-tracks';

/** «1 песня», «2 песни», «5 песен» — the count sits inside the toggle label. */
function songsWord(count: number): string {
  const tens = count % 100;
  if (tens >= 11 && tens <= 14) return 'песен';
  const ones = count % 10;
  if (ones === 1) return 'песня';
  if (ones >= 2 && ones <= 4) return 'песни';
  return 'песен';
}

/**
 * Репертуар — one accordion section with the two states drawn in Figma:
 * closed = the brand-red slab with the giant ВГУЛ wordmark (345:1399),
 * open   = the dark #111 surface with the numbered track list (354:2354).
 *
 * The list is always in the DOM so crawlers index every song; collapsing is done with
 * grid-template-rows 0fr (never display:none) and is gated on `html.site-js`, so without
 * JavaScript — or if the bundle never boots — the section renders fully expanded.
 */
export function Repertoire() {
  const content = useSection('repertoire');
  const [open, setOpen] = useState(false);
  // `inert` may only appear once the toggle is interactive: on the server, and for a visitor
  // whose JS never arrives, the panel is expanded and must stay readable and selectable.
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);

  const tracks = content.tracks.filter((track) => typeof track === 'string' && track.trim().length > 0);
  const fileHref = toFileHref(content.fileUrl);
  const footnote = content.footnote.trim();
  // A field cleared to an empty string in the admin must not leave an empty <h2> labelling the
  // section, nor silently swallow the download link of a file that *was* uploaded.
  const downloadLabel = content.downloadLabel.trim() || repertoireDefaults.downloadLabel;
  const heading = content.heading.trim() || repertoireDefaults.heading;

  if (tracks.length === 0 && !fileHref) return null;

  return (
    <section
      id="repertoire"
      className={`site-section site-repertoire${open ? ' is-open' : ''}`}
      aria-labelledby="repertoire-title"
    >
      <span className="site-repertoire__veil" aria-hidden="true" />

      <div className="site-container site-repertoire__inner">
        <Reveal className="site-repertoire__head">
          <h2 id="repertoire-title" className="site-repertoire__title">
            {heading}
          </h2>
          {fileHref ? (
            <Button href={fileHref} download variant="light" className="site-repertoire__download">
              {downloadLabel}
            </Button>
          ) : null}
        </Reveal>

        {tracks.length > 0 ? (
          <>
            <Reveal className="site-repertoire__toggle-wrap" index={1}>
              <button
                type="button"
                className="site-repertoire__toggle"
                aria-expanded={open}
                aria-controls={PANEL_ID}
                onClick={() => setOpen((value) => !value)}
              >
                <span className="site-repertoire__wordmark">
                  <span className="site-repertoire__wordmark-clip">
                    <img
                      src={wordmarkUrl}
                      alt=""
                      width={1342}
                      height={355}
                      className="site-repertoire__wordmark-img"
                      draggable={false}
                    />
                  </span>
                </span>
                <span className="site-repertoire__cta">
                  <span>{open ? 'Свернуть' : 'Показать репертуар'}</span>
                  {open ? null : (
                    <span className="site-repertoire__cta-count">
                      {tracks.length} {songsWord(tracks.length)}
                    </span>
                  )}
                </span>
              </button>
            </Reveal>

            <div id={PANEL_ID} className="site-repertoire__panel" inert={interactive && !open}>
              <div className="site-repertoire__panel-inner">
                <ol className="site-repertoire__list" role="list">
                  {tracks.map((track, index) => (
                    <li
                      key={`${index}-${track}`}
                      className="site-repertoire__item"
                      style={{ '--i': index } as CSSProperties}
                    >
                      <span className="site-repertoire__track">{track}</span>
                    </li>
                  ))}
                </ol>
                {footnote ? <p className="site-repertoire__footnote">{footnote}</p> : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
