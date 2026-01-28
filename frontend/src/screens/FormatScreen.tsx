import { useCallback, useEffect, useRef, useState } from 'react';
import { Format } from '../types/format';
import { getFormats } from '../services/formatService';
import formatIcon from '../assets/figma/format-icon.svg';

type FormatScreenProps = {
  onFormatClick: (formatId: string) => void;
  onBack: () => void;
};

export default function FormatScreen({ onFormatClick, onBack }: FormatScreenProps) {
  const [formats, setFormats] = useState<Format[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const offsetRef = useRef(0);
  const snapTimeoutRef = useRef<number | null>(null);
  const swipeStateRef = useRef({ startX: 0, startIndex: 0, active: false });

  const updateSlideStep = useCallback(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    const slide = slider.querySelector<HTMLElement>('.format-slide');
    if (!slide) return;

    const styles = window.getComputedStyle(slider);
    const gapValue = styles.columnGap || styles.gap || '0';
    const gap = Number.parseFloat(gapValue) || 0;

    stepRef.current = slide.getBoundingClientRect().width + gap;
    const sliderRect = slider.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    offsetRef.current = slideRect.left - sliderRect.left + slider.scrollLeft;
  }, []);

  const updateActiveIndex = useCallback(() => {
    const slider = sliderRef.current;
    const step = stepRef.current;
    const offset = offsetRef.current;

    if (!slider || !step) return;

    const nextIndex = Math.round((slider.scrollLeft - offset) / step);
    const clampedIndex = Math.min(Math.max(nextIndex, 0), formats.length - 1);
    setActiveIndex(clampedIndex);
  }, [formats.length]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      updateActiveIndex();
    });

    if (snapTimeoutRef.current !== null) {
      window.clearTimeout(snapTimeoutRef.current);
    }
    snapTimeoutRef.current = window.setTimeout(() => {
      const slider = sliderRef.current;
      const step = stepRef.current;
      const offset = offsetRef.current;
      if (!slider || !step) return;
      const targetIndex = Math.round((slider.scrollLeft - offset) / step);
      const clampedIndex = Math.min(Math.max(targetIndex, 0), formats.length - 1);
      slider.scrollTo({ left: offset + step * clampedIndex, behavior: 'smooth' });
    }, 140);
  }, [formats.length, updateActiveIndex]);

  const handleDotClick = useCallback(
    (index: number) => {
      const slider = sliderRef.current;
      const step = stepRef.current;
      const offset = offsetRef.current;
      if (!slider || !step) return;
      slider.scrollTo({ left: offset + step * index, behavior: 'smooth' });
    },
    []
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStateRef.current = {
      startX: e.touches[0].clientX,
      startIndex: activeIndex,
      active: true,
    };
  }, [activeIndex]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeStateRef.current.active) return;
    const deltaX = swipeStateRef.current.startX - e.changedTouches[0].clientX;
    const threshold = 50;

    if (Math.abs(deltaX) > threshold) {
      const direction = deltaX > 0 ? 1 : -1;
      const newIndex = Math.min(
        Math.max(swipeStateRef.current.startIndex + direction, 0),
        formats.length - 1
      );
      handleDotClick(newIndex);
    }
    swipeStateRef.current.active = false;
  }, [formats.length, handleDotClick]);

  useEffect(() => {
    const loadFormats = async () => {
      try {
        const data = await getFormats();
        setFormats(data.sort((a, b) => a.order - b.order));
      } catch (error) {
        console.error('Failed to load formats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFormats();
  }, []);

  useEffect(() => {
    updateSlideStep();
    const handleResize = () => updateSlideStep();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateSlideStep]);

  const activeFormat = formats[activeIndex];

  return (
    <main className="screen screen--format">
      <button className="format-back-btn" onClick={onBack} type="button">
        Назад
      </button>
      <div className="format-container">
        {loading ? (
          <div className="format-loading">Загрузка...</div>
        ) : (
          <>
            <div
              className="format-slider"
              ref={sliderRef}
              onScroll={handleScroll}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {formats.map((format) => (
                <div key={format.id} className="format-slide">
                  <div className="format-hero">
                    {format.status === 'coming-soon' ? (
                      <div className="format-coming-soon-card">
                        <img alt="Иконка замка" className="format-lock-icon" src={formatIcon} />
                      </div>
                    ) : (
                      <img alt={format.name} className="format-image" src={format.imageUrl} />
                    )}
                    <div className="format-overlay">
                      <div className="format-content">
                        <h1 className="format-title">{format.name}</h1>
                        <p className="format-short-description">{format.shortDescription}</p>
                        <div className="format-pagination-inline">
                          {formats.map((_, index) => (
                            <button
                              key={index}
                              aria-label={`Формат ${index + 1}`}
                              aria-selected={activeIndex === index}
                              className={`format-dot-inline${
                                activeIndex === index ? ' format-dot-inline--active' : ''
                              }`}
                              onClick={() => handleDotClick(index)}
                              type="button"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {activeFormat && (
              <button
                className="btn btn-primary format-cta"
                onClick={() => onFormatClick(activeFormat.id)}
                type="button"
              >
                {activeFormat.status === 'coming-soon' ? 'Получить прайс' : 'Что в шоу?'}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
