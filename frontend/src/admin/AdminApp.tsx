import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import TabBar, { AdminTab } from './components/TabBar';
import AdminTerminalLoader, { MIN_LOADER_DISPLAY_MS } from './components/AdminTerminalLoader';
import { SectionLoader } from './components/SectionLoader';
import AdminHeader from './components/AdminHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import LoginScreen from './screens/LoginScreen';
import { useTelegramWebApp } from '../telegram/useTelegramWebApp';
import { getAdminStatsCached } from '../services/adminService';
import {
  getAdminBookingsCached,
  getAdminBookingCalendarCached,
  getAdminBlockedDatesCached,
} from '../services/adminBookingService';
import { getAdminReviewsCached } from '../services/adminReviewsService';
import '../styles/admin.css';
import '../styles/admin-tabbar.css';

/** Каркас экрана + локальный лоадер (двухфазная загрузка: сначала UI, потом контент) */
function AdminScreenShell() {
  return (
    <div className="admin-screen">
      <AdminHeader />
      <main className="admin-content">
        <SectionLoader label="Загрузка…" />
      </main>
    </div>
  );
}

const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const VotingManagementScreen = lazy(() => import('./screens/VotingManagementScreen'));
const SongsManagementScreen = lazy(() => import('./screens/SongsManagementScreen'));
const BookingsManagementScreen = lazy(() => import('./screens/BookingsManagementScreen'));
const BookingsLogScreen = lazy(() => import('./screens/BookingsLogScreen'));
const ContentScreen = lazy(() => import('./screens/ContentScreen'));
const AgentsManagementScreen = lazy(() => import('./screens/AgentsManagementScreen'));
const ReviewsManagementScreen = lazy(() => import('./screens/ReviewsManagementScreen'));
const ExtendedAnalyticsScreen = lazy(() => import('./screens/ExtendedAnalyticsScreen'));

export type BookingsView = 'log' | 'calendar';

function AdminContent() {
  useTelegramWebApp({ initOnMount: true });
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [bookingsView, setBookingsView] = useState<BookingsView>('log');
  const { isAuthenticated, loading } = useAdminAuth();

  // Показываем терминал-лоадер только один раз при первом входе
  const hasBooted = useRef(false);
  const [booting, setBooting] = useState(!hasBooted.current);

  useEffect(() => {
    if (hasBooted.current || loading || !isAuthenticated) return;
    // Первая загрузка — показываем терминал на MIN_LOADER_DISPLAY_MS
    const t = setTimeout(() => {
      hasBooted.current = true;
      setBooting(false);
    }, MIN_LOADER_DISPLAY_MS);
    return () => clearTimeout(t);
  }, [loading, isAuthenticated]);

  // Пока идёт показ терминал-лоадера — префетчим данные и чанки экранов (чтобы после появления дашборда всё уже было готово)
  useEffect(() => {
    if (!isAuthenticated || loading) return;

    const monthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    getAdminStatsCached().catch(() => {});
    getAdminBookingsCached({ limit: 200 }).catch(() => {});
    getAdminBookingCalendarCached(monthStr).catch(() => {});
    getAdminBlockedDatesCached(monthStr).catch(() => {});
    getAdminReviewsCached({ page: 1, limit: 20 }).catch(() => {});

    import('./screens/DashboardScreen');
    import('./screens/VotingManagementScreen');
    import('./screens/SongsManagementScreen');
    import('./screens/BookingsManagementScreen');
    import('./screens/BookingsLogScreen');
  }, [isAuthenticated, loading]);

  // Показываем загрузку пока проверяем токен
  if (loading) {
    return <AdminTerminalLoader />;
  }

  // Не авторизован — показываем логин
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Первый вход — терминал-лоадер
  if (booting) {
    return <AdminTerminalLoader />;
  }

  const goToBookingsLog = () => {
    setBookingsView('log');
    setActiveTab('bookings');
  };

  const fallback = <AdminScreenShell />;

  const hide = { display: 'none' as const };
  const show = { display: 'block' as const };

  return (
    <div className="admin-app">
      <Suspense fallback={fallback}>
        <div style={activeTab === 'dashboard' ? show : hide}>
          <ErrorBoundary>
            <DashboardScreen
              onGoToBookings={goToBookingsLog}
              onGoToAgents={() => setActiveTab('agents')}
              onGoToReviews={() => setActiveTab('reviews')}
              onGoToAnalytics={() => setActiveTab('analytics')}
            />
          </ErrorBoundary>
        </div>
        <div style={activeTab === 'voting' ? show : hide}>
          <ErrorBoundary>
            <VotingManagementScreen />
          </ErrorBoundary>
        </div>
        <div style={activeTab === 'songs' ? show : hide}>
          <ErrorBoundary>
            <SongsManagementScreen />
          </ErrorBoundary>
        </div>
        <div style={activeTab === 'bookings' && bookingsView === 'log' ? show : hide}>
          <ErrorBoundary>
            <BookingsLogScreen onGoToCalendar={() => setBookingsView('calendar')} />
          </ErrorBoundary>
        </div>
        <div style={activeTab === 'bookings' && bookingsView === 'calendar' ? show : hide}>
          <ErrorBoundary>
            <BookingsManagementScreen onGoToLog={() => setBookingsView('log')} />
          </ErrorBoundary>
        </div>
        <div style={activeTab === 'content' ? show : hide}>
          <ErrorBoundary>
            <ContentScreen />
          </ErrorBoundary>
        </div>
        <div style={activeTab === 'agents' ? show : hide}>
          <ErrorBoundary>
            <AgentsManagementScreen />
          </ErrorBoundary>
        </div>
        <div style={activeTab === 'reviews' ? show : hide}>
          <ErrorBoundary>
            <ReviewsManagementScreen />
          </ErrorBoundary>
        </div>
        <div style={activeTab === 'analytics' ? show : hide}>
          <ErrorBoundary>
            <ExtendedAnalyticsScreen />
          </ErrorBoundary>
        </div>
      </Suspense>
      <TabBar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'bookings') setBookingsView('calendar');
          setActiveTab(tab);
        }}
      />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.3))',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'white',
            borderRadius: '15px',
            padding: '16px',
          },
          success: {
            iconTheme: {
              primary: '#4ade80',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#f87171',
              secondary: 'white',
            },
          },
        }}
      />
    </div>
  );
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminContent />
    </AdminAuthProvider>
  );
}
