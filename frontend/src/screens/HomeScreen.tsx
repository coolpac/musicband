import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import posterImage from '../assets/figma/poster.png';
import promoImage from '../assets/figma/promo.png';
import promoPlay from '../assets/figma/play-promo.svg';
import formatImage from '../assets/figma/format.png';
import liveImage from '../assets/figma/live.png';
import livePlay from '../assets/figma/play-live.svg';
import residentsImage from '../assets/figma/residents.png';
import dateWave from '../assets/figma/date-wave.svg';
import heroImageLocal from '../assets/figma/hero-image.png';
import heroLogo from '../assets/figma/downloaded/hero-logo.svg';
import heroCoverBand from '../assets/figma/downloaded/hero-cover-band.svg';
import heroVectorGroup from '../assets/figma/downloaded/hero-vector-group.svg';
const heroImage = heroImageLocal;

import imgAward2025Local from '../assets/figma/award-2025.png';
import imgAward2024 from '../assets/figma/downloaded/award-2024.png';
import imgLiveSound from '../assets/figma/downloaded/live-sound.png';
import imgFlexibleTerms from '../assets/figma/downloaded/flexible-terms.png';
import imgEllipse240 from '../assets/figma/downloaded/ellipse-240.svg';
import imgWhyCircle from '../assets/figma/downloaded/why-circle.svg';
import imgWhyVectorTop from '../assets/figma/downloaded/why-vector-top.svg';
import imgWhyVectorBottom from '../assets/figma/downloaded/why-vector-bottom.svg';
import imgWhyVectorWide from '../assets/figma/downloaded/why-vector-wide.svg';
import imgEllipse242 from '../assets/figma/downloaded/ellipse-242.svg';
import imgEllipse241 from '../assets/figma/downloaded/ellipse-241.svg';
import imgSecondPanelLeft from '../assets/figma/downloaded/second-panel-left.png';
import imgSecondPanelCenter from '../assets/figma/downloaded/second-panel-center.png';
import imgSecondPanelRight from '../assets/figma/downloaded/second-panel-right.png';
import imgThirdPanelLeft from '../assets/figma/downloaded/third-panel-left.png';
import imgThirdPanelCenter from '../assets/figma/downloaded/third-panel-center.png';
import imgThirdPanelRight from '../assets/figma/downloaded/third-panel-right.png';
const imgAward2025 = imgAward2025Local;

import { getPosters, Poster } from '../services/posterService';
import { getPartners, Partner } from '../services/partnerService';
/* TEMPORARY: редактор декора — удалить вместе с WhyDecorEditor.tsx и стилями .why-decor-editor-* */
import { WhyDecorEditor, objectToDecorItems, type WhyMobileDecorItem } from './WhyDecorEditor';

const promoVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';
const liveVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

/**
 * Размер фрейма мобильного слайда «Почему мы?» в Figma.
 * Подставь Width и Height своего фрейма — от этого считаются позиции (x, y → left%, top%).
 * Инструкция: frontend/docs/figma-why-decor.md
 */
const FIGMA_MOBILE_WHY_FRAME = { width: 375, height: 520 };

/** Позиция и размер элемента из Figma (X, Y, Width, Height в пикселях относительно фрейма). */
type FigmaRect = { x: number; y: number; w: number; h: number; opacity?: number; flipHorizontal?: boolean; flipVertical?: boolean; rotate?: number };
/** Позиция эллипса (X, Y); размер берётся из CSS. */
type FigmaEllipsePos = { x: number; y: number; opacity?: number; flipHorizontal?: boolean; flipVertical?: boolean; rotate?: number };

const whyMobileSlides = [
  {
    id: 'award-2025',
    image: imgAward2025,
    alt: 'Диплом премии «Призвание Арист»',
    text: 'призеры премии: “ПРИЗВАНИЕ АРИСТ 2025”',
  },
  {
    id: 'award-2024',
    image: imgAward2024,
    alt: 'Диплом премии «Призвание Арист»',
    text: 'призеры премии: “ПРИЗВАНИЕ АРИСТ 2024”',
  },
  {
    id: 'live-sound',
    image: imgLiveSound,
    alt: 'Выступление',
    text: 'Живой звук, профессиональный состав, опыт выступлений на топовых площадках;',
  },
  {
    id: 'flexible-terms',
    image: imgFlexibleTerms,
    alt: 'Сцена',
    text: 'Гибкие условия сотрудничества;',
  },
  {
    id: 'custom-format',
    image: imgSecondPanelLeft,
    alt: 'Сцена',
    text: 'Подстроимся под ваши задачи и формат;',
  },
  {
    id: 'unique-repertoire',
    image: imgSecondPanelCenter,
    alt: 'Музыкант',
    text: 'Репертуар песен, которого нет у других;',
  },
  {
    id: 'format-repertoire',
    image: imgSecondPanelRight,
    alt: 'Событие',
    text: 'Подбираем репертуар под формат события;',
  },
  {
    id: 'interactive',
    image: imgThirdPanelLeft,
    alt: 'Выступление',
    text: 'Работаем с интерактивом - вовлекаем гостей в шоу;',
  },
  {
    id: 'scenario',
    image: imgThirdPanelCenter,
    alt: 'Сцена',
    text: 'Создаем сценарий выступления;',
  },
  {
    id: 'uniqueness',
    image: imgThirdPanelRight,
    alt: 'Группа',
    text: 'Мы показываем уровень, индевидуальность и неповторимость',
  },
];

type WhyMobileDecorFigma = {
  ellipse?: FigmaRect;
  vectorTop?: FigmaRect;
  vectorBottom?: FigmaRect;
  vectorWide?: FigmaRect;
  ellipseLeft?: FigmaEllipsePos;
  ellipseRight?: FigmaEllipsePos;
};

