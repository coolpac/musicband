import { useCallback, useEffect, useRef, useState } from 'react';
import { hapticImpact, hapticSelection, openTelegramLink, isInsideTelegram } from '../telegram/telegramWebApp';
import posterImage from '../assets/figma/poster.webp';
import promoPlay from '../assets/figma/play-promo.svg';
import formatImage from '../assets/figma/format.webp';
import livePlay from '../assets/figma/play-live.svg';
import residentsImage from '../assets/figma/residents.webp';
import dateWave from '../assets/figma/date-wave.svg';
import heroImageLocal from '../assets/figma/hero-image.webp';
import heroLogo from '../assets/figma/downloaded/hero-logo.svg';
import heroCoverBand from '../assets/figma/downloaded/hero-cover-band.svg';
import heroVectorGroup from '../assets/figma/downloaded/hero-vector-group.svg';
const heroImage = heroImageLocal;

import imgAward2024 from '../assets/figma/downloaded/award-2024.webp';
import imgLiveSound from '../assets/figma/downloaded/live-sound.webp';
import imgFlexibleTerms from '../assets/figma/downloaded/flexible-terms.webp';
import imgWhyVectorTop from '../assets/figma/downloaded/why-vector-top.svg';
import imgWhyVectorBottom from '../assets/figma/downloaded/why-vector-bottom.svg';
import imgWhyVectorWide from '../assets/figma/downloaded/why-vector-wide.svg';
import imgEllipse242 from '../assets/figma/downloaded/ellipse-242.svg';
import imgEllipse241 from '../assets/figma/downloaded/ellipse-241.svg';
import imgSecondPanelLeft from '../assets/figma/downloaded/second-panel-left.webp';
import imgSecondPanelCenter from '../assets/figma/downloaded/second-panel-center.webp';
import imgSecondPanelRight from '../assets/figma/downloaded/second-panel-right.webp';
import imgThirdPanelLeft from '../assets/figma/downloaded/third-panel-left.webp';
import imgThirdPanelCenter from '../assets/figma/downloaded/third-panel-center.webp';
import imgThirdPanelRight from '../assets/figma/downloaded/third-panel-right.webp';
import whyFirstSlideDecor from '../assets/figma/downloaded/why-first-slide-decor.svg?url';
import whyLenta from '../assets/figma/downloaded/why-lenta.svg';

import { getPosters, Poster } from '../services/posterService';
import { getPartners, Partner } from '../services/partnerService';
import { useSnapSlider } from '../hooks/useSnapSlider';
import { OptimizedImage } from '../components/OptimizedImage';
import { getOptimizedImageProps } from '../types/image';
import { liveVideos, promoVideos, whyDesktopSlides, whyMobileSlides } from '../data/homeData';


type HomeScreenProps = {
  onMenuOpen?: () => void;
  onGoToCalendar?: () => void;
  onGoToResidents?: () => void;
};

