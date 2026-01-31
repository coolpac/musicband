import { useEffect, useState } from 'react';
import heroLogo from '../assets/figma/downloaded/hero-logo.svg';
import './AppLoader.css';

const MIN_DISPLAY_MS = 800;
const MAX_WAIT_MS = 1500;
const EXIT_ANIMATION_MS = 200;
const EQUALIZER_BAR_COUNT = 5;
const EQUALIZER_STAGGER_S = 0.15;

export default function AppLoader({ onReady }: { onReady: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let done = false;

    if (document.readyState === 'complete') {
      done = true;
      setIsExiting(true);
      return;
    }

    const tryFinish = () => {
      if (done) return;
      const elapsed = performance.now() - start;
      const ready = document.readyState === 'complete';
      const minElapsed = elapsed >= MIN_DISPLAY_MS;
      if (ready && minElapsed) {
        done = true;
        setIsExiting(true);
      }
    };

    const onLoad = () => {
      tryFinish();
    };

    window.addEventListener('load', onLoad);

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
