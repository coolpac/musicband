import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';
import { hapticImpact, hapticSelection } from '../telegram/telegramWebApp';
import { residents } from '../data/residents';
import '../styles/residents.css';

function preloadImage(src: string) {
  const img = new Image();
  img.src = src;
}

export default function ResidentsScreen() {
  const [openId, setOpenId] = useState<string | null>(null);

  const handleCardClick = useCallback((id: string, descriptionSvg?: string) => {
    hapticSelection();
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const handleHoverCard = useCallback((descriptionSvg?: string) => {
    if (descriptionSvg) preloadImage(descriptionSvg);
  }, []);

  return (
    <main className="screen residents-screen">
      <div className="residents-landing">
        {residents.map(
          ({ id, name, shortDescription, description, image, descriptionSvg }, index) => {
            const isOpen = openId === id;
            const useSvgOverlay = Boolean(descriptionSvg);

            return (
              <motion.article
                key={id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
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
                  <AnimatePresence>
                    {isOpen && (
                      <motion.img
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        src={descriptionSvg}
                        alt=""
                        className="residents-card__svg-overlay residents-card__svg-overlay--open"
                        aria-hidden={!isOpen}
                        draggable={false}
                      />
                    )}
                  </AnimatePresence>
                )}

                {!useSvgOverlay && (
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3 }}
                        className="residents-card__panel residents-card__panel--open"
                        role="dialog"
                        aria-label={`Описание: ${name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="residents-card__panel-text">{description}</p>
                        <button
                          type="button"
                          className="residents-card__panel-close"
                          onClick={() => { hapticImpact('light'); setOpenId(null); }}
                          aria-label="Закрыть"
                        >
                          ×
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.article>
            );
          }
        )}
      </div>
    </main>
  );
}
