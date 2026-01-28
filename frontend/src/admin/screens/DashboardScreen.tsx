import { useEffect, useState } from 'react';
import '../../styles/admin.css';

type DashboardStats = {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  conversionRate: number;
  pendingConfirmation: number;
};

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 28,
    confirmedBookings: 3,
    pendingBookings: 24,
    cancelledBookings: 1,
    totalRevenue: 24000,
    conversionRate: 11,
    pendingConfirmation: 24,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: Load real stats from API
    // const loadStats = async () => {
    //   const data = await getAdminStats();
    //   setStats(data);
    // };
    // loadStats();
  }, []);

  return (
    <div className="admin-screen">
      <header className="admin-header">
        <div className="admin-header__left">
          <button className="admin-header__back" type="button">
            Назад
          </button>
        </div>
        <div className="admin-header__logo">
          <svg width="60" height="24" viewBox="0 0 60 24" fill="white">
            <text x="0" y="18" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="bold">
              ГРУП
            </text>
          </svg>
        </div>
        <div className="admin-header__right">
          <button className="admin-header__menu" type="button" aria-label="Меню">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="5" r="1.5" fill="white" />
              <circle cx="12" cy="12" r="1.5" fill="white" />
              <circle cx="12" cy="19" r="1.5" fill="white" />
            </svg>
          </button>
          <div className="admin-header__avatar">
            <span>В</span>
          </div>
        </div>
      </header>

      <main className="admin-content">
        <h1 className="admin-title">Админ-панель</h1>

        <div className="admin-grid">
          {/* Total Bookings Card */}
          <div className="admin-card">
            <div className="admin-card__icon">📊</div>
            <div className="admin-card__number">{stats.totalBookings}</div>
            <div className="admin-card__label">Всего заявок</div>
          </div>

          {/* Confirmed Bookings Card */}
          <div className="admin-card admin-card--success">
            <div className="admin-card__icon">✓</div>
            <div className="admin-card__number">{stats.confirmedBookings}</div>
            <div className="admin-card__label">Подтверждено</div>
          </div>

          {/* Pending Bookings Card */}
          <div className="admin-card admin-card--warning">
            <div className="admin-card__icon">⏱</div>
            <div className="admin-card__number">{stats.pendingBookings}</div>
            <div className="admin-card__label">В ожидании</div>
          </div>

          {/* Cancelled Bookings Card */}
          <div className="admin-card admin-card--danger">
            <div className="admin-card__icon">✕</div>
            <div className="admin-card__number">{stats.cancelledBookings}</div>
            <div className="admin-card__label">Отменено</div>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="admin-card admin-card--large">
          <div className="admin-card__header">
            <h2 className="admin-card__title">Общий доход</h2>
          </div>
          <div className="admin-card__revenue">
            {stats.totalRevenue.toLocaleString('ru-RU')} ₽
          </div>
        </div>

        {/* Conversion Card */}
        <div className="admin-card admin-card--large">
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
      </main>
    </div>
  );
}
