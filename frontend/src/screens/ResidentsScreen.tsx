import { useState, useCallback } from 'react';
import { residents } from '../data/residents';
import '../styles/residents.css';

function preloadImage(src: string) {
  const img = new Image();
  img.src = src;
}

export default function ResidentsScreen() {
  const [openId, setOpenId] = useState<string | null>(null);

  const handleCardClick = useCallback((id: string, descriptionSvg?: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const handleHoverCard = useCallback((descriptionSvg?: string) => {
    if (descriptionSvg) preloadImage(descriptionSvg);
  }, []);

  return (
    <main className="screen residents-screen">
      <div className="residents-landing">
        {residents.map(
          ({ id, name, shortDescription, description, image, descriptionSvg }) => {
            const isOpen = openId === id;
            const useSvgOverlay = Boolean(descriptionSvg);

            return (
              <article
                key={id}
                className="residents-card"
                onClick={() => handleCardClick(id, descriptionSvg)}
                onMouseEnter={() => handleHoverCard(descriptionSvg)}
              >
                <img
                  src={image}
                  alt={name}
                  className="residents-card__img"
                  loading="lazy"
                  decoding="async"
                />
                {useSvgOverlay && descriptionSvg && (
                  <img
                    src={descriptionSvg}
                    alt=""
                    className={`residents-card__svg-overlay ${isOpen ? 'residents-card__svg-overlay--open' : ''}`}
                    aria-hidden={!isOpen}
                    draggable={false}
                  />
                )}

                {!useSvgOverlay && (
                  <div
                    className={`residents-card__panel ${isOpen ? 'residents-card__panel--open' : ''}`}
                    role="dialog"
                    aria-label={`Описание: ${name}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="residents-card__panel-text">{description}</p>
                    <button
                      type="button"
                      className="residents-card__panel-close"
                      onClick={() => setOpenId(null)}
                      aria-label="Закрыть"
                    >
                      ×
                    </button>
                  </div>
                )}
              </article>
            );
          }
        )}
      </div>
    </main>
  );
}
