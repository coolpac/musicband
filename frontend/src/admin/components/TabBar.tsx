import { hapticSelection } from '../../telegram/telegramWebApp';
import {
  HomeIcon,
  BarChartIcon,
  MusicIcon,
  CalendarIcon,
  ImageIcon,
  FileIcon,
  ListIcon,
} from '../assets/icons';
import type { AdminMode } from '../site/AdminModeContext';
import '../../styles/admin-tabbar.css';

export type AdminTab =
  | 'dashboard'
  | 'voting'
  | 'songs'
  | 'bookings'
  | 'content'
  | 'agents'
  | 'reviews'
  | 'analytics'
  | 'site-content'
  | 'site-posters'
  | 'site-bookings'
  | 'site-seo';

type TabDescriptor = { id: AdminTab; icon: typeof HomeIcon; label: string };

/** Режим «Приложение» — ровно те же пять вкладок, что были до появления режима «Сайт». */
const APP_TABS: TabDescriptor[] = [
  { id: 'dashboard', icon: HomeIcon, label: 'Главная' },
  { id: 'voting', icon: BarChartIcon, label: 'Голосование' },
  { id: 'songs', icon: MusicIcon, label: 'Песни' },
  { id: 'bookings', icon: CalendarIcon, label: 'Брони' },
  { id: 'content', icon: ImageIcon, label: 'Контент' },
];

const SITE_TABS: TabDescriptor[] = [
  { id: 'site-content', icon: FileIcon, label: 'Контент' },
  { id: 'site-posters', icon: ImageIcon, label: 'Афиша' },
  { id: 'site-bookings', icon: ListIcon, label: 'Заявки' },
  { id: 'site-seo', icon: BarChartIcon, label: 'SEO' },
];

const TABS_BY_MODE: Record<AdminMode, TabDescriptor[]> = {
  app: APP_TABS,
  site: SITE_TABS,
};

/** Вкладка, на которую попадает режим при первом открытии. */
export const DEFAULT_TAB_BY_MODE: Record<AdminMode, AdminTab> = {
  app: APP_TABS[0].id,
  site: SITE_TABS[0].id,
};

type TabBarProps = {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  mode?: AdminMode;
};

export default function TabBar({ activeTab, onTabChange, mode = 'app' }: TabBarProps) {
  const tabs = TABS_BY_MODE[mode];

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
            onClick={() => { hapticSelection(); onTabChange(tab.id); }}
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
