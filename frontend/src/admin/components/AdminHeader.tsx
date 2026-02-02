import { ReactNode } from 'react';
import topbarLogo from '../../assets/figma/topbar-left.svg';
import '../../components/Header.css';
import { useAdminAuth } from '../context/AdminAuthContext';
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

  return (
    <header className="app-header admin-header">
      <div className="app-topbar admin-topbar">
        <div className="admin-topbar__left" aria-hidden="true" />
        <div className="admin-topbar__center">
          {customContent || (
            <img
              alt="ГРУП"
              className="app-topbar-logo"
              src={topbarLogo}
            />
          )}
        </div>
        <div className="admin-topbar__right">
          {showAvatar && (
            <div className="admin-topbar__avatar">
              {!loading && avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="admin-topbar__avatar-img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                avatarLetter
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
