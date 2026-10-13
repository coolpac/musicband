import { useState } from 'react';
import { useSection } from '../../content/SiteDataContext';
import { videoDefaults } from '../../content/sections/video';
import { Picture } from '../../components/ui/Picture';
import { Reveal } from '../../components/ui/Reveal';
import { VideoLightbox } from '../../components/ui/VideoLightbox';
import { siteImages } from '../../assets/opt/manifest';
import swooshLargeUrl from '../../assets/video/decor-swoosh-large.svg';
import swooshSmallUrl from '../../assets/video/decor-swoosh-small.svg';
import playBadgeUrl from '../../assets/video/thumbnail-play-badge.svg';
import playIconUrl from '../../assets/video/icon-play-outline.svg';
import signatureCircleUrl from '../../assets/video/signature-circle.svg';
import signatureMarkUrl from '../../assets/video/signature-mark.svg';
import './Video.css';

/**
 * «Посмотрите наше Live-видео» — Figma `VideoSection` 345:1389. Always rendered: with no link
 * saved in the admin it plays the showreel from `videoDefaults`.
 * Figma paints the black scrim ABOVE the text column, which knocks the headline down to ~#d2d2d2,
 * the grey paragraph below AA contrast (≈3:1) and the red CTA disc to #bf2528. That is a layer-order
 * slip, not a design intent: here the scrim sits under the copy, so the headline is white and the
 * disc is brand red (#ff3135 — the fill Figma itself specifies for it).
 */
export function Video() {
  const content = useSection('video');
  const [open, setOpen] = useState(false);

  // A cleared field falls back to the default showreel: the block never renders a dead player.
  const url = content.videoUrl.trim() || videoDefaults.videoUrl;
  const heading = content.heading.trim();

  const poster = content.poster ?? siteImages['video/video-thumbnail-band'];
  const label = content.buttonLabel.trim() || 'Смотреть видео';
  const dialogTitle = heading || label;
  const headingParts = /^(.*\s)(\S+)$/.exec(heading);

  return (
    <section
      id="video"
      className="site-section site-video"
      aria-labelledby={heading ? 'video-title' : undefined}
      aria-label={heading ? undefined : label}
    >
      <div className="site-video__decor" aria-hidden="true">
        <img className="site-video__swoosh site-video__swoosh--large" src={swooshLargeUrl} alt="" width={618} height={395} />
        <span className="site-video__swoosh site-video__swoosh--small">
          <img src={swooshSmallUrl} alt="" width={278} height={189} />
        </span>
      </div>
      <div className="site-video__scrim" aria-hidden="true" />

      <div className="site-container site-video__inner">
        <Reveal className="site-video__media" variant="left">
          <button
            type="button"
            className="site-video__thumb"
            onClick={() => setOpen(true)}
            aria-label={heading ? `${label}: ${heading}` : label}
          >
            <Picture
              image={poster}
              alt=""
              sizes="(min-width: 1280px) 600px, (min-width: 1024px) 47vw, 92vw"
              className="site-video__poster"
              wrapperClassName="site-video__poster-wrap"
            />
            <span className="site-video__badge" aria-hidden="true">
              <img src={playBadgeUrl} alt="" width={57} height={57} />
            </span>
          </button>
        </Reveal>

        <div className="site-video__text">
          {heading ? (
            <Reveal as="h2" id="video-title" className="site-video__title" index={1}>
              {headingParts ? (
                <>
                  {headingParts[1]}
                  <span className="site-video__nowrap">{headingParts[2]}</span>
                </>
              ) : (
                heading
              )}
            </Reveal>
          ) : null}
          {content.text.trim() ? (
            <Reveal as="p" className="site-video__lead" index={2}>
              {content.text}
            </Reveal>
          ) : null}
          <Reveal className="site-video__cta-row" index={3}>
            <button type="button" className="site-video__cta" onClick={() => setOpen(true)}>
              <span className="site-video__cta-disc" aria-hidden="true">
                <img src={playIconUrl} alt="" width={20} height={20} />
              </span>
              <span className="site-video__cta-label">{label}</span>
            </button>
          </Reveal>
        </div>
      </div>

      <div className="site-video__signature" aria-hidden="true">
        <img className="site-video__signature-disc" src={signatureCircleUrl} alt="" width={134} height={135} />
        <img className="site-video__signature-mark" src={signatureMarkUrl} alt="" width={118} height={87} />
      </div>

      <VideoLightbox url={url} title={dialogTitle} open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
