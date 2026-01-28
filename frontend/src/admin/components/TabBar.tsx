import { HomeIcon, MusicIcon, CalendarIcon, ImageIcon, SettingsIcon } from '../assets/icons';
import '../../styles/admin-tabbar.css';

export type AdminTab = 'dashboard' | 'voting' | 'bookings' | 'content' | 'settings';

type TabBarProps = {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
};

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs: Array<{ id: AdminTab; icon: typeof HomeIcon; label: string }> = [
    { id: 'dashboard', icon: HomeIcon, label: 'Главная' },
    { id: 'voting', icon: MusicIcon, label: 'Голосование' },
    { id: 'bookings', icon: CalendarIcon, label: 'Брони' },
    { id: 'content', icon: ImageIcon, label: 'Контент' },
    { id: 'settings', icon: SettingsIcon, label: 'Настройки' },
  ];

  return (
    <nav className="admin-tabbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            className={`admin-tabbar__item ${isActive ? 'admin-tabbar__item--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.label}
            aria-selected={isActive}
          >
            <div className="admin-tabbar__icon">
              <Icon active={isActive} />
            </div>
          </button>
        );
      })}
    </nav>
  );
}
