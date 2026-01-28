import { ReactNode } from 'react';
import topbarLogo from '../../assets/figma/topbar-left.svg';
import '../../components/Header.css';
import './AdminHeader.css';

interface AdminHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  showMenu?: boolean;
  onMenuClick?: () => void;
  showAvatar?: boolean;
  avatarLetter?: string;
  customContent?: ReactNode;
}

export default function AdminHeader({
  showBack = false,
  onBack,
  showMenu = true,
  onMenuClick,
  showAvatar = true,
  avatarLetter = 'В',
  customContent,
}: AdminHeaderProps) {
  return (
    <header className="app-header admin-header">
      <div className="app-topbar admin-topbar">
        {/* Левая секция - кнопка назад */}
        <div className="admin-topbar__left">
          {showBack && (
            <button
              className="admin-topbar__back"
              onClick={onBack}
              aria-label="Назад"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 18L9 12L15 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Центральная секция - логотип или кастомный контент */}
        <div className="admin-topbar__center">
          {customContent || (
            <img
              alt="ГРУП"
              className="app-topbar-logo"
              src={topbarLogo}
            />
          )}
        </div>

        {/* Правая секция - меню и аватар */}
        <div className="admin-topbar__right">
          {showMenu && (
            <button
              className="admin-topbar__menu"
              onClick={onMenuClick}
              aria-label="Меню"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="18" r="1.5" fill="currentColor" />
              </svg>
            </button>
          )}
          {showAvatar && (
            <div className="admin-topbar__avatar">
              {avatarLetter}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
