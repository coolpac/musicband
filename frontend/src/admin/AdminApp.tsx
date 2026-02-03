import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import TabBar, { AdminTab } from './components/TabBar';
import AdminTerminalLoader, { MIN_LOADER_DISPLAY_MS } from './components/AdminTerminalLoader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import LoginScreen from './screens/LoginScreen';
import { useTelegramWebApp } from '../telegram/useTelegramWebApp';
import '../styles/admin.css';
import '../styles/admin-tabbar.css';

/** Лёгкий спиннер для Suspense при переключении табов (после первого входа) */
function LightLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40vh',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid rgba(255,255,255,0.15)',
        borderTopColor: 'rgba(255,255,255,0.7)',
        borderRadius: '50%',
        animation: 'spin .6s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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

  // После первого входа — лёгкий спиннер для Suspense
  const fallback = <LightLoader />;

  const renderScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <DashboardScreen
                onGoToBookings={goToBookingsLog}
                onGoToAgents={() => setActiveTab('agents')}
                onGoToReviews={() => setActiveTab('reviews')}
                onGoToAnalytics={() => setActiveTab('analytics')}
              />
            </Suspense>
          </ErrorBoundary>
        );

      case 'voting':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <VotingManagementScreen />
            </Suspense>
          </ErrorBoundary>
        );

      case 'songs':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <SongsManagementScreen />
            </Suspense>
          </ErrorBoundary>
        );

      case 'bookings':
        return bookingsView === 'log' ? (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <BookingsLogScreen onGoToCalendar={() => setBookingsView('calendar')} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <BookingsManagementScreen onGoToLog={() => setBookingsView('log')} />
            </Suspense>
          </ErrorBoundary>
        );

      case 'content':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <ContentScreen />
            </Suspense>
          </ErrorBoundary>
        );

      case 'agents':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <AgentsManagementScreen />
            </Suspense>
          </ErrorBoundary>
        );

      case 'reviews':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <ReviewsManagementScreen />
            </Suspense>
          </ErrorBoundary>
        );

      case 'analytics':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <ExtendedAnalyticsScreen />
            </Suspense>
          </ErrorBoundary>
        );

      default:
        return null;
    }
  };

  return (
    <div className="admin-app">
      {renderScreen()}
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
