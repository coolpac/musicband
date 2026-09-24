import { ReactNode } from 'react';
import topbarLogo from '../../assets/figma/topbar-left.svg';
import '../../components/Header.css';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useAdminMode } from '../site/AdminModeContext';
import ModeSwitch from '../site/ModeSwitch';
import './AdminHeader.css';

interface AdminHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  showAvatar?: boolean;
  /** Буква в кружке, если контекст не дал аватарку и не передан явно */
  avatarLetter?: string;
  customContent?: ReactNode;
}

export default function AdminHeader({
  showAvatar = true,
  avatarLetter: avatarLetterProp,
  customContent,
}: AdminHeaderProps) {
  const { avatarUrl, avatarLetter: avatarLetterFromContext, loading } = useAdminAuth();
  const avatarLetter = avatarLetterProp ?? avatarLetterFromContext;
  // Вне оболочки админки (например, в изолированных превью) контекста режима нет — тогда слот пустой.
  const modeContext = useAdminMode();

  return (
    <header className="app-header admin-header">
      <div className={`app-topbar admin-topbar ${modeContext ? 'admin-topbar--with-mode' : ''}`}>
        <div className="admin-topbar__left">
          {modeContext && <ModeSwitch mode={modeContext.mode} onChange={modeContext.requestMode} />}
        </div>
        <div className="admin-topbar__center">
          {customContent ??
            (showAvatar ? (
              <div className="admin-topbar__avatar admin-topbar__avatar--center">
                {!loading && avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="admin-topbar__avatar-img"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="admin-topbar__avatar-letter" aria-hidden>{avatarLetter}</span>
                )}
              </div>
            ) : (
              <img alt="ВГУЛ" className="app-topbar-logo" src={topbarLogo} />
            ))}
        </div>
        <div className="admin-topbar__right" />
      </div>
    </header>
  );
}