/*
  НАСТРОЙКА ДЕКОРА «ПОЧЕМУ МЫ» НА МОБИЛКЕ
  -----------------------------------------
  Один элемент массива = один слайд (индекс 0 = первый слайд, 1 = второй и т.д.).

  В каждом слайде можно включить до 6 элементов. Ключ = какой элемент, значение = где стоит и виден ли:

    ellipse       — чёрный круг
    vectorTop     — верхняя волнистая дуга
    vectorBottom  — нижняя волнистая дуга
    vectorWide    — большой широкий blob
    ellipseLeft   — вертикальный эллипс (часто слева)
    ellipseRight  — вертикальный эллипс (часто справа)

  Позиция и размер (в пикселях от левого верхнего угла слайда):
    x, y — куда ставить (0,0 = верх-лево; ширина слайда = FIGMA_MOBILE_WHY_FRAME.width, высота = .height)
    w, h — ширина и высота (для ellipseLeft/ellipseRight не задаёшь — размер в CSS)
    opacity — от 0 (не видно) до 1 (полностью видно). Чтобы элемент не показывать — opacity: 0 или убери ключ.

  Пример: круг по центру сверху при фрейме 375×600:
    ellipse: { x: 163, y: 20, w: 50, h: 50, opacity: 1 }

  Формат «массив элементов» (из редактора ?decorEdit=1): слайд = массив объектов
  с полями type, id, x, y, w?, h?, opacity?, ... — можно несколько элементов одного type (например два ellipse).
*/
type WhyMobileDecorSlide = WhyMobileDecorFigma | WhyMobileDecorItem[];

function normalizeDecorSlide(slide: WhyMobileDecorSlide | undefined): WhyMobileDecorItem[] {
  if (slide == null) return [];
  return Array.isArray(slide) ? slide : objectToDecorItems(slide);
}

function toDecorSlides(data: WhyMobileDecorSlide[]): WhyMobileDecorItem[][] {
  return data.map((slide) => normalizeDecorSlide(slide));
}

const whyMobileDecorFromFigma: WhyMobileDecorSlide[] = [
  [
    { type: 'ellipse', id: 'ellipse', x: 309, y: 58, w: 59, h: 53, opacity: 1 },
    { type: 'vectorTop', id: 'vectorTop', x: 19, y: 30, w: 120, h: 100, opacity: 0 },
    { type: 'vectorBottom', id: 'vectorBottom', x: 19, y: 30, w: 120, h: 100, opacity: 0 },
    { type: 'vectorTop', id: 'vectorTop_1769726894240', x: 260, y: 175, w: 120, h: 100, opacity: 1, rotate: 90 },
    { type: 'vectorTop', id: 'vectorTop_1769726961457', x: 170, y: 175, w: 120, h: 100, opacity: 1, rotate: 90 },
    { type: 'vectorTop', id: 'vectorTop_1769726986391', x: 20, y: 440, w: 120, h: 100, opacity: 1 },
  ],
  [
    { type: 'ellipse', id: 'ellipse', x: 281, y: 480, w: 75, h: 75, opacity: 0.9 },
    { type: 'vectorTop', id: 'vectorTop', x: 19, y: 60, w: 100, h: 80, opacity: 0 },
    { type: 'vectorBottom', id: 'vectorBottom', x: 38, y: 120, w: 100, h: 80, opacity: 0 },
    { type: 'vectorWide', id: 'vectorWide', x: 94, y: 60, w: 300, h: 220, opacity: 1 },
    { type: 'ellipseLeft', id: 'ellipseLeft', x: 19, y: 270, opacity: 1 },
    { type: 'ellipseRight', id: 'ellipseRight', x: 75, y: 282, opacity: 1 },
  ],
  [
    { type: 'ellipse', id: 'ellipse', x: 169, y: -22, w: 55, h: 55, opacity: 1 },
    { type: 'vectorTop', id: 'vectorTop', x: -38, y: 210, w: 140, h: 110, opacity: 1 },
    { type: 'vectorBottom', id: 'vectorBottom', x: -19, y: 330, w: 140, h: 110, opacity: 1 },
    { type: 'vectorWide', id: 'vectorWide', x: 206, y: 450, w: 200, h: 150, opacity: 0.6 },
    { type: 'ellipseLeft', id: 'ellipseLeft', x: 281, y: 98, opacity: 0 },
    { type: 'ellipseRight', id: 'ellipseRight', x: 319, y: 128, opacity: 0 },
  ],
  [
    { type: 'ellipse', id: 'ellipse', x: 319, y: 98, w: 65, h: 65, opacity: 1 },
    { type: 'vectorTop', id: 'vectorTop', x: 56, y: 510, w: 110, h: 90, opacity: 0.7 },
    { type: 'vectorBottom', id: 'vectorBottom', x: 94, y: 450, w: 110, h: 90, opacity: 0 },
    { type: 'vectorWide', id: 'vectorWide', x: -94, y: 90, w: 280, h: 200, opacity: 0.4 },
    { type: 'ellipseLeft', id: 'ellipseLeft', x: 169, y: 278, opacity: 1 },
    { type: 'ellipseRight', id: 'ellipseRight', x: 225, y: 290, opacity: 1 },
  ],
  [
    { type: 'ellipse', id: 'ellipse', x: 30, y: 338, w: 60, h: 60, opacity: 0.8 },
    { type: 'vectorTop', id: 'vectorTop', x: 206, y: 90, w: 130, h: 105, opacity: 1 },
    { type: 'vectorBottom', id: 'vectorBottom', x: 188, y: 180, w: 130, h: 105, opacity: 1 },
    { type: 'vectorWide', id: 'vectorWide', x: 131, y: 510, w: 220, h: 160, opacity: 0.9 },
    { type: 'ellipseLeft', id: 'ellipseLeft', x: 30, y: 68, opacity: 0.6 },
    { type: 'ellipseRight', id: 'ellipseRight', x: 68, y: 86, opacity: 0.6 },
  ],
  [
    { type: 'ellipse', id: 'ellipse', x: 244, y: 218, w: 80, h: 80, opacity: 1 },
    { type: 'vectorTop', id: 'vectorTop', x: 56, y: 60, w: 115, h: 95, opacity: 0.5 },
    { type: 'vectorBottom', id: 'vectorBottom', x: 75, y: 120, w: 115, h: 95, opacity: 0 },
    { type: 'vectorWide', id: 'vectorWide', x: 206, y: 60, w: 260, h: 190, opacity: 1 },
    { type: 'ellipseLeft', id: 'ellipseLeft', x: 319, y: 458, opacity: 1 },
    { type: 'ellipseRight', id: 'ellipseRight', x: 356, y: 470, opacity: 1 },
  ],
  [
    { type: 'ellipse', id: 'ellipse', x: 131, y: 488, w: 65, h: 65, opacity: 1 },
    { type: 'vectorTop', id: 'vectorTop', x: 281, y: 210, w: 125, h: 100, opacity: 1 },
    { type: 'vectorBottom', id: 'vectorBottom', x: 263, y: 330, w: 125, h: 100, opacity: 1 },
    { type: 'vectorWide', id: 'vectorWide', x: -75, y: 150, w: 240, h: 170, opacity: 0.3 },
    { type: 'ellipseLeft', id: 'ellipseLeft', x: 56, y: 38, opacity: 0.8 },
    { type: 'ellipseRight', id: 'ellipseRight', x: 94, y: 68, opacity: 0 },
  ],
  [
    { type: 'ellipse', id: 'ellipse', x: 206, y: 278, w: 85, h: 85, opacity: 0.2 },
    { type: 'vectorTop', id: 'vectorTop', x: 30, y: 48, w: 100, h: 80, opacity: 1 },
    { type: 'vectorBottom', id: 'vectorBottom', x: 319, y: 510, w: 100, h: 80, opacity: 1 },
    { type: 'vectorWide', id: 'vectorWide', x: 113, y: 180, w: 200, h: 150, opacity: 1 },
    { type: 'ellipseLeft', id: 'ellipseLeft', x: 30, y: 458, opacity: 1 },
    { type: 'ellipseRight', id: 'ellipseRight', x: 319, y: -4, opacity: 1 },
  ],
  [
    { type: 'ellipse', id: 'ellipse', x: 75, y: 38, w: 55, h: 55, opacity: 1 },
    { type: 'vectorTop', id: 'vectorTop', x: 244, y: 450, w: 140, h: 110, opacity: 1 },
    { type: 'vectorBottom', id: 'vectorBottom', x: 56, y: 270, w: 140, h: 110, opacity: 0.4 },
    { type: 'vectorWide', id: 'vectorWide', x: 169, y: 270, w: 300, h: 220, opacity: 0.7 },
    { type: 'ellipseLeft', id: 'ellipseLeft', x: 338, y: 68, opacity: 1 },
    { type: 'ellipseRight', id: 'ellipseRight', x: 300, y: 98, opacity: 1 },
  ],
  [
    { type: 'ellipse', id: 'ellipse', x: 319, y: 458, w: 65, h: 65, opacity: 1 },
    { type: 'vectorTop', id: 'vectorTop', x: 94, y: 150, w: 120, h: 100, opacity: 1 },
    { type: 'vectorBottom', id: 'vectorBottom', x: 131, y: 90, w: 120, h: 100, opacity: 1 },
    { type: 'vectorWide', id: 'vectorWide', x: -38, y: 480, w: 210, h: 150, opacity: 0.5 },
    { type: 'ellipseLeft', id: 'ellipseLeft', x: 206, y: 8, opacity: 1 },
    { type: 'ellipseRight', id: 'ellipseRight', x: 244, y: 26, opacity: 1 },
  ],
];

