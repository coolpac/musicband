import { useCallback, useEffect, useRef, useState } from 'react';
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

const promoVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';
const liveVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

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

const whyMobileDecorPositions = [
  // Slide 0: award-2025 (Figma 100:1769) - "как надо"
  {
    ellipse: { left: '75%', top: '12%', width: '50px', height: '50px', opacity: 1 },
    vectorTop: { left: '5%', top: '5%', width: '120px', height: '100px', opacity: 0 },
    vectorBottom: { left: '5%', top: '5%', width: '120px', height: '100px', opacity: 0 },
    vectorWide: { left: '45%', top: '35%', width: '300px', height: '240px', opacity: 1 },
    ellipseLeft: { left: '-8%', top: '78%', width: '68px', height: '140px', opacity: 1 },
    ellipseRight: { left: '85%', top: '45%', opacity: 0 },
  },
  // Slide 1: award-2024 (Figma 100:1773)
  {
    ellipse: { left: '75%', top: '80%', width: '70px', height: '70px', opacity: 0.9 },
    vectorTop: { left: '5%', top: '10%', width: '100px', height: '80px', opacity: 0 },
    vectorBottom: { left: '10%', top: '20%', width: '100px', height: '80px', opacity: 0 },
    vectorWide: { left: '25%', top: '10%', width: '300px', height: '220px', opacity: 1 },
    ellipseLeft: { left: '5%', top: '45%', opacity: 1 },
    ellipseRight: { left: '20%', top: '47%', opacity: 1 },
  },
  // Slide 2: live-sound (Figma 100:1775)
  {
    ellipse: { left: '45%', top: '5%', width: '50px', height: '50px', opacity: 1 },
    vectorTop: { left: '-10%', top: '35%', width: '140px', height: '110px', opacity: 1 },
    vectorBottom: { left: '-5%', top: '55%', width: '140px', height: '110px', opacity: 1 },
    vectorWide: { left: '55%', top: '75%', width: '200px', height: '150px', opacity: 0.6 },
    ellipseLeft: { left: '75%', top: '25%', opacity: 0 },
    ellipseRight: { left: '85%', top: '30%', opacity: 0 },
  },
  // Slide 3: flexible-terms (Figma 100:1777)
  {
    ellipse: { left: '85%', top: '25%', width: '65px', height: '65px', opacity: 1 },
    vectorTop: { left: '15%', top: '85%', width: '110px', height: '90px', opacity: 0.7 },
    vectorBottom: { left: '25%', top: '75%', width: '110px', height: '90px', opacity: 0 },
    vectorWide: { left: '-25%', top: '15%', width: '280px', height: '200px', opacity: 0.4 },
    ellipseLeft: { left: '45%', top: '55%', opacity: 1 },
    ellipseRight: { left: '60%', top: '57%', opacity: 1 },
  },
  // Slide 4: custom-format (Figma 100:1786)
  {
    ellipse: { left: '8%', top: '65%', width: '55px', height: '55px', opacity: 0.8 },
    vectorTop: { left: '55%', top: '15%', width: '130px', height: '105px', opacity: 1 },
    vectorBottom: { left: '50%', top: '30%', width: '130px', height: '105px', opacity: 1 },
    vectorWide: { left: '35%', top: '85%', width: '220px', height: '160px', opacity: 0.9 },
    ellipseLeft: { left: '8%', top: '20%', opacity: 0.6 },
    ellipseRight: { left: '18%', top: '23%', opacity: 0.6 },
  },
  // Slide 5: unique-repertoire (Figma 100:1778)
  {
    ellipse: { left: '65%', top: '45%', width: '75px', height: '75px', opacity: 1 },
    vectorTop: { left: '15%', top: '10%', width: '115px', height: '95px', opacity: 0.5 },
    vectorBottom: { left: '20%', top: '20%', width: '115px', height: '95px', opacity: 0 },
    vectorWide: { left: '55%', top: '10%', width: '260px', height: '190px', opacity: 1 },
    ellipseLeft: { left: '85%', top: '85%', opacity: 1 },
    ellipseRight: { left: '95%', top: '87%', opacity: 1 },
  },
  // Slide 6: format-repertoire
  {
    ellipse: { left: '35%', top: '90%', width: '60px', height: '60px', opacity: 1 },
    vectorTop: { left: '75%', top: '35%', width: '125px', height: '100px', opacity: 1 },
    vectorBottom: { left: '70%', top: '55%', width: '125px', height: '100px', opacity: 1 },
    vectorWide: { left: '-20%', top: '25%', width: '240px', height: '170px', opacity: 0.3 },
    ellipseLeft: { left: '15%', top: '15%', opacity: 0.8 },
    ellipseRight: { left: '25%', top: '20%', opacity: 0 },
  },
  // Slide 7: interactive
  {
    ellipse: { left: '55%', top: '55%', width: '80px', height: '80px', opacity: 0.2 },
    vectorTop: { left: '8%', top: '8%', width: '100px', height: '80px', opacity: 1 },
    vectorBottom: { left: '85%', top: '85%', width: '100px', height: '80px', opacity: 1 },
    vectorWide: { left: '30%', top: '30%', width: '200px', height: '150px', opacity: 1 },
    ellipseLeft: { left: '8%', top: '85%', opacity: 1 },
    ellipseRight: { left: '85%', top: '8%', opacity: 1 },
  },
  // Slide 8: scenario
  {
    ellipse: { left: '20%', top: '15%', width: '50px', height: '50px', opacity: 1 },
    vectorTop: { left: '65%', top: '75%', width: '140px', height: '110px', opacity: 1 },
    vectorBottom: { left: '15%', top: '45%', width: '140px', height: '110px', opacity: 0.4 },
    vectorWide: { left: '45%', top: '45%', width: '300px', height: '220px', opacity: 0.7 },
    ellipseLeft: { left: '90%', top: '20%', opacity: 1 },
    ellipseRight: { left: '80%', top: '25%', opacity: 1 },
  },
  // Slide 9: uniqueness
  {
    ellipse: { left: '85%', top: '85%', width: '60px', height: '60px', opacity: 1 },
    vectorTop: { left: '25%', top: '25%', width: '120px', height: '100px', opacity: 1 },
    vectorBottom: { left: '35%', top: '15%', width: '120px', height: '100px', opacity: 1 },
    vectorWide: { left: '-10%', top: '80%', width: '210px', height: '150px', opacity: 0.5 },
    ellipseLeft: { left: '55%', top: '10%', opacity: 1 },
    ellipseRight: { left: '65%', top: '13%', opacity: 1 },
  },
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
            <div
              className="why-slider"
              onPointerDown={handleWhyPointerDown}
              onPointerUp={handleWhyPointerUp}
              onPointerCancel={handleWhyPointerUp}
              onScroll={handleWhyScroll}
              ref={sliderRef}
            >
              {whyMobileSlides.map((slide, index) => {
                const decorPos = whyMobileDecorPositions[index] ?? whyMobileDecorPositions[0];
                return (
                  <article
                    className={`why-slide${activeWhyIndex === index ? ' is-active' : ''}`}
                    data-slide-id={slide.id}
                    key={slide.id}
                  >
                    <div className="why-mobile-decor" aria-hidden="true">
                      <div
                        className="why-mobile-shape-wrapper why-mobile-shape--ellipse"
                        style={{
                          left: decorPos.ellipse.left,
                          top: decorPos.ellipse.top,
                          width: decorPos.ellipse.width,
                          height: decorPos.ellipse.height,
                          opacity: decorPos.ellipse.opacity,
                        }}
                      >
                        <img alt="" src={imgEllipse240} />
                      </div>
                      <div
                        className="why-mobile-shape-wrapper why-mobile-shape--vector-top"
                        style={{
                          left: decorPos.vectorTop.left,
                          top: decorPos.vectorTop.top,
                          width: decorPos.vectorTop.width,
                          height: decorPos.vectorTop.height,
                          opacity: decorPos.vectorTop.opacity,
                        }}
                      >
                        <img alt="" src={imgWhyVectorTop} />
                      </div>
                      <div
                        className="why-mobile-shape-wrapper why-mobile-shape--vector-bottom"
                        style={{
                          left: decorPos.vectorBottom.left,
                          top: decorPos.vectorBottom.top,
                          width: decorPos.vectorBottom.width,
                          height: decorPos.vectorBottom.height,
                          opacity: decorPos.vectorBottom.opacity,
                        }}
                      >
                        <img alt="" src={imgWhyVectorBottom} />
                      </div>
                      <div
                        className="why-mobile-shape-wrapper why-mobile-shape--vector-wide"
                        style={{
                          left: decorPos.vectorWide.left,
                          top: decorPos.vectorWide.top,
                          width: decorPos.vectorWide.width,
                          height: decorPos.vectorWide.height,
                          opacity: decorPos.vectorWide.opacity,
                        }}
                      >
                        <img alt="" src={imgWhyVectorWide} />
                      </div>
                      <div
                        className="why-mobile-ellipse why-mobile-ellipse--left"
                        style={{
                          left: decorPos.ellipseLeft.left,
                          top: decorPos.ellipseLeft.top,
                          opacity: decorPos.ellipseLeft.opacity,
                        }}
                      >
                        <div className="why-mobile-shape-wrapper">
                          <img alt="" className="why-mobile-ellipse-image" src={imgEllipse242} />
                        </div>
                      </div>
                      <div
                        className="why-mobile-ellipse why-mobile-ellipse--right"
                        style={{
                          left: decorPos.ellipseRight.left,
                          top: decorPos.ellipseRight.top,
                          opacity: decorPos.ellipseRight.opacity,
                        }}
                      >
                        <div className="why-mobile-shape-wrapper">
                          <img alt="" className="why-mobile-ellipse-image" src={imgEllipse241} />
                        </div>
                      </div>
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
