import { useEffect, useState, type CSSProperties } from 'react';
import { useSection } from '../../content/SiteDataContext';
import {
  TRACK_LIST_FILENAME,
  formatTrackListText,
  repertoireDefaults,
  toFileHref,
} from '../../content/sections/repertoire';
import { Button } from '../../components/ui/Button';
import { Reveal } from '../../components/ui/Reveal';
import wordmarkUrl from '../../assets/repertoire-collapsed/vgul-wordmark-large.svg';
import './Repertoire.css';

const PANEL_ID = 'repertoire-tracks';

/** Figma groups the list 1–30 | 31–65: the first column holds thirty songs. */
const FIGMA_FIRST_COLUMN = 30;

/**
 * How many songs go to the left column of the two-column list. Up to ~70 songs follow Figma's
 * grouping (30 on the left, the rest on the right); a list the admin has grown far beyond that is
 * simply halved so neither column becomes a wall.
 */
function firstColumnLength(total: number): number {
  const half = Math.ceil(total / 2);
  return total > FIGMA_FIRST_COLUMN * 2 + 10 ? half : Math.min(FIGMA_FIRST_COLUMN, half);
}

/**
 * Builds the .txt in the browser and hands it to the user. Browser-only by construction (Blob,
 * object URL, DOM) — it is only ever called from a click handler, never during render.
 */
function saveTrackList(tracks: readonly string[], footnote: string): void {
  const blob = new Blob([formatTrackListText(tracks, footnote)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = TRACK_LIST_FILENAME;
  link.rel = 'noopener';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Safari starts the download asynchronously; revoking in the same tick would cancel it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Репертуар — one accordion section with the two states drawn in Figma:
 * closed = the red slab with the title, the «скачать список» pill and the giant ВГУЛ wordmark (345:1399),
 * open   = the dark #111 surface with the numbered track list (354:2354).
 *
 * The wordmark IS the toggle (a real button; Figma has no explicit control). The open state gets a
 * small outlined «Скрыть репертуар» pill — the same button, so keyboard focus survives the switch.
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

  const toggleLabel = open ? 'Скрыть репертуар' : 'Показать репертуар';
  const columnStart = firstColumnLength(tracks.length);

  const wordmark = (
    <span className="site-repertoire__wordmark" aria-hidden="true">
      <span className="site-repertoire__wordmark-clip">
        <Reveal as="span" className="site-repertoire__wordmark-reveal" index={1}>
          <img
            src={wordmarkUrl}
            alt=""
            width={1342}
            height={355}
            className="site-repertoire__wordmark-img"
            draggable={false}
          />
        </Reveal>
      </span>
    </span>
  );

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
          ) : (
            <Button
              variant="light"
              className="site-repertoire__download site-repertoire__download--generated"
              onClick={() => saveTrackList(tracks, footnote)}
            >
              {downloadLabel}
            </Button>
          )}
        </Reveal>

        <div className="site-repertoire__gap" aria-hidden="true">
          <span className="site-repertoire__gap-clip">
            <span className="site-repertoire__gap-fill" />
          </span>
        </div>

        {tracks.length > 0 ? (
          <>
            <button
              type="button"
              className="site-repertoire__toggle"
              aria-expanded={open}
              aria-controls={PANEL_ID}
              aria-label={toggleLabel}
              onClick={() => setOpen((value) => !value)}
            >
              {wordmark}
              <span className="site-repertoire__close" aria-hidden="true">
                Скрыть репертуар
              </span>
            </button>

            <div id={PANEL_ID} className="site-repertoire__panel" inert={interactive && !open}>
              <div className="site-repertoire__panel-inner">
                <div className="site-repertoire__content">
                  {/* role="list": Safari drops list semantics from an <ol> whose markers are removed. */}
                  <ol className="site-repertoire__list" role="list">
                    {tracks.map((track, index) => (
                      <li
                        key={`${index}-${track}`}
                        className={`site-repertoire__item${index === columnStart ? ' site-repertoire__item--column-start' : ''}`}
                        style={{ '--i': index } as CSSProperties}
                      >
                        {/* The number is typed text like in Figma (so it wraps and copies like text); the <ol> already carries the position for assistive tech. */}
                        <span aria-hidden="true">{index + 1}.</span> {track}
                      </li>
                    ))}
                  </ol>
                  {footnote ? <p className="site-repertoire__footnote">{footnote}</p> : null}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="site-repertoire__toggle">{wordmark}</div>
        )}
      </div>
    </section>
  );
}
