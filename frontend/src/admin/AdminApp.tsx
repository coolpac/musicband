import { useState, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import TabBar, { AdminTab } from './components/TabBar';
import '../styles/admin.css';
import '../styles/admin-tabbar.css';

const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const VotingManagementScreen = lazy(() => import('./screens/VotingManagementScreen'));
const SongsManagementScreen = lazy(() => import('./screens/SongsManagementScreen'));
const BookingsManagementScreen = lazy(() => import('./screens/BookingsManagementScreen'));
const BookingsLogScreen = lazy(() => import('./screens/BookingsLogScreen'));
const ContentScreen = lazy(() => import('./screens/ContentScreen'));
const AgentsManagementScreen = lazy(() => import('./screens/AgentsManagementScreen'));
const ReviewsManagementScreen = lazy(() => import('./screens/ReviewsManagementScreen'));

export type BookingsView = 'log' | 'calendar';

export default function AdminApp() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [bookingsView, setBookingsView] = useState<BookingsView>('log');

  const goToBookingsLog = () => {
    setBookingsView('log');
    setActiveTab('bookings');
  };

  const renderScreen = () => {
    const fallback = <div className="admin-screen-loader">Загрузка...</div>;

    switch (activeTab) {
      case 'dashboard':
        return (
          <ErrorBoundary>
            <Suspense fallback={fallback}>
              <DashboardScreen
                onGoToBookings={goToBookingsLog}
                onGoToAgents={() => setActiveTab('agents')}
                onGoToReviews={() => setActiveTab('reviews')}
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