const whyDesktopSlides = ['panel-2024', 'panel-flex', 'panel-interactive'];

type HomeScreenProps = {
  onMenuOpen?: () => void;
};

export default function HomeScreen({ onMenuOpen }: HomeScreenProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const offsetRef = useRef(0);
  const snapTimeoutRef = useRef<number | null>(null);
  const swipeStateRef = useRef({ startX: 0, startIndex: 0, active: false });
  const desktopSliderRef = useRef<HTMLDivElement>(null);
  const desktopRafRef = useRef<number | null>(null);
  const desktopStepRef = useRef(0);
  const desktopOffsetRef = useRef(0);
  const desktopSnapTimeoutRef = useRef<number | null>(null);
  const desktopSwipeStateRef = useRef({ startX: 0, startIndex: 0, active: false });
  const [activeWhyIndex, setActiveWhyIndex] = useState(0);
  const [activeWhyDesktopIndex, setActiveWhyDesktopIndex] = useState(0);
  /* TEMPORARY: редактор декора — включение по ?decorEdit=1 */
  const isDecorEdit = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('decorEdit') === '1',
    []
  );
  const [editingDecor, setEditingDecor] = useState<WhyMobileDecorItem[][]>(() => toDecorSlides(whyMobileDecorFromFigma));
  const [editorSlideIndex, setEditorSlideIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 375
  );
  const posterSliderRef = useRef<HTMLDivElement>(null);
  const posterRafRef = useRef<number | null>(null);
  const posterStepRef = useRef(0);
  const posterOffsetRef = useRef(0);
  const posterSnapTimeoutRef = useRef<number | null>(null);
  const promoVideoRef = useRef<HTMLVideoElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const [posters, setPosters] = useState<Poster[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [activePosterIndex, setActivePosterIndex] = useState(0);
  const [isPromoPlaying, setIsPromoPlaying] = useState(false);
  const [isLivePlaying, setIsLivePlaying] = useState(false);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const updateSlideStep = useCallback(() => {
    const slider = sliderRef.current;
    if (!slider) {
      return;
    }

    const slide = slider.querySelector<HTMLElement>('.why-slide');
    if (!slide) {
      return;
    }

    const styles = window.getComputedStyle(slider);
    const gapValue = styles.columnGap || styles.gap || '0';
    const gap = Number.parseFloat(gapValue) || 0;

    stepRef.current = slide.getBoundingClientRect().width + gap;
    const sliderRect = slider.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    offsetRef.current = slideRect.left - sliderRect.left + slider.scrollLeft;
  }, []);

  const updateActiveWhyIndex = useCallback(() => {
    const slider = sliderRef.current;
    const step = stepRef.current;
    const offset = offsetRef.current;

    if (!slider || !step) {
      return;
    }

    const nextIndex = Math.round((slider.scrollLeft - offset) / step);
    const clampedIndex = Math.min(Math.max(nextIndex, 0), whyMobileSlides.length - 1);

    setActiveWhyIndex(clampedIndex);
  }, []);

  const updateDesktopSlideStep = useCallback(() => {
    const slider = desktopSliderRef.current;
    if (!slider) {
      return;
    }

    const slide = slider.querySelector<HTMLElement>('.why-desktop-panel');
    if (!slide) {
      return;
    }

    const styles = window.getComputedStyle(slider);
    const gapValue = styles.columnGap || styles.gap || '0';
    const gap = Number.parseFloat(gapValue) || 0;

    desktopStepRef.current = slide.getBoundingClientRect().width + gap;
    const sliderRect = slider.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    desktopOffsetRef.current = slideRect.left - sliderRect.left + slider.scrollLeft;
  }, []);

  const updateActiveWhyDesktopIndex = useCallback(() => {
    const slider = desktopSliderRef.current;
    const step = desktopStepRef.current;
    const offset = desktopOffsetRef.current;

    if (!slider || !step) {
      return;
    }

    const nextIndex = Math.round((slider.scrollLeft - offset) / step);
    const clampedIndex = Math.min(Math.max(nextIndex, 0), whyDesktopSlides.length - 1);

    setActiveWhyDesktopIndex(clampedIndex);
  }, []);

  const updatePosterStep = useCallback(() => {
    const slider = posterSliderRef.current;
    if (!slider) {
      return;
    }
    const slide = slider.querySelector<HTMLElement>('.poster-slide');
    if (!slide) {
      return;
    }
    const styles = window.getComputedStyle(slider);
    const gapValue = styles.columnGap || styles.gap || '0';
    const gap = Number.parseFloat(gapValue) || 0;
    posterStepRef.current = slide.getBoundingClientRect().width + gap;
    const sliderRect = slider.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    posterOffsetRef.current = slideRect.left - sliderRect.left + slider.scrollLeft;
  }, []);

  const updateActivePosterIndex = useCallback(() => {
    const slider = posterSliderRef.current;
    const step = posterStepRef.current;
    const offset = posterOffsetRef.current;
    if (!slider || !step) {
      return;
    }
    const nextIndex = Math.round((slider.scrollLeft - offset) / step);
    const clampedIndex = Math.min(Math.max(nextIndex, 0), posters.length - 1);
    setActivePosterIndex(clampedIndex);
  }, [posters.length]);

  const handlePosterScroll = useCallback(() => {
    if (posterRafRef.current !== null) {
      return;
    }
    posterRafRef.current = window.requestAnimationFrame(() => {
      posterRafRef.current = null;
      updateActivePosterIndex();
    });
    if (posterSnapTimeoutRef.current !== null) {
      window.clearTimeout(posterSnapTimeoutRef.current);
    }
    posterSnapTimeoutRef.current = window.setTimeout(() => {
      const slider = posterSliderRef.current;
      const step = posterStepRef.current;
      const offset = posterOffsetRef.current;
      if (!slider || !step) {
        return;
      }
      const targetIndex = Math.round((slider.scrollLeft - offset) / step);
      const clampedIndex = Math.min(Math.max(targetIndex, 0), posters.length - 1);
      slider.scrollTo({ left: offset + step * clampedIndex, behavior: 'smooth' });
    }, 140);
  }, [posters.length, updateActivePosterIndex]);

  const handlePosterDotClick = useCallback((index: number) => {
    const slider = posterSliderRef.current;
    const step = posterStepRef.current;
    const offset = posterOffsetRef.current;
    if (!slider || !step) {
      return;
    }
    slider.scrollTo({ left: offset + step * index, behavior: 'smooth' });
  }, []);

  const handlePromoToggle = useCallback(() => {
    const video = promoVideoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, []);

  const handleLiveToggle = useCallback(() => {
    const video = liveVideoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, []);

  const handleWhyScroll = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      updateActiveWhyIndex();
    });

    if (snapTimeoutRef.current !== null) {
      window.clearTimeout(snapTimeoutRef.current);
    }
    snapTimeoutRef.current = window.setTimeout(() => {
      const slider = sliderRef.current;
      const step = stepRef.current;
      const offset = offsetRef.current;
      if (!slider || !step) {
        return;
      }
      const targetIndex = Math.round((slider.scrollLeft - offset) / step);
      const clampedIndex = Math.min(Math.max(targetIndex, 0), whyMobileSlides.length - 1);
      slider.scrollTo({ left: offset + step * clampedIndex, behavior: 'smooth' });
    }, 140);
  }, [updateActiveWhyIndex]);

  const handleWhyDesktopScroll = useCallback(() => {
    if (desktopRafRef.current !== null) {
      return;
    }

    desktopRafRef.current = window.requestAnimationFrame(() => {
      desktopRafRef.current = null;
      updateActiveWhyDesktopIndex();
    });

    if (desktopSnapTimeoutRef.current !== null) {
      window.clearTimeout(desktopSnapTimeoutRef.current);
    }
    desktopSnapTimeoutRef.current = window.setTimeout(() => {
      const slider = desktopSliderRef.current;
      const step = desktopStepRef.current;
      const offset = desktopOffsetRef.current;
      if (!slider || !step) {
        return;
      }
      const targetIndex = Math.round((slider.scrollLeft - offset) / step);
      const clampedIndex = Math.min(Math.max(targetIndex, 0), whyDesktopSlides.length - 1);
      slider.scrollTo({ left: offset + step * clampedIndex, behavior: 'smooth' });
    }, 140);
  }, [updateActiveWhyDesktopIndex]);

  const handleWhyDotClick = useCallback(
    (index: number) => {
      const slider = sliderRef.current;
      const step = stepRef.current;
      const offset = offsetRef.current;

      if (!slider || !step) {
        return;
      }

      slider.scrollTo({ left: offset + step * index, behavior: 'smooth' });
    },
    []
  );

  const handleWhyDesktopDotClick = useCallback((index: number) => {
    const slider = desktopSliderRef.current;
    const step = desktopStepRef.current;
    const offset = desktopOffsetRef.current;

    if (!slider || !step) {
      return;
    }

    slider.scrollTo({ left: offset + step * index, behavior: 'smooth' });
  }, []);

  const handleWhyPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const slider = sliderRef.current;
      if (!slider) {
        return;
      }
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      slider.setPointerCapture?.(event.pointerId);
      swipeStateRef.current = {
        startX: event.clientX,
        startIndex: activeWhyIndex,
        active: true,
      };
    },
    [activeWhyIndex]
  );

  const handleWhyPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const slider = sliderRef.current;
      const step = stepRef.current;
    const offset = offsetRef.current;
      if (!slider || !step || !swipeStateRef.current.active) {
        return;
      }
      slider.releasePointerCapture?.(event.pointerId);
      swipeStateRef.current.active = false;
      const delta = event.clientX - swipeStateRef.current.startX;
      const threshold = 40;
      let nextIndex = swipeStateRef.current.startIndex;
      if (Math.abs(delta) >= threshold) {
        nextIndex = Math.min(
          Math.max(swipeStateRef.current.startIndex + (delta < 0 ? 1 : -1), 0),
          whyMobileSlides.length - 1
        );
      }
    slider.scrollTo({ left: offset + step * nextIndex, behavior: 'smooth' });
    },
    []
  );

  const handleWhyDesktopPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const slider = desktopSliderRef.current;
      if (!slider) {
        return;
      }
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      slider.setPointerCapture?.(event.pointerId);
      desktopSwipeStateRef.current = {
        startX: event.clientX,
        startIndex: activeWhyDesktopIndex,
        active: true,
      };
    },
    [activeWhyDesktopIndex]
  );

  const handleWhyDesktopPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const slider = desktopSliderRef.current;
    const step = desktopStepRef.current;
    const offset = desktopOffsetRef.current;
    if (!slider || !step || !desktopSwipeStateRef.current.active) {
      return;
    }
    slider.releasePointerCapture?.(event.pointerId);
    desktopSwipeStateRef.current.active = false;
    const delta = event.clientX - desktopSwipeStateRef.current.startX;
    const threshold = 40;
    let nextIndex = desktopSwipeStateRef.current.startIndex;
    if (Math.abs(delta) >= threshold) {
      nextIndex = Math.min(
        Math.max(desktopSwipeStateRef.current.startIndex + (delta < 0 ? 1 : -1), 0),
        whyDesktopSlides.length - 1
      );
    }
    slider.scrollTo({ left: offset + step * nextIndex, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      try {
        const [postersData, partnersData] = await Promise.all([
          getPosters(),
          getPartners(),
        ]);

        if (!controller.signal.aborted) {
          if (postersData.length > 0) {
            setPosters(postersData);
            setActivePosterIndex(0);
          }
          setPartners(partnersData);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to load data:', error);
        }
      }
    };

    loadData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    updateSlideStep();
    updateActiveWhyIndex();
    updateDesktopSlideStep();
    updateActiveWhyDesktopIndex();
    updatePosterStep();
    updateActivePosterIndex();

    const handleResize = () => {
      updateSlideStep();
      updateActiveWhyIndex();
      updateDesktopSlideStep();
      updateActiveWhyDesktopIndex();
      updatePosterStep();
      updateActivePosterIndex();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      if (snapTimeoutRef.current !== null) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      if (desktopRafRef.current !== null) {
        window.cancelAnimationFrame(desktopRafRef.current);
      }
      if (desktopSnapTimeoutRef.current !== null) {
        window.clearTimeout(desktopSnapTimeoutRef.current);
      }
      if (posterRafRef.current !== null) {
        window.cancelAnimationFrame(posterRafRef.current);
      }
      if (posterSnapTimeoutRef.current !== null) {
        window.clearTimeout(posterSnapTimeoutRef.current);
      }
    };
  }, [
    updateActivePosterIndex,
    updateActiveWhyDesktopIndex,
    updateActiveWhyIndex,
    updateDesktopSlideStep,
    updatePosterStep,
    updateSlideStep,
  ]);

  return (
    <main className="screen screen--home">
      <header className="hero" id="home">
        <div className="hero-media">
          <div className="hero-photo-frame">
            <img alt="Группа" className="hero-photo" src={heroImage} />
          </div>
          <div aria-hidden="true" className="hero-blur" />
          <img alt="" className="hero-vector-group" src={heroVectorGroup} />
          <img alt="ВГУП" className="hero-logo-type" src={heroLogo} />
          <img alt="" className="hero-cover-band" src={heroCoverBand} />
          <button className="hero-menu" onClick={onMenuOpen} type="button">
            <span className="hero-menu-label">меню</span>
            <span aria-hidden="true" className="hero-menu-icon">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
        <div className="hero-copy">
          <p className="hero-headline">
            <strong>Обязательный элемент</strong> любого
            <br />
            мероприятия и причина
            <br />
            <strong>незабываемых эмоций</strong> публики
          </p>
          <p className="hero-subline">cover-группа</p>
          <p className="hero-title">“В ГОСТЯХ У ЛЕМЕНТАЛИЯ”</p>
        </div>
        <button className="btn btn-primary" type="button">
          Оставить заявку
        </button>
      </header>

      <section className="section posters-promo">
        <div className="section posters">
          <h2 className="section-title">Афиша</h2>
          <div className="poster-slider" onScroll={handlePosterScroll} ref={posterSliderRef}>
            {posters.map((poster, index) => {
              const imageSource = poster.imageUrl || posterImage;
              return (
                <article className="card poster-card poster-slide" key={poster.id}>
                  <div className="card-media">
                    <img
                      alt={poster.title}
                      className="card-image"
                      decoding="async"
                      loading={index === 0 ? 'eager' : 'lazy'}
                      src={imageSource}
                    />
                  </div>
                  <div className="card-body glass">
                    <h3 className="card-title">{poster.title}</h3>
                    {poster.description && <p className="card-text">{poster.description}</p>}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="dots">
            {posters.map((poster, index) => (
              <button
                aria-label={`Афиша ${index + 1}`}
                aria-selected={activePosterIndex === index}
                className={`dot${activePosterIndex === index ? ' dot--active' : ''}`}
                key={poster.id}
                onClick={() => handlePosterDotClick(index)}
                role="tab"
                type="button"
              />
            ))}
          </div>
        </div>

        <div className="section promo">
          <h2 className="section-title">Промо</h2>
          <article className={`card video-card ${isPromoPlaying ? 'is-playing' : ''}`}>
            <div className="card-media video-player">
              <video
                className="video-element"
                onPause={() => setIsPromoPlaying(false)}
                onPlay={() => setIsPromoPlaying(true)}
                playsInline
                poster={promoImage}
                preload="metadata"
                ref={promoVideoRef}
              >
                <source src={promoVideoUrl} type="video/mp4" />
              </video>
              <button className="video-play-button" onClick={handlePromoToggle} type="button">
                <img alt="Play" src={promoPlay} />
              </button>
            </div>
            <div className="card-body glass">
              <p className="card-title">Название промо ролика</p>
            </div>
          </article>
          <div className="dots">
            <span className="dot dot--active"></span>
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>
      </section>

      <section className="section why">
        <div className="why-surface">
          <div className="why-mobile">
            <h2 className="section-title">
              Почему мы?
              <span className="why-question-mark">?</span>
            </h2>
            {/* TEMPORARY: при ?decorEdit=1 показываем редактор декора вместо слайдера */}
            {isDecorEdit ? (
              <WhyDecorEditor
                decor={editingDecor}
                onDecorChange={setEditingDecor}
                frame={FIGMA_MOBILE_WHY_FRAME}
                slides={whyMobileSlides.map((s) => ({ id: s.id, alt: s.alt, text: s.text }))}
                activeSlideIndex={editorSlideIndex}
                onActiveSlideIndexChange={setEditorSlideIndex}
                assets={{
                  ellipse: imgWhyCircle,
                  vectorTop: imgWhyVectorTop,
                  vectorBottom: imgWhyVectorBottom,
                  vectorWide: imgWhyVectorWide,
                  ellipseLeft: imgEllipse242,
                  ellipseRight: imgEllipse241,
                }}
              />
            ) : (
            <>
            <div
              className="why-slider"
              onPointerDown={handleWhyPointerDown}
              onPointerUp={handleWhyPointerUp}
              onPointerCancel={handleWhyPointerUp}
              onScroll={handleWhyScroll}
              ref={sliderRef}
            >
              {whyMobileSlides.map((slide, index) => {
                const decorRaw = whyMobileDecorFromFigma[index] ?? whyMobileDecorFromFigma[0];
                const items = normalizeDecorSlide(decorRaw);
                const { width: fw, height: fh } = FIGMA_MOBILE_WHY_FRAME;
                const scale = Math.min(1, viewportWidth / fw);
                const scalePx = (px: number): string => `${Math.round(px * scale)}px`;
                const buildTransform = (item: FigmaRect | FigmaEllipsePos) => {
                  const parts: string[] = [];
                  if (item.flipHorizontal) parts.push('scaleX(-1)');
                  if (item.flipVertical) parts.push('scaleY(-1)');
                  if (item.rotate != null && item.rotate !== 0) parts.push(`rotate(${item.rotate}deg)`);
                  return parts.length > 0 ? parts.join(' ') : undefined;
                };
                const figmaToStyle = (r: FigmaRect) => ({
                  left: `${(r.x / fw) * 100}%`,
                  top: `${(r.y / fh) * 100}%`,
                  width: scalePx(r.w),
                  height: scalePx(r.h),
                  opacity: r.opacity ?? 1,
                  transform: buildTransform(r),
                });
                const figmaEllipseToStyle = (p: FigmaEllipsePos) => ({
                  left: `${(p.x / fw) * 100}%`,
                  top: `${(p.y / fh) * 100}%`,
                  opacity: p.opacity ?? 1,
                  transform: buildTransform(p),
                });
                const decorAssets: Record<WhyMobileDecorItem['type'], string> = {
                  ellipse: imgWhyCircle,
                  vectorTop: imgWhyVectorTop,
                  vectorBottom: imgWhyVectorBottom,
                  vectorWide: imgWhyVectorWide,
                  ellipseLeft: imgEllipse242,
                  ellipseRight: imgEllipse241,
                };
                return (
                  <article
                    className={`why-slide${activeWhyIndex === index ? ' is-active' : ''}`}
                    data-slide-id={slide.id}
                    key={slide.id}
                  >
                    <div className="why-mobile-decor" aria-hidden="true">
                      {items.map((item) => {
                        const isEllipse = item.type === 'ellipseLeft' || item.type === 'ellipseRight';
                        const style = isEllipse ? figmaEllipseToStyle(item) : figmaToStyle(item as FigmaRect);
                        const wrapperClass =
                          item.type === 'ellipse'
                            ? 'why-mobile-shape-wrapper why-mobile-shape--ellipse'
                            : item.type === 'vectorTop'
                              ? 'why-mobile-shape-wrapper why-mobile-shape--vector-top'
                              : item.type === 'vectorBottom'
                                ? 'why-mobile-shape-wrapper why-mobile-shape--vector-bottom'
                                : item.type === 'vectorWide'
                                  ? 'why-mobile-shape-wrapper why-mobile-shape--vector-wide'
                                  : item.type === 'ellipseLeft'
                                    ? 'why-mobile-ellipse why-mobile-ellipse--left'
                                    : 'why-mobile-ellipse why-mobile-ellipse--right';
                        const img = (
                          <img
                            alt=""
                            className={isEllipse ? 'why-mobile-ellipse-image' : undefined}
                            src={decorAssets[item.type]}
                          />
                        );
                        return (
                          <div key={item.id} className={wrapperClass} style={style}>
                            {isEllipse ? <div className="why-mobile-shape-wrapper">{img}</div> : img}
                          </div>
                        );
                      })}
                    </div>
                    <div className="why-mobile-content">
                      <img alt={slide.alt} className="why-image" loading="lazy" src={slide.image} />
                      <p className="why-text">{slide.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="dots why-dots" role="tablist">
              {whyMobileSlides.map((slide, index) => (
                <button
                  aria-label={`Слайд ${index + 1}`}
                  aria-selected={activeWhyIndex === index}
                  className={`dot${activeWhyIndex === index ? ' dot--active' : ''}`}
                  key={slide.id}
                  onClick={() => handleWhyDotClick(index)}
                  role="tab"
                  type="button"
                />
              ))}
            </div>
            </>
            )}
          </div>
          <div className="why-desktop">
            <div className="why-desktop-shell">
              <div
                className="why-desktop-slider"
                onPointerDown={handleWhyDesktopPointerDown}
                onPointerUp={handleWhyDesktopPointerUp}
                onPointerCancel={handleWhyDesktopPointerUp}
                onScroll={handleWhyDesktopScroll}
                ref={desktopSliderRef}
              >
              <article className={`why-desktop-panel${activeWhyDesktopIndex === 0 ? ' is-active' : ''}`}>
                <div aria-hidden className="why-desktop-shape why-desktop-shape--circle" style={{ left: '186px', top: '456px' }} />
                <img
                  alt=""
                  className="why-desktop-shape"
                  src={imgWhyVectorTop}
                  style={{ left: '348px', top: '48px', width: '156px', height: '126px' }}
                />
                <img
                  alt=""
                  className="why-desktop-shape"
                  src={imgWhyVectorBottom}
                  style={{ left: '348px', top: '178px', width: '156px', height: '126px' }}
                />
                <img
                  alt=""
                  className="why-desktop-shape"
                  src={imgWhyVectorWide}
                  style={{ left: '732px', top: '269px', width: '333px', height: '237px' }}
                />
                <div className="why-desktop-ellipse" style={{ left: '1125px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse242} />
                </div>
                <div className="why-desktop-ellipse" style={{ left: '1205px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse241} />
                </div>
                <div
                  className="why-desktop-content"
                  style={{ '--why-offset': '21.5px' } as React.CSSProperties}
                >
                  <div className="why-desktop-column why-desktop-column--award">
                    <div className="why-desktop-media" style={{ width: '164px', height: '225px' }}>
                      <img alt="Диплом премии «Призвание Арист»" loading="lazy" src={imgAward2024} />
                    </div>
                    <p className="why-desktop-text-block why-desktop-text--regular">
                      призеры премии:
                      <br />
                      “ПРИЗВАНИЕ АРИСТ 2024”
                    </p>
                  </div>
                  <div className="why-desktop-column" style={{ width: '322px' }}>
                    <div className="why-desktop-media why-desktop-media--wide">
                      <img alt="Выступление" loading="lazy" src={imgLiveSound} />
                    </div>
                    <p className="why-desktop-text-block why-desktop-text--semibold">
                      Живой звук, профессиональный состав, опыт выступлений на топовых площадках;
                    </p>
                  </div>
                  <div className="why-desktop-column" style={{ width: '323px' }}>
                    <div className="why-desktop-media why-desktop-media--wide">
                      <img alt="Сцена" loading="lazy" src={imgFlexibleTerms} />
                    </div>
                    <p className="why-desktop-text-block why-desktop-text--bold">Гибкие условия сотрудничества;</p>
                  </div>
                </div>
              </article>
              <article className={`why-desktop-panel${activeWhyDesktopIndex === 1 ? ' is-active' : ''}`}>
                <div aria-hidden className="why-desktop-shape why-desktop-shape--circle" style={{ left: '186px', top: '456px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorTop} style={{ left: '348px', top: '48px', width: '156px', height: '126px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorBottom} style={{ left: '348px', top: '178px', width: '156px', height: '126px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorWide} style={{ left: '732px', top: '269px', width: '333px', height: '237px' }} />
                <div className="why-desktop-ellipse" style={{ left: '1125px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse242} />
                </div>
                <div className="why-desktop-ellipse" style={{ left: '1205px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse241} />
                </div>
                <div
                  className="why-desktop-content"
                  style={{ '--why-offset': '29.5px' } as React.CSSProperties}
                >
                    <div className="why-desktop-column" style={{ width: '319px' }}>
                      <div className="why-desktop-media why-desktop-media--wide">
                        <img alt="Сцена" loading="lazy" src={imgSecondPanelLeft} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--bold">
                        Подстроимся под ваши задачи и формат;
                      </p>
                    </div>
                    <div className="why-desktop-column" style={{ width: '321px' }}>
                      <div className="why-desktop-media why-desktop-media--wide">
                        <img alt="Музыкант" loading="lazy" src={imgSecondPanelCenter} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--semibold">
                        Репертуар песен, которого нет у других;
                      </p>
                    </div>
                    <div className="why-desktop-column" style={{ width: '319px' }}>
                      <div className="why-desktop-media why-desktop-media--wide">
                        <img alt="Событие" loading="lazy" src={imgSecondPanelRight} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--bold">
                        Подбираем репертуар под формат события;
                      </p>
                    </div>
                  </div>
              </article>
              <article className={`why-desktop-panel${activeWhyDesktopIndex === 2 ? ' is-active' : ''}`}>
                <div aria-hidden className="why-desktop-shape why-desktop-shape--circle" style={{ left: '186px', top: '456px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorTop} style={{ left: '348px', top: '48px', width: '156px', height: '126px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorBottom} style={{ left: '348px', top: '178px', width: '156px', height: '126px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorWide} style={{ left: '732px', top: '269px', width: '333px', height: '237px' }} />
                <div className="why-desktop-ellipse" style={{ left: '1125px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse242} />
                </div>
                <div className="why-desktop-ellipse" style={{ left: '1205px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse241} />
                </div>
                <div
                  className="why-desktop-content"
                  style={{ '--why-offset': '35px' } as React.CSSProperties}
                >
                    <div className="why-desktop-column" style={{ width: '324px' }}>
                      <div className="why-desktop-media why-desktop-media--wide">
                        <img alt="Выступление" loading="lazy" src={imgThirdPanelLeft} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--semibold">
                        Работаем с интерактивом - вовлекаем гостей в шоу;
                      </p>
                    </div>
                    <div className="why-desktop-column" style={{ width: '329px' }}>
                      <div className="why-desktop-media why-desktop-media--wide">
                        <img alt="Сцена" loading="lazy" src={imgThirdPanelCenter} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--semibold">
                        Создаем сценарий выступления;
                      </p>
                    </div>
                    <div className="why-desktop-column why-desktop-column--narrow">
                      <div className="why-desktop-media" style={{ width: '175px', height: '234px' }}>
                        <img alt="Группа" loading="lazy" src={imgThirdPanelRight} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--bold">
                        Мы показываем уровень, индевидуальность и неповторимость
                      </p>
                    </div>
                  </div>
              </article>
            </div>
            </div>
            <div className="dots why-dots why-dots--desktop" role="tablist">
              {whyDesktopSlides.map((slide, index) => (
                <button
                  aria-label={`Слайд ${index + 1}`}
                  aria-selected={activeWhyDesktopIndex === index}
                  className={`dot${activeWhyDesktopIndex === index ? ' dot--active' : ''}`}
                  key={slide}
                  onClick={() => handleWhyDesktopDotClick(index)}
                  role="tab"
                  type="button"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section formats" id="formats">
        <h2 className="section-title">Форматы</h2>
        <article className="card format-card">
          <div className="card-media">
            <img alt="Форматы" className="card-image" src={formatImage} />
          </div>
          <div className="card-body glass">
            <p className="format-item">
              <strong>MAIN SHOW</strong> — основной формат «В гостях у Лементалия»
            </p>
            <p className="format-item">
              <strong>Дуэт</strong> вокал + гитара и беквокал
            </p>
            <p className="format-item">
              <strong>«Welcome»</strong> Как полным составом так и дуэтом
            </p>
            <p className="format-item">
              <strong>«Welcome 2.0»</strong> Пример текста для описания
            </p>
            <p className="format-item">
              <strong>Виолончель</strong> Пример текста для описания
            </p>
          </div>
        </article>
        <button
          className="btn btn-primary"
          onClick={() => {
            window.history.pushState({}, '', '?screen=formats');
            window.dispatchEvent(new Event('pushstate'));
          }}
          type="button"
        >
          Подробнее
        </button>
      </section>

      <section className="section live" id="live">
        <h2 className="section-title">Live-видео</h2>
        <div className={`live-card glass ${isLivePlaying ? 'is-playing' : ''}`}>
          <div className="live-player">
            <video
              className="live-video"
              loop
              muted
              onPause={() => setIsLivePlaying(false)}
              onPlay={() => setIsLivePlaying(true)}
              playsInline
              poster={liveImage}
              preload="metadata"
              ref={liveVideoRef}
            >
              <source src={liveVideoUrl} type="video/mp4" />
            </video>
            <button className="video-play-button" onClick={handleLiveToggle} type="button">
              <img alt="Play" src={livePlay} />
            </button>
          </div>
        </div>
        <button className="btn btn-primary live-btn" type="button">
          Оставить заявку
        </button>
      </section>

      <section className="section residents">
        <div className="residents-container">
          <img alt="Резиденты" className="residents-image" src={residentsImage} />
          <h3 className="residents-subtitle">Резиденты</h3>
        </div>
        <button className="btn btn-primary residents-btn" type="button">
          Познакомиться
        </button>
      </section>

      <section className="section socials" id="socials">
        <h2 className="section-title">Наши соц. сети</h2>
        <div className="tile-grid">
          <div className="tile"></div>
          <div className="tile"></div>
          <div className="tile"></div>
        </div>
      </section>

      <section className="section partners" id="partners">
        <h2 className="section-title">Наши партнеры</h2>
        <div className="tile-grid tile-grid--multi">
          <div className="tile"></div>
          <div className="tile"></div>
          <div className="tile"></div>
          <div className="tile"></div>
          <div className="tile"></div>
          <div className="tile"></div>
          <div className="tile"></div>
          <div className="tile"></div>
          <div className="tile"></div>
        </div>
      </section>

      <section className="section footer-date">
        <div className="date-card">
          <div aria-hidden="true" className="date-wave-wrap">
            <img alt="" className="date-wave" src={dateWave} />
          </div>
          <h1 className="date-title">
            Выбери дату <br />
            своего события
          </h1>
          <button className="btn btn-primary date-btn" type="button">
            Оставить заявку
          </button>
          <p className="date-note">Не для всех. Для своих</p>
        </div>
      </section>
    </main>
  );
}
