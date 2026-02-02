import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import TabBar, { AdminTab } from './components/TabBar';
import AdminTerminalLoader, { MIN_LOADER_DISPLAY_MS } from './components/AdminTerminalLoader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import LoginScreen from './screens/LoginScreen';
import '../styles/admin.css';
import '../styles/admin-tabbar.css';

function DelayedContent({
  delay,
  children,
}: {
  delay: number;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!ready) return <AdminTerminalLoader />;
  return <>{children}</>;
}

const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const VotingManagementScreen = lazy(() => import('./screens/VotingManagementScreen'));
const SongsManagementScreen = lazy(() => import('./screens/SongsManagementScreen'));
const BookingsManagementScreen = lazy(() => import('./screens/BookingsManagementScreen'));
const BookingsLogScreen = lazy(() => import('./screens/BookingsLogScreen'));
const ContentScreen = lazy(() => import('./screens/ContentScreen'));
const AgentsManagementScreen = lazy(() => import('./screens/AgentsManagementScreen'));
const ReviewsManagementScreen = lazy(() => import('./screens/ReviewsManagementScreen'));

export type BookingsView = 'log' | 'calendar';

function AdminContent() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [bookingsView, setBookingsView] = useState<BookingsView>('log');
  const { isAuthenticated, loading, login } = useAdminAuth();
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (telegramId: string, password: string) => {
    setLoginError(null);
    try {
      await login(telegramId, password);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid credentials') || error.message.includes('Access denied')) {
          setLoginError('Неверный Telegram ID или пароль');
        } else {
          setLoginError(error.message);
        }
      } else {
        setLoginError('Ошибка авторизации');
      }
    }
  };

  // Показываем загрузку пока проверяем токен
  if (loading) {
    return <AdminTerminalLoader />;
  }

  // Не авторизован — показываем логин
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />;
  }

  const goToBookingsLog = () => {
    setBookingsView('log');
    setActiveTab('bookings');
  };

  const renderScreen = () => {
    const fallback = <AdminTerminalLoader />;
    const delay = MIN_LOADER_DISPLAY_MS;

    switch (activeTab) {
      case 'dashboard':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <DelayedContent delay={delay}>
                <DashboardScreen
                  onGoToBookings={goToBookingsLog}
                  onGoToAgents={() => setActiveTab('agents')}
                  onGoToReviews={() => setActiveTab('reviews')}
                />
              </DelayedContent>
            </Suspense>
          </ErrorBoundary>
        );

      case 'voting':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <DelayedContent delay={delay}>
                <VotingManagementScreen />
              </DelayedContent>
            </Suspense>
          </ErrorBoundary>
        );

      case 'songs':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <DelayedContent delay={delay}>
                <SongsManagementScreen />
              </DelayedContent>
            </Suspense>
          </ErrorBoundary>
        );

      case 'bookings':
        return bookingsView === 'log' ? (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <DelayedContent delay={delay}>
                <BookingsLogScreen onGoToCalendar={() => setBookingsView('calendar')} />
              </DelayedContent>
            </Suspense>
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <DelayedContent delay={delay}>
                <BookingsManagementScreen onGoToLog={() => setBookingsView('log')} />
              </DelayedContent>
            </Suspense>
          </ErrorBoundary>
        );

      case 'content':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <DelayedContent delay={delay}>
                <ContentScreen />
              </DelayedContent>
            </Suspense>
          </ErrorBoundary>
        );

      case 'agents':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <DelayedContent delay={delay}>
                <AgentsManagementScreen />
              </DelayedContent>
            </Suspense>
          </ErrorBoundary>
        );

      case 'reviews':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <DelayedContent delay={delay}>
                <ReviewsManagementScreen />
              </DelayedContent>
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
