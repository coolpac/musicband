import { ReactNode } from 'react';
import topbarLogo from '../../assets/figma/topbar-left.svg';
import '../../components/Header.css';
import './AdminHeader.css';

interface AdminHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  showAvatar?: boolean;
  avatarLetter?: string;
  customContent?: ReactNode;
}

export default function AdminHeader({
  showAvatar = true,
  avatarLetter = 'В',
  customContent,
}: AdminHeaderProps) {
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
              {avatarLetter}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
