import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import { hapticImpact, hapticSelection } from '../telegram/telegramWebApp';
import { residents } from '../data/residents';
import '../styles/residents.css';

function preloadImage(src: string) {
  const img = new Image();
  img.src = src;
}

const HINT_HIDE_KEY = 'residents-hint-seen';

export default function ResidentsScreen() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(() => {
    if (typeof sessionStorage === 'undefined') return true;
    return !sessionStorage.getItem(HINT_HIDE_KEY);
  });

  useEffect(() => {
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  }, []);

  useEffect(() => {
    if (!hintVisible) return;
    const t = setTimeout(() => {
      setHintVisible(false);
      sessionStorage.setItem(HINT_HIDE_KEY, '1');
    }, 5000);
    return () => clearTimeout(t);
  }, [hintVisible]);

  const handleCardClick = useCallback((id: string, descriptionSvg?: string) => {
    hapticSelection();
    if (hintVisible) {
      setHintVisible(false);
      try { sessionStorage.setItem(HINT_HIDE_KEY, '1'); } catch {}
    }
    setOpenId((prev) => (prev === id ? null : id));
  }, [hintVisible]);

  const handleHoverCard = useCallback((descriptionSvg?: string) => {
    if (descriptionSvg) preloadImage(descriptionSvg);
  }, []);

  return (
    <main className="screen residents-screen">
      <AnimatePresence>
        {hintVisible && (
          <motion.div
            className="residents-hint"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.3 }}
          >
            <span className="residents-hint__arrow" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </span>
            <span>Листайте вниз · Нажмите на карточку</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="residents-landing">
        {residents.map(
          ({ id, name, shortDescription, description, image, descriptionSvg }, index) => {
            const isOpen = openId === id;
            const useSvgOverlay = Boolean(descriptionSvg);

            return (
              <motion.article
                key={id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className="residents-card"
                onClick={() => handleCardClick(id, descriptionSvg)}
                onMouseEnter={() => handleHoverCard(descriptionSvg)}
              >
                <img
                  src={image}
                  alt={name}
                  className="residents-card__img"
                  width={440}
                  height={550}
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