export default function HomeScreen({ onMenuOpen, onGoToCalendar, onGoToResidents }: HomeScreenProps) {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isPromoPlaying, setIsPromoPlaying] = useState(false);
  const [isLivePlaying, setIsLivePlaying] = useState(false);

  const whySlider = useSnapSlider({
    itemCount: whyMobileSlides.length,
    slideSelector: '.why-slide',
  });
  const whyDesktopSlider = useSnapSlider({
    itemCount: whyDesktopSlides.length,
    slideSelector: '.why-desktop-panel',
  });
  const posterSlider = useSnapSlider({
    itemCount: posters.length,
    slideSelector: '.poster-slide',
  });
  const promoSlider = useSnapSlider({
    itemCount: promoVideos.length,
    slideSelector: '.promo-slide',
  });
  const liveSlider = useSnapSlider({
    itemCount: liveVideos.length,
    slideSelector: '.live-slide',
  });

  const decorStripRef = useRef<HTMLDivElement>(null);
  const swipeStateRef = useRef({ startX: 0, startIndex: 0, active: false });
  const desktopSwipeStateRef = useRef({ startX: 0, startIndex: 0, active: false });
  const promoVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const liveVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const handleWhyScrollWithStrip = useCallback(() => {
    whySlider.handleScroll();
    const strip = decorStripRef.current;
    const slider = whySlider.sliderRef.current;
    if (strip && slider) {
      strip.style.transform = `translateX(-${slider.scrollLeft}px)`;
    }
  }, [whySlider]);

  const handleWhyPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const slider = whySlider.sliderRef.current;
      if (!slider) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      slider.setPointerCapture?.(event.pointerId);
      swipeStateRef.current = {
        startX: event.clientX,
        startIndex: whySlider.activeIndex,
        active: true,
      };
    },
    [whySlider.activeIndex]
  );

  const handleWhyPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const slider = whySlider.sliderRef.current;
      if (!slider || !swipeStateRef.current.active) return;
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
      whySlider.scrollToIndex(nextIndex);
    },
    [whySlider]
  );

  const handleWhyDesktopPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const slider = whyDesktopSlider.sliderRef.current;
      if (!slider) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      slider.setPointerCapture?.(event.pointerId);
      desktopSwipeStateRef.current = {
        startX: event.clientX,
        startIndex: whyDesktopSlider.activeIndex,
        active: true,
      };
    },
    [whyDesktopSlider.activeIndex]
  );

  const handleWhyDesktopPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const slider = whyDesktopSlider.sliderRef.current;
      if (!slider || !desktopSwipeStateRef.current.active) return;
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
      whyDesktopSlider.scrollToIndex(nextIndex);
    },
    [whyDesktopSlider]
  );

  const isRutubeUrl = (url: string) => /rutube\.ru/i.test(url);
  const getRutubeEmbedUrl = (url: string) => {
    if (/rutube\.ru\/play\/embed\//i.test(url)) return url;
    const match = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/i);
    if (match) return `https://rutube.ru/play/embed/${match[1]}`;
    return url;
  };

  const handlePromoToggle = useCallback(() => {
    hapticImpact('light');
    const item = promoVideos[promoSlider.activeIndex];
    if (!item || isRutubeUrl(item.src)) return;
    const video = promoVideoRefs.current[promoSlider.activeIndex];
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [promoSlider.activeIndex]);

  const handleLiveToggle = useCallback(() => {
    hapticImpact('light');
    const item = liveVideos[liveSlider.activeIndex];
    if (!item || isRutubeUrl(item.src)) return;
    const video = liveVideoRefs.current[liveSlider.activeIndex];
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [liveSlider.activeIndex]);

  const handleGoToCalendar = useCallback(() => {
    hapticImpact('light');
    onGoToCalendar?.();
  }, [onGoToCalendar]);

  const handleMenuOpen = useCallback(() => {
    hapticImpact('light');
    onMenuOpen?.();
  }, [onMenuOpen]);

  const handleFormatsNavigate = useCallback(() => {
    hapticImpact('light');
    window.history.pushState({}, '', '?screen=formats');
    window.dispatchEvent(new Event('pushstate'));
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
          setPosters(postersData);
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
    promoVideoRefs.current.forEach((video, index) => {
      if (video && index !== promoSlider.activeIndex) {
        video.pause();
      }
    });
    setIsPromoPlaying(false);
  }, [promoSlider.activeIndex]);

  useEffect(() => {
    liveVideoRefs.current.forEach((video, index) => {
      if (video && index !== liveSlider.activeIndex) {
        video.pause();
      }
    });
    setIsLivePlaying(false);
  }, [liveSlider.activeIndex]);

  return (
    <main className="screen screen--home">
      <header className="hero" id="home">
        <div className="hero-media">
          <div className="hero-photo-frame">
            <img alt="Группа" className="hero-photo" src={heroImage} width={1280} height={720} fetchPriority="high" loading="eager" />
          </div>
          {/* SVG blur вместо CSS — без banding на OLED */}
          <svg aria-hidden="true" className="hero-blur-svg" viewBox="0 0 509 172" preserveAspectRatio="none">
            <defs>
              <filter id="heroBlur" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="33.3" />
              </filter>
            </defs>
            <rect x="0" y="0" width="509" height="172" fill="#111111" filter="url(#heroBlur)" />
          </svg>
          <img alt="" className="hero-vector-group" src={heroVectorGroup} width={415} height={147} />
          <img alt="ВГУП" className="hero-logo-type" src={heroLogo} width={200} height={80} />
          <img alt="" className="hero-cover-band" src={heroCoverBand} width={411} height={200} />
          <button className="hero-menu" onClick={handleMenuOpen} type="button">
            <span className="hero-menu-label">меню</span>
            <span aria-hidden="true" className="hero-menu-icon">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
        <div className="hero-text-block">
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
          <button className="btn btn-primary" type="button" onClick={handleGoToCalendar}>
            Оставить заявку
          </button>
        </div>
      </header>

      <section className="section posters-promo">
        <div className="section posters">
          <h2 className="section-title">Афиша</h2>
          <div className="poster-slider" onScroll={posterSlider.handleScroll} ref={posterSlider.sliderRef}>
            {posters.map((poster, index) => {
              const imgProps = getOptimizedImageProps(poster.imageUrl) ?? { src: posterImage };
              return (
                <article className="card poster-card poster-slide" key={poster.id}>
                  <div className="card-media">
                    <OptimizedImage
                      {...imgProps}
                      alt={poster.title}
                      className="card-image"
                      loading="lazy"
                      sizes="(max-width: 440px) 100vw, 440px"
                      objectFit="cover"
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
                aria-selected={posterSlider.activeIndex === index}
                className={`dot${posterSlider.activeIndex === index ? ' dot--active' : ''}`}
                key={poster.id}
                onClick={() => { hapticSelection(); posterSlider.scrollToIndex(index); }}
                role="tab"
                type="button"
              />
            ))}
          </div>
        </div>

        <div className="section promo" id="promo">
          <h2 className="section-title">Промо</h2>
          <div
            className="promo-slider"
            onScroll={promoSlider.handleScroll}
            ref={promoSlider.sliderRef}
          >
            {promoVideos.map((item, index) => (
              <article
                key={item.id}
                className={`card video-card promo-slide ${promoSlider.activeIndex === index && isPromoPlaying ? 'is-playing' : ''}`}
              >
                <div className="card-media video-player">
                  {isRutubeUrl(item.src) ? (
                    promoSlider.activeIndex === index ? (
                      <iframe
                        className="video-embed"
                        src={getRutubeEmbedUrl(item.src)}
                        title={item.title || `Промо ${index + 1}`}
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                      />
                    ) : (
                      <>
                        <img
                          alt=""
                          className="video-element"
                          src={item.poster || posterImage}
                          loading="lazy"
                          decoding="async"
                        />
                        <button
                          className="video-play-button"
                          onClick={() => { hapticImpact('light'); promoSlider.scrollToIndex(index); }}
                          type="button"
                          aria-label={`Открыть промо ${index + 1}`}
                        >
                          <img alt="Play" src={promoPlay} width={48} height={48} loading="lazy" decoding="async" />
                        </button>
                      </>
                    )
                  ) : (
                    <>
                      <video
                        className="video-element"
                        onPause={() => setIsPromoPlaying(false)}
                        onPlay={() => setIsPromoPlaying(true)}
                        playsInline
                        poster={item.poster}
                        preload="none"
                        ref={(el) => {
                          promoVideoRefs.current[index] = el;
                        }}
                      >
                        <source src={item.src} type="video/mp4" />
                      </video>
                      <button
                        className="video-play-button"
                        onClick={handlePromoToggle}
                        type="button"
                      >
                        <img alt="Play" src={promoPlay} width={48} height={48} loading="lazy" decoding="async" />
                      </button>
                    </>
                  )}
                </div>
                <div className="card-body glass">
                  <p className="card-title">{item.title || '\u00A0'}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="dots">
            {promoVideos.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-label={`Промо ${index + 1}`}
                aria-selected={promoSlider.activeIndex === index}
                className={`dot${promoSlider.activeIndex === index ? ' dot--active' : ''}`}
                onClick={() => { hapticSelection(); promoSlider.scrollToIndex(index); }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section why">
        <div className="why-surface">
          <div className="why-mobile">
            {/* Оба слоя всегда в DOM; видимость через класс — transition стабильно срабатывает при обратном свайпе. */}
            {/* Декор первого слайда: только чёрные элементы из Лэндинг.svg. */}
            <img
              alt=""
              aria-hidden="true"
              className={`why-mobile-bg why-mobile-bg--first${whySlider.activeIndex === 0 ? ' is-visible' : ''}`}
              src={whyFirstSlideDecor}
              width={800}
              height={600}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
            />
            {/* Фон «лента»: со 2-го слайда; за каждые 3 слайда 0%→50%→100%. */}
            {whyMobileSlides.length > 1 && (
              <img
                alt=""
                aria-hidden="true"
                className={`why-mobile-bg${whySlider.activeIndex >= 1 ? ' is-visible' : ''}`}
                src={whyLenta}
                width={800}
                height={600}
                loading="lazy"
                decoding="async"
                style={{
                  objectPosition: `${(((whySlider.activeIndex - 1) % 3) / 2) * 100}% 50%`,
                }}
              />
            )}
            <h2 className="section-title">
              Почему мы?
              <span className="why-question-mark">?</span>
            </h2>
            <div
              className="why-slider"
              onScroll={handleWhyScrollWithStrip}
              ref={whySlider.sliderRef}
            >
              {whyMobileSlides.map((slide, index) => (
                <article
                  className={`why-slide${whySlider.activeIndex === index ? ' is-active' : ''}`}
                  data-slide-id={slide.id}
                  key={slide.id}
                >
                  <div className="why-mobile-content">
                    <img alt={slide.alt} className="why-image" loading="lazy" decoding="async" src={slide.image} width={158} height={224} />
                    <p className="why-text">{slide.text}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="dots why-dots" role="tablist">
              {whyMobileSlides.map((slide, index) => (
                <button
                  aria-label={`Слайд ${index + 1}`}
                  aria-selected={whySlider.activeIndex === index}
                  className={`dot${whySlider.activeIndex === index ? ' dot--active' : ''}`}
                  key={slide.id}
                  onClick={() => { hapticSelection(); whySlider.scrollToIndex(index); }}
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
                onScroll={whyDesktopSlider.handleScroll}
                ref={whyDesktopSlider.sliderRef}
              >
              <article className={`why-desktop-panel${whyDesktopSlider.activeIndex === 0 ? ' is-active' : ''}`}>
                <div aria-hidden className="why-desktop-shape why-desktop-shape--circle" style={{ left: '186px', top: '456px' }} />
                <img
                  alt=""
                  className="why-desktop-shape"
                  src={imgWhyVectorTop}
                  width={156}
                  height={126}
                  loading="lazy"
                  decoding="async"
                  style={{ left: '348px', top: '48px', width: '156px', height: '126px' }}
                />
                <img
                  alt=""
                  className="why-desktop-shape"
                  src={imgWhyVectorBottom}
                  width={156}
                  height={126}
                  loading="lazy"
                  decoding="async"
                  style={{ left: '348px', top: '178px', width: '156px', height: '126px' }}
                />
                <img
                  alt=""
                  className="why-desktop-shape"
                  src={imgWhyVectorWide}
                  width={333}
                  height={237}
                  loading="lazy"
                  decoding="async"
                  style={{ left: '732px', top: '269px', width: '333px', height: '237px' }}
                />
                <div className="why-desktop-ellipse" style={{ left: '1125px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse242} width={80} height={80} loading="lazy" decoding="async" />
                </div>
                <div className="why-desktop-ellipse" style={{ left: '1205px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse241} width={80} height={80} loading="lazy" decoding="async" />
                </div>
                <div
                  className="why-desktop-content"
                  style={{ '--why-offset': '21.5px' } as React.CSSProperties}
                >
                  <div className="why-desktop-column why-desktop-column--award">
                    <div className="why-desktop-media" style={{ width: '164px', height: '225px' }}>
                      <img alt="Диплом премии «Призвание Арист»" loading="lazy" decoding="async" src={imgAward2024} width={164} height={225} />
                    </div>
                    <p className="why-desktop-text-block why-desktop-text--regular">
                      призеры премии:
                      <br />
                      “ПРИЗВАНИЕ АРИСТ 2024”
                    </p>
                  </div>
                  <div className="why-desktop-column" style={{ width: '322px' }}>
                    <div className="why-desktop-media why-desktop-media--wide">
                      <img alt="Выступление" loading="lazy" decoding="async" src={imgLiveSound} width={322} height={215} />
                    </div>
                    <p className="why-desktop-text-block why-desktop-text--semibold">
                      Живой звук, профессиональный состав, опыт выступлений на топовых площадках;
                    </p>
                  </div>
                  <div className="why-desktop-column" style={{ width: '323px' }}>
                    <div className="why-desktop-media why-desktop-media--wide">
                      <img alt="Сцена" loading="lazy" decoding="async" src={imgFlexibleTerms} width={323} height={215} />
                    </div>
                    <p className="why-desktop-text-block why-desktop-text--bold">Гибкие условия сотрудничества;</p>
                  </div>
                </div>
              </article>
              <article className={`why-desktop-panel${whyDesktopSlider.activeIndex === 1 ? ' is-active' : ''}`}>
                <div aria-hidden className="why-desktop-shape why-desktop-shape--circle" style={{ left: '186px', top: '456px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorTop} width={156} height={126} loading="lazy" decoding="async" style={{ left: '348px', top: '48px', width: '156px', height: '126px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorBottom} width={156} height={126} loading="lazy" decoding="async" style={{ left: '348px', top: '178px', width: '156px', height: '126px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorWide} width={333} height={237} loading="lazy" decoding="async" style={{ left: '732px', top: '269px', width: '333px', height: '237px' }} />
                <div className="why-desktop-ellipse" style={{ left: '1125px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse242} width={80} height={80} loading="lazy" decoding="async" />
                </div>
                <div className="why-desktop-ellipse" style={{ left: '1205px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse241} width={80} height={80} loading="lazy" decoding="async" />
                </div>
                <div
                  className="why-desktop-content"
                  style={{ '--why-offset': '29.5px' } as React.CSSProperties}
                >
                    <div className="why-desktop-column" style={{ width: '319px' }}>
                      <div className="why-desktop-media why-desktop-media--wide">
                        <img alt="Сцена" loading="lazy" decoding="async" src={imgSecondPanelLeft} width={319} height={215} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--bold">
                        Подстроимся под ваши задачи и формат;
                      </p>
                    </div>
                    <div className="why-desktop-column" style={{ width: '321px' }}>
                      <div className="why-desktop-media why-desktop-media--wide">
                        <img alt="Музыкант" loading="lazy" decoding="async" src={imgSecondPanelCenter} width={321} height={215} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--semibold">
                        Репертуар песен, которого нет у других;
                      </p>
                    </div>
                    <div className="why-desktop-column" style={{ width: '319px' }}>
                      <div className="why-desktop-media why-desktop-media--wide">
                        <img alt="Событие" loading="lazy" decoding="async" src={imgSecondPanelRight} width={319} height={215} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--bold">
                        Подбираем репертуар под формат события;
                      </p>
                    </div>
                  </div>
              </article>
              <article className={`why-desktop-panel${whyDesktopSlider.activeIndex === 2 ? ' is-active' : ''}`}>
                <div aria-hidden className="why-desktop-shape why-desktop-shape--circle" style={{ left: '186px', top: '456px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorTop} width={156} height={126} loading="lazy" decoding="async" style={{ left: '348px', top: '48px', width: '156px', height: '126px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorBottom} width={156} height={126} loading="lazy" decoding="async" style={{ left: '348px', top: '178px', width: '156px', height: '126px' }} />
                <img alt="" className="why-desktop-shape" src={imgWhyVectorWide} width={333} height={237} loading="lazy" decoding="async" style={{ left: '732px', top: '269px', width: '333px', height: '237px' }} />
                <div className="why-desktop-ellipse" style={{ left: '1125px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse242} width={80} height={80} loading="lazy" decoding="async" />
                </div>
                <div className="why-desktop-ellipse" style={{ left: '1205px', top: '176px' }}>
                  <img alt="" className="why-desktop-ellipse-image" src={imgEllipse241} width={80} height={80} loading="lazy" decoding="async" />
                </div>
                <div
                  className="why-desktop-content"
                  style={{ '--why-offset': '35px' } as React.CSSProperties}
                >
                    <div className="why-desktop-column" style={{ width: '324px' }}>
                      <div className="why-desktop-media why-desktop-media--wide">
                        <img alt="Выступление" loading="lazy" decoding="async" src={imgThirdPanelLeft} width={324} height={215} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--semibold">
                        Работаем с интерактивом - вовлекаем гостей в шоу;
                      </p>
                    </div>
                    <div className="why-desktop-column" style={{ width: '329px' }}>
                      <div className="why-desktop-media why-desktop-media--wide">
                        <img alt="Сцена" loading="lazy" src={imgThirdPanelCenter} width={329} height={215} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--semibold">
                        Создаем сценарий выступления;
                      </p>
                    </div>
                    <div className="why-desktop-column why-desktop-column--narrow">
                      <div className="why-desktop-media" style={{ width: '175px', height: '234px' }}>
                        <img alt="Группа" loading="lazy" decoding="async" src={imgThirdPanelRight} width={175} height={234} />
                      </div>
                      <p className="why-desktop-text-block why-desktop-text--bold">
                        Мы показываем уровень, индивидуальность и неповторимость
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
                  aria-selected={whyDesktopSlider.activeIndex === index}
                  className={`dot${whyDesktopSlider.activeIndex === index ? ' dot--active' : ''}`}
                  key={slide}
                  onClick={() => { hapticSelection(); whyDesktopSlider.scrollToIndex(index); }}
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
            <img alt="Форматы" className="card-image" src={formatImage} width={800} height={600} loading="lazy" decoding="async" />
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
          onClick={handleFormatsNavigate}
          type="button"
        >
          Подробнее
        </button>
      </section>

      <section className="section live" id="live">
        <h2 className="section-title">Live-видео</h2>
        <div
          className="live-slider"
          onScroll={liveSlider.handleScroll}
          ref={liveSlider.sliderRef}
        >
          {liveVideos.map((item, index) => (
            <article
              key={item.id}
              className={`live-slide ${liveSlider.activeIndex === index && isLivePlaying ? 'is-playing' : ''}`}
            >
              <div className={`live-card glass ${liveSlider.activeIndex === index && isLivePlaying ? 'is-playing' : ''}`}>
                <div className="live-player">
                  {isRutubeUrl(item.src) ? (
                    <iframe
                      className="live-embed"
                      src={getRutubeEmbedUrl(item.src)}
                      title={item.title}
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <>
                      <video
                        className="live-video"
                        loop
                        onPause={() => setIsLivePlaying(false)}
                        onPlay={() => setIsLivePlaying(true)}
                        playsInline
                        poster={item.poster}
                        preload="metadata"
                        ref={(el) => {
                          liveVideoRefs.current[index] = el;
                        }}
                      >
                        <source src={item.src} type="video/mp4" />
                      </video>
                      <button
                        className="video-play-button"
                        onClick={handleLiveToggle}
                        type="button"
                        aria-label={liveSlider.activeIndex === index && isLivePlaying ? 'Поставить на паузу' : 'Воспроизвести'}
                      >
                        {liveSlider.activeIndex === index && isLivePlaying ? (
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                        ) : (
                          <img alt="" src={livePlay} width={48} height={48} loading="lazy" decoding="async" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="dots live-dots">
          {liveVideos.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-label={`Live-видео ${index + 1}`}
              aria-selected={liveSlider.activeIndex === index}
              className={`dot${liveSlider.activeIndex === index ? ' dot--active' : ''}`}
              onClick={() => { hapticSelection(); liveSlider.scrollToIndex(index); }}
            />
          ))}
        </div>
        <button className="btn btn-primary live-btn" type="button" onClick={handleGoToCalendar}>
          Оставить заявку
        </button>
      </section>

      <section className="section residents">
        {/* SVG blur сверху — переход от предыдущей секции (как в Лэндинг.svg filter17) */}
        <svg aria-hidden="true" className="residents-blur-top" viewBox="0 0 509 102" preserveAspectRatio="none">
          <defs>
            <filter id="residentsBlurTop" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="22.6" />
            </filter>
          </defs>
          <rect x="0" y="0" width="509" height="102" fill="#2B2B2B" filter="url(#residentsBlurTop)" />
        </svg>
        <div className="residents-container">
          <img alt="Резиденты" className="residents-image" src={residentsImage} loading="lazy" decoding="async" />
          <h3 className="residents-subtitle">Резиденты</h3>
          {/* SVG blur снизу — переход к кнопке (как в Лэндинг.svg) */}
          <svg aria-hidden="true" className="residents-blur-bottom" viewBox="0 0 509 97" preserveAspectRatio="none">
            <defs>
              <filter id="residentsBlurBottom" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="33.3" />
              </filter>
            </defs>
            <rect x="0" y="0" width="509" height="97" fill="#000000" filter="url(#residentsBlurBottom)" />
          </svg>
        </div>
        <button
          className="btn btn-primary residents-btn"
          type="button"
          onClick={() => { hapticImpact('light'); onGoToResidents?.(); }}
        >
          Познакомиться
        </button>
      </section>

      <section className="section socials" id="socials">
        <h2 className="section-title">Наши соц. сети</h2>
        <div className="tile-grid socials-grid">
          <a
            href="https://t.me/example"
            target="_blank"
            rel="noopener noreferrer"
            className="tile social-tile social-tile--telegram"
            aria-label="Telegram"
            onClick={(e) => {
              if (isInsideTelegram()) {
                e.preventDefault();
                hapticImpact('light');
                openTelegramLink('https://t.me/example');
              }
            }}
          >
            <span className="social-tile__bg" aria-hidden />
            <span className="social-tile__icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="currentColor" className="social-tile__svg">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </span>
          </a>
          <a
            href="https://vk.com/example"
            target="_blank"
            rel="noopener noreferrer"
            className="tile social-tile social-tile--vk"
            aria-label="ВКонтакте"
          >
            <span className="social-tile__bg" aria-hidden />
            <span className="social-tile__icon social-tile__icon--vk" aria-hidden>
              <svg viewBox="0 0 24 24" fill="currentColor" className="social-tile__svg social-tile__svg--vk" shapeRendering="geometricPrecision">
                {/* Логотип VK (Simple Icons) — полный path, без упрощений */}
                <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.525-2.049-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.335-3.202C4.624 10.857 4 8.57 4 6.645c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 3.405 4.675.271 0 .407-.102.407-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.169.508.271.508.271 0 .373-.169.678-.508 1.254-1.778 2.151-4.507 2.151-4.507.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.049.17.49-.085.744-.576.744z" />
              </svg>
            </span>
          </a>
          <a
            href="https://instagram.com/example"
            target="_blank"
            rel="noopener noreferrer"
            className="tile social-tile social-tile--instagram"
            aria-label="Instagram"
          >
            <span className="social-tile__bg" aria-hidden />
            <span className="social-tile__icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="currentColor" className="social-tile__svg">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
              </svg>
            </span>
          </a>
        </div>
      </section>

      <section className="section partners" id="partners">
        <h2 className="section-title">Наши партнеры</h2>
        <div className="tile-grid partners-grid">
          {partners.length > 0
            ? partners.map((partner, index) => {
                const logoProps = getOptimizedImageProps(partner.logoUrl);
                const content = (
                  <>
                    <span className="partner-tile__img-wrap">
                      {logoProps ? (
                        <OptimizedImage
                          {...logoProps}
                          alt=""
                          className="partner-tile__img"
                          loading="lazy"
                          sizes="(max-width: 440px) 100vw, 200px"
                        />
                      ) : (
                        <span className="partner-tile__placeholder" aria-hidden>🤝</span>
                      )}
                    </span>
                    <span className="partner-tile__name">{partner.name}</span>
                  </>
                );
                const isFirst = index === 0;
                const tileClass = isFirst ? 'tile partner-tile partner-tile--with-badge' : 'tile partner-tile';
                const badge = isFirst ? (
                  <span className="partners-badge partners-badge--corner" aria-hidden>
                    Разработчики
                  </span>
                ) : null;
                if (partner.link) {
                  return (
                    <a
                      key={partner.id}
                      href={partner.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={tileClass}
                    >
                      {badge}
                      {content}
                    </a>
                  );
                }
                return (
                  <div key={partner.id} className={tileClass}>
                    {badge}
                    {content}
                  </div>
                );
              })
            : Array.from({ length: 6 }, (_, i) => (
                <div key={`placeholder-${i}`} className="tile partner-tile partner-tile--empty" />
              ))}
        </div>
      </section>

      <section className="section footer-date">
        <div className="date-card">
          <div aria-hidden="true" className="date-wave-wrap">
            <img alt="" className="date-wave" src={dateWave} width={1920} height={200} loading="lazy" decoding="async" />
          </div>
          <h1 className="date-title">
            Выбери дату <br />
            своего события
          </h1>
          <button className="btn btn-primary date-btn" type="button" onClick={handleGoToCalendar}>
            Оставить заявку
          </button>
          <p className="date-note">Не для всех. Для своих.</p>
        </div>
      </section>
    </main>
  );
}
