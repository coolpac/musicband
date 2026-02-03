import { useEffect, useState } from 'react';
import heroLogo from '../assets/figma/downloaded/hero-logo.svg';
import './AppLoader.css';

// Критичные изображения для preload во время загрузочного экрана
import heroImage from '../assets/figma/hero-image.webp';

/** Минимальное время показа лоадера (чтобы был виден, а не только сплэш Telegram). */
const MIN_DISPLAY_MS = 1600;
const MAX_WAIT_MS = 3500;
const EXIT_ANIMATION_MS = 320;
const EQUALIZER_BAR_COUNT = 5;
const EQUALIZER_STAGGER_S = 0.15;

/** Preload критичных изображений */
function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Не блокируем если ошибка
          img.src = url;
        })
    )
  );
}

export default function AppLoader({ onReady }: { onReady: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let done = false;
    let imagesPreloaded = false;

    // Запускаем preload изображений сразу
    preloadImages([heroImage]).then(() => {
      imagesPreloaded = true;
      tryFinish();
    });

    const tryFinish = () => {
      if (done) return;
      const elapsed = performance.now() - start;
      const ready = document.readyState === 'complete';
      const minElapsed = elapsed >= MIN_DISPLAY_MS;
      // Ждём: минимальное время + документ готов + изображения загружены
      if (ready && minElapsed && imagesPreloaded) {
        done = true;
        setIsExiting(true);
      }
    };

    const onLoad = () => {
      tryFinish();
    };

    window.addEventListener('load', onLoad);

    // Всегда ждём минимум MIN_DISPLAY_MS, затем проверяем document ready
    const minTimer = setTimeout(tryFinish, MIN_DISPLAY_MS);
    const maxTimer = setTimeout(() => {
      done = true;
      setIsExiting(true);
    }, MAX_WAIT_MS);

    return () => {
      window.removeEventListener('load', onLoad);
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  useEffect(() => {
    if (!isExiting) return;
    const t = setTimeout(() => {
      onReady();
    }, EXIT_ANIMATION_MS);
    return () => clearTimeout(t);
  }, [isExiting, onReady]);

  return (
    <div
      className={`app-loader${isExiting ? ' app-loader--exiting' : ''}`}
      aria-hidden="true"
      role="presentation"
    >
      <div className="app-loader__inner">
        <div className="app-loader__logo-wrap">
          <img
            src={heroLogo}
            alt=""
            className="app-loader__logo"
            width={280}
            height={74}
            fetchPriority="high"
          />
        </div>
        <p className="app-loader__tagline" aria-hidden="true">
          Живая музыка
        </p>
        <div className="app-loader__equalizer" aria-hidden="true">
          {Array.from({ length: EQUALIZER_BAR_COUNT }, (_, i) => (
            <span
              key={i}
              className="app-loader__equalizer-bar"
              style={{ animationDelay: `${i * -EQUALIZER_STAGGER_S}s` }}
            />
          ))}
        </div>
        <div className="app-loader__bar" aria-label="Загрузка">
          <div className="app-loader__bar-fill" />
        </div>
      </div>
      <p className="app-loader__credit" aria-hidden="true">
        <span className="app-loader__credit-label">powered by</span>{' '}
        <span className="app-loader__credit-brand">Quardobot</span>
      </p>
    </div>
  );
}
