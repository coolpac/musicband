import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { hapticImpact, hapticSelection } from '../telegram/telegramWebApp';
import { residents } from '../data/residents';
import type { Resident } from '../data/residents';
import '../styles/residents.css';

function preloadImage(src: string) {
  const img = new Image();
  img.src = src;
}

const HINT_HIDE_KEY = 'residents-hint-seen';

const ASPECT_RATIO = 440 / 550;

type ResidentCardProps = {
  resident: Resident;
  index: number;
  isOpen: boolean;
  onCardClick: (id: string, descriptionSvg?: string) => void;
  onHoverCard: (descriptionSvg?: string, panelImage?: string) => void;
  prefersReducedMotion: boolean;
};

const ResidentCard = memo(function ResidentCard({
  resident,
  index,
  isOpen,
  onCardClick,
  onHoverCard,
  prefersReducedMotion,
}: ResidentCardProps) {
  const { id, name, description, image, image2x, descriptionSvg, panelImage } = resident;
  const useSvgOverlay = Boolean(descriptionSvg);
  const usePanelImage = Boolean(panelImage);
  const animationDelay = prefersReducedMotion ? 0 : index * 0.04;

  return (
    <motion.article
      key={id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: animationDelay }}
      className="residents-card"
      onClick={() => onCardClick(id, descriptionSvg)}
      onMouseEnter={() => onHoverCard(descriptionSvg, panelImage)}
    >
      <div className="residents-card__img-wrap" style={{ aspectRatio: ASPECT_RATIO }}>
        <img
          src={image}
          srcSet={image2x ? `${image} 1x, ${image2x} 2x` : undefined}
          sizes="100vw"
          alt={name}
          className="residents-card__img"
          width={440}
          height={550}
          loading={index === 0 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index === 0 ? 'high' : undefined}
        />
      </div>
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="residents-card__panel residents-card__panel--open"
              role="dialog"
              aria-label={`Описание: ${name}`}
              onClick={(e) => e.stopPropagation()}
            >
              {usePanelImage ? (
                <img
                  src={panelImage}
                  alt=""
                  className="residents-card__panel-image"
                  draggable={false}
                />
              ) : (
                <p className="residents-card__panel-text">{description}</p>
              )}
              <button
                type="button"
                className="residents-card__panel-close"
                onClick={() => { hapticImpact('light'); onCardClick(id); }}
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
});

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
      try {
        sessionStorage.setItem(HINT_HIDE_KEY, '1');
      } catch (e) {
        if (import.meta.env.DEV) console.warn('ResidentsScreen: sessionStorage.setItem failed', e);
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [hintVisible]);

  const handleCardClick = useCallback((id: string, descriptionSvg?: string) => {
    hapticSelection();
    if (hintVisible) {
      setHintVisible(false);
      try {
        sessionStorage.setItem(HINT_HIDE_KEY, '1');
      } catch (e) {
        if (import.meta.env.DEV) console.warn('ResidentsScreen: sessionStorage.setItem failed', e);
      }
    }
    setOpenId((prev) => (prev === id ? null : id));
  }, [hintVisible]);

  const handleHoverCard = useCallback((descriptionSvg?: string, panelImage?: string) => {
    if (descriptionSvg) preloadImage(descriptionSvg);
    if (panelImage) preloadImage(panelImage);
  }, []);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    residents.forEach((r) => {
      if (r.descriptionSvg) preloadImage(r.descriptionSvg);
      if (r.panelImage) preloadImage(r.panelImage);
    });
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
            transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
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
        {residents.map((resident, index) => (
          <ResidentCard
            key={resident.id}
            resident={resident}
            index={index}
            isOpen={openId === resident.id}
            onCardClick={handleCardClick}
            onHoverCard={handleHoverCard}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>
    </main>
  );
}
