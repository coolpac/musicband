import { useEffect, useState } from 'react';
import { getAdminStats } from '../../services/adminService';
import AdminHeader from '../components/AdminHeader';
import FlexGuardLogo from '../components/FlexGuardLogo';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../../styles/admin.css';

/* Оптимизированные SVG-иконки (stroke, 24×24) */
const IconBarChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 3v18h18" />
    <path d="M7 16v-5" />
    <path d="M12 16v-9" />
    <path d="M17 16v-2" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12l5 5L20 7" />
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const IconStar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

type DashboardStats = {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  conversionRate: number;
  pendingConfirmation: number;
};

type DashboardScreenProps = {
  onGoToBookings?: () => void;
  onGoToAgents?: () => void;
  onGoToReviews?: () => void;
};

export default function DashboardScreen({ onGoToBookings, onGoToAgents, onGoToReviews }: DashboardScreenProps) {
  useAdminAuth(); // для шапки (аватар там)
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 28,
    confirmedBookings: 3,
    pendingBookings: 24,
    cancelledBookings: 1,
    totalRevenue: 24000,
    conversionRate: 11,
    pendingConfirmation: 24,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      try {
        const data = await getAdminStats();
        if (!cancelled) setStats(data);
      } catch (e) {
        console.warn('Dashboard: failed to load stats', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadStats();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="admin-screen">
        <AdminHeader showBack onBack={() => window.history.back()} />
        <main className="admin-content">
          <h1 className="admin-title">Админ-панель</h1>
          <div className="admin-loading">Загрузка...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-screen dashboard-screen">
      <AdminHeader showBack onBack={() => window.history.back()} />
      <main className="admin-content dashboard-content">
        <h1 className="admin-title dashboard-title">Админ-панель</h1>

        <div className="admin-grid dashboard-grid">
          {/* Total Bookings Card — по нажатию переход к заявкам */}
          <button
            type="button"
            className="admin-card admin-card--clickable"
            onClick={onGoToBookings}
            aria-label="Перейти к заявкам"
          >
            <div className="admin-card__icon"><IconBarChart /></div>
            <div className="admin-card__number">{stats.totalBookings}</div>
            <div className="admin-card__label">Всего заявок</div>
            {onGoToBookings && (
              <span className="admin-card__action">Перейти к заявкам →</span>
            )}
          </button>

          {/* Confirmed Bookings Card */}
          <div className="admin-card admin-card--success">
            <div className="admin-card__icon"><IconCheck /></div>
            <div className="admin-card__number">{stats.confirmedBookings}</div>
            <div className="admin-card__label">Подтверждено</div>
          </div>

          {/* Pending Bookings Card */}
          <div className="admin-card admin-card--warning">
            <div className="admin-card__icon"><IconClock /></div>
            <div className="admin-card__number">{stats.pendingBookings}</div>
            <div className="admin-card__label">В ожидании</div>
          </div>

          {/* Cancelled Bookings Card */}
          <div className="admin-card admin-card--danger">
            <div className="admin-card__icon"><IconX /></div>
            <div className="admin-card__number">{stats.cancelledBookings}</div>
            <div className="admin-card__label">Отменено</div>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="admin-card admin-card--large dashboard-card-large">
          <div className="admin-card__header">
            <h2 className="admin-card__title">Общий доход</h2>
          </div>
          <div className="admin-card__revenue">
            {stats.totalRevenue.toLocaleString('ru-RU')} ₽
          </div>
        </div>

        {/* Conversion Card */}
        <div className="admin-card admin-card--large dashboard-card-large">
          <div className="admin-card__header">
            <h2 className="admin-card__title">Конверсия</h2>
          </div>
          <div className="admin-card__metrics">
            <div className="admin-metric">
              <div className="admin-metric__label">Коэффициент подтверждения:</div>
              <div className="admin-metric__value">{stats.conversionRate}%</div>
            </div>
            <div className="admin-metric">
              <div className="admin-metric__label">В ожидании подтверждения:</div>
              <div className="admin-metric__value">{stats.pendingConfirmation}</div>
            </div>
          </div>
        </div>

        {/* Quick access: Агенты и Отзывы */}
        <section className="dashboard-quick" aria-label="Управление">
          <h2 className="dashboard-quick__title">Управление</h2>
          <div className="admin-grid admin-grid--quick">
            {onGoToAgents && (
              <button
                type="button"
                className="admin-card admin-card--clickable admin-card--quick"
                onClick={onGoToAgents}
                aria-label="Перейти к агентам"
              >
                <div className="admin-card__icon admin-card__icon--muted"><IconUsers /></div>
                <div className="admin-card__label">Агенты</div>
                <span className="admin-card__action">Рефералы и партнёры →</span>
              </button>
            )}
            {onGoToReviews && (
              <button
                type="button"
                className="admin-card admin-card--clickable admin-card--quick"
                onClick={onGoToReviews}
                aria-label="Перейти к отзывам"
              >
                <div className="admin-card__icon admin-card__icon--muted"><IconStar /></div>
                <div className="admin-card__label">Отзывы</div>
                <span className="admin-card__action">Модерация отзывов →</span>
              </button>
            )}
          </div>
        </section>

        <footer className="dashboard-hero dashboard-hero--bottom dashboard-hero--glass">
          <FlexGuardLogo size="md" showBadge={true} />
          <p className="dashboard-hero__tagline">Админ-панель</p>
        </footer>
      </main>
    </div>
  );
}
