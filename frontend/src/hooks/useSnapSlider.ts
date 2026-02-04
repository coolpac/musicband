import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface UseSnapSliderOptions {
  itemCount: number;
  snapDebounceMs?: number;
  direction?: 'horizontal' | 'vertical';
  /** Селектор первого слайда для расчёта step/offset; по умолчанию — первый дочерний элемент */
  slideSelector?: string;
}

export interface UseSnapSliderReturn {
  sliderRef: RefObject<HTMLDivElement | null>;
  activeIndex: number;
  scrollToIndex: (index: number) => void;
  handleScroll: () => void;
}

function getScrollPosition(el: HTMLDivElement, direction: 'horizontal' | 'vertical'): number {
  return direction === 'horizontal' ? el.scrollLeft : el.scrollTop;
}

function setScrollPosition(el: HTMLDivElement, value: number, direction: 'horizontal' | 'vertical'): void {
  if (direction === 'horizontal') {
    el.scrollTo({ left: value, behavior: 'smooth' });
  } else {
    el.scrollTo({ top: value, behavior: 'smooth' });
  }
}

export function useSnapSlider(options: UseSnapSliderOptions): UseSnapSliderReturn {
  const {
    itemCount,
    snapDebounceMs = 140,
    direction = 'horizontal',
    slideSelector,
  } = options;

  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const stepRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(() => {
    const slider = sliderRef.current;
    if (!slider || itemCount <= 0) return;

    const slide = slideSelector
      ? slider.querySelector<HTMLElement>(slideSelector)
      : slider.firstElementChild as HTMLElement | null;

    if (!slide) return;

    const styles = window.getComputedStyle(slider);
    const gapProp = direction === 'horizontal' ? 'columnGap' : 'rowGap';
    const gapValue = styles[gapProp as keyof CSSStyleDeclaration] || styles.gap || '0';
    const gap = Number.parseFloat(String(gapValue)) || 0;

    const rect = slide.getBoundingClientRect();
    const sliderRect = slider.getBoundingClientRect();
    const size = direction === 'horizontal' ? rect.width : rect.height;
    const pos = direction === 'horizontal'
      ? rect.left - sliderRect.left + getScrollPosition(slider, direction)
      : rect.top - sliderRect.top + getScrollPosition(slider, direction);

    stepRef.current = size + gap;
    offsetRef.current = pos;
  }, [direction, itemCount, slideSelector]);

  const updateActiveIndex = useCallback(() => {
    const slider = sliderRef.current;
    const step = stepRef.current;
    const offset = offsetRef.current;

    if (!slider || !step || itemCount <= 0) return;

    const scrollPos = getScrollPosition(slider, direction);
    const nextIndex = Math.round((scrollPos - offset) / step);
    const clamped = Math.min(Math.max(nextIndex, 0), itemCount - 1);
    setActiveIndex(clamped);
  }, [direction, itemCount]);

  const handleScroll = useCallback(() => {
    const slider = sliderRef.current;
    if (!slider || itemCount <= 0) return;

    measure();

    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      updateActiveIndex();
    });

    if (snapTimeoutRef.current !== null) {
      clearTimeout(snapTimeoutRef.current);
    }
    snapTimeoutRef.current = setTimeout(() => {
      snapTimeoutRef.current = null;
      const step = stepRef.current;
      const offset = offsetRef.current;
      if (!step) return;
      const scrollPos = getScrollPosition(slider, direction);
      const targetIndex = Math.round((scrollPos - offset) / step);
      const clamped = Math.min(Math.max(targetIndex, 0), itemCount - 1);
      setScrollPosition(slider, offset + step * clamped, direction);
    }, snapDebounceMs);
  }, [itemCount, measure, snapDebounceMs, direction, updateActiveIndex]);

  const scrollToIndex = useCallback((index: number) => {
    const slider = sliderRef.current;
    if (!slider || itemCount <= 0) return;

    measure();
    const step = stepRef.current;
    const offset = offsetRef.current;
    if (!step) return;

    const clamped = Math.min(Math.max(index, 0), itemCount - 1);
    setScrollPosition(slider, offset + step * clamped, direction);
    setActiveIndex(clamped);
  }, [direction, itemCount, measure]);

  useEffect(() => {
    // Initial measure after mount and when itemCount changes.
    // Двойной таймер: первый — сразу после layout (50ms),
    // второй — после завершения page transition (300ms) для гарантии
    // корректного состояния при навигации назад (framer-motion fade-in).
    if (itemCount > 0) {
      const timer1 = setTimeout(() => {
        measure();
        updateActiveIndex();
      }, 50);
      const timer2 = setTimeout(() => {
        measure();
        updateActiveIndex();
      }, 300);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [itemCount, measure, updateActiveIndex]);

  useEffect(() => {
    const onResize = () => {
      measure();
      updateActiveIndex();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (snapTimeoutRef.current !== null) {
        clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
    };
  }, [measure, updateActiveIndex]);

  return {
    sliderRef,
    activeIndex,
    scrollToIndex,
    handleScroll,
  };
}
