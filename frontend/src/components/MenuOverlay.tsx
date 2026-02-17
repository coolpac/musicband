import { useEffect, useState } from 'react';
import { hapticImpact } from '../telegram/telegramWebApp';
// WebP с качеством 92 — меньше артефактов banding в тёмных градиентах чем JPEG
import navBg1 from '../assets/figma/downloaded/nav-bg-1.webp';
import navBg2 from '../assets/figma/downloaded/nav-bg-2.webp';
import navBg3 from '../assets/figma/downloaded/nav-bg-3.webp';
import navBg4 from '../assets/figma/downloaded/nav-bg-4.webp';
import navBg5 from '../assets/figma/downloaded/nav-bg-5.webp';

type MenuTarget = 'home' | 'formats' | 'live' | 'promo' | 'partners' | 'socials';

type MenuItem = {
  label: string;
  target: MenuTarget;
};

const menuItems: MenuItem[] = [
  { label: 'Главная', target: 'home' },
  { label: 'Форматы', target: 'formats' },
  { label: 'Live', target: 'live' },
  { label: 'Промо', target: 'promo' },
  { label: 'Партнеры', target: 'partners' },
  { label: 'Наши соц. сети', target: 'socials' },
];

type MenuOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (target: MenuTarget) => void;
};

const navBgFrames = [navBg1, navBg2, navBg3, navBg4, navBg5];

export default function MenuOverlay({ isOpen, onClose, onNavigate }: MenuOverlayProps) {
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setBgIndex(0);
      return;
    }

    // Предзагрузка всех кадров, чтобы при переключении не было "мигания".
    navBgFrames.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    if (reduceMotion) return;

    // Плавная "гифка": меняем фон по кругу, а CSS делает fade.
    const intervalMs = 2200;
    const id = window.setInterval(() => {
      setBgIndex((current) => (current + 1) % navBgFrames.length);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [isOpen]);

  return (
    <div 
      className={`menu-overlay${isOpen ? ' is-open' : ''}`} 
      aria-hidden={!isOpen}
    >
      <button 
        className="menu-overlay__backdrop" 
        onClick={() => { hapticImpact('light'); onClose(); }} 
        type="button" 
        aria-label="Закрыть меню"
        tabIndex={isOpen ? 0 : -1}
      />
      <div className="menu-overlay__panel" role="dialog" aria-modal={isOpen ? 'true' : 'false'} aria-label="Меню">
        <div className="menu-overlay__bg-stack" aria-hidden="true">
          {navBgFrames.map((src, index) => (
            <img
              // src уникален (Vite подставит хэш), key можно смело делать по src
              key={src}
              alt=""
              className={`menu-overlay__bg${index === bgIndex ? ' is-active' : ''}`}
              src={src}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          ))}
        </div>

        <h2 className="menu-overlay__title">МЕНЮ</h2>
        <div className="menu-overlay__links">
          {menuItems.map((item) => (
            <button
              key={item.target}
              className={item.target === 'promo' ? 'menu-overlay__link menu-overlay__link--promo' : 'menu-overlay__link'}
              onClick={() => { hapticImpact('light'); onNavigate(item.target); }}
              type="button"
              tabIndex={isOpen ? 0 : -1}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
