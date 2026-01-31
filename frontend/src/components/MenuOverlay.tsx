import navBg from '../assets/figma/downloaded/nav-bg.webp';
import navTitle from '../assets/figma/downloaded/nav-title.svg';

type MenuTarget = 'home' | 'formats' | 'live' | 'partners' | 'socials';

type MenuItem = {
  label: string;
  target: MenuTarget;
};

const menuItems: MenuItem[] = [
  { label: 'Главная', target: 'home' },
  { label: 'Форматы', target: 'formats' },
  { label: 'Лайф', target: 'live' },
  { label: 'Партнеры', target: 'partners' },
  { label: 'Наши соц. сети', target: 'socials' },
];

type MenuOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (target: MenuTarget) => void;
};

export default function MenuOverlay({ isOpen, onClose, onNavigate }: MenuOverlayProps) {
  return (
    <div 
      className={`menu-overlay${isOpen ? ' is-open' : ''}`} 
      aria-hidden={!isOpen}
    >
      <button 
        className="menu-overlay__backdrop" 
        onClick={onClose} 
        type="button" 
        aria-label="Закрыть меню"
        tabIndex={isOpen ? 0 : -1}
      />
      <div className="menu-overlay__panel" role="dialog" aria-modal={isOpen ? 'true' : 'false'} aria-label="Меню">
        <img alt="" className="menu-overlay__bg" src={navBg} />
        <img alt="Меню" className="menu-overlay__title" src={navTitle} />
        <div className="menu-overlay__links">
          {menuItems.map((item) => (
            <button
              key={item.target}
              onClick={() => onNavigate(item.target)}
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
