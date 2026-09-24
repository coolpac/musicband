import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import TabBar, { AdminTab, DEFAULT_TAB_BY_MODE } from './components/TabBar';
import AdminTerminalLoader, { MIN_LOADER_DISPLAY_MS } from './components/AdminTerminalLoader';
import { SectionLoader } from './components/SectionLoader';
import AdminHeader from './components/AdminHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import LoginScreen from './screens/LoginScreen';
import {
  AdminModeProvider,
  persistAdminMode,
  readInitialAdminMode,
  type AdminMode,
  type AdminModeContextValue,
  type AdminUnsavedGuard,
} from './site/AdminModeContext';
import ConfirmDialog from './site/ConfirmDialog';
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
const PostersManagementScreen = lazy(() => import('./screens/PostersManagementScreen'));

/** Экраны режима «Сайт» грузятся отдельными чанками только при первом переходе в этот режим. */
const SiteContentScreen = lazy(() => import('./site/SiteContentScreen'));
const SiteSeoScreen = lazy(() => import('./site/SiteSeoScreen'));

export type BookingsView = 'log' | 'calendar';

function AdminContent() {
  useTelegramWebApp({ initOnMount: true });
  const [mode, setMode] = useState<AdminMode>(() => readInitialAdminMode());
  /** Вкладка запоминается для каждого режима отдельно — обратно возвращаемся туда, где были. */
  const [appTab, setAppTab] = useState<AdminTab>(DEFAULT_TAB_BY_MODE.app);
  const [siteTab, setSiteTab] = useState<AdminTab>(DEFAULT_TAB_BY_MODE.site);
  const [siteMounted, setSiteMounted] = useState(() => mode === 'site');
  const [bookingsView, setBookingsView] = useState<BookingsView>('log');
  /** При переходе с дашборда по карточке статуса — открыть лог с этим фильтром (сбрасывается после монтирования лога) */
  const [initialBookingsLogStatus, setInitialBookingsLogStatus] = useState<'pending' | 'confirmed' | 'cancelled' | null>(null);
  const { isAuthenticated, loading } = useAdminAuth();

  const activeTab = mode === 'app' ? appTab : siteTab;

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

  useEffect(() => {
    persistAdminMode(mode);
  }, [mode]);

  /* ── Несохранённые изменения: экраны-редакторы регистрируют «замок» ── */
  const guardsRef = useRef<Set<AdminUnsavedGuard>>(new Set());
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  const registerUnsavedGuard = useCallback((guard: AdminUnsavedGuard) => {
    guardsRef.current.add(guard);
    return () => {
      guardsRef.current.delete(guard);
    };
  }, []);

  const requestNavigation = useCallback((action: () => void) => {
    const hasUnsaved = Array.from(guardsRef.current).some((guard) => {
      try {
        return guard.hasUnsavedChanges();
      } catch {
        return false;
      }
    });
    if (hasUnsaved) {
      setPendingNavigation(() => action);
      return;
    }
    action();
  }, []);

  const confirmNavigation = useCallback(() => {
    const action = pendingNavigation;
    guardsRef.current.forEach((guard) => {
      try {
        guard.discardChanges();
      } catch {
        /* экран уже размонтирован — игнорируем */
      }
    });
    setPendingNavigation(null);
    action?.();
  }, [pendingNavigation]);

  const requestMode = useCallback(
    (next: AdminMode) => {
      if (next === mode) return;
      requestNavigation(() => {
        if (next === 'site') setSiteMounted(true);
        setMode(next);
      });
    },
    [mode, requestNavigation]
  );

  const handleTabChange = useCallback(
    (tab: AdminTab) => {
      if (mode === 'app') {
        // Повторный тап по «Броням» возвращает календарь — историческое поведение, сохраняем.
        requestNavigation(() => {
          if (tab === 'bookings') setBookingsView('calendar');
          setAppTab(tab);
        });
        return;
      }
      // Тап по уже открытой вкладке ничего не меняет — спрашивать про несохранённые правки не за что.
      if (tab === siteTab) return;
      requestNavigation(() => setSiteTab(tab));
    },
    [mode, siteTab, requestNavigation]
  );

  const modeContextValue = useMemo<AdminModeContextValue>(
    () => ({ mode, requestMode, registerUnsavedGuard }),
    [mode, requestMode, registerUnsavedGuard]
  );

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

  const goToBookingsLog = (statusFilter?: 'pending' | 'confirmed' | 'cancelled') => {
    if (statusFilter != null) setInitialBookingsLogStatus(statusFilter);
    setBookingsView('log');
    setAppTab('bookings');
  };

  const fallback = <AdminScreenShell />;

  const hide = { display: 'none' as const };
  const show = { display: 'block' as const };
  const appVisible = (tab: AdminTab) => (appTab === tab ? show : hide);
  const siteVisible = (tab: AdminTab) => (siteTab === tab ? show : hide);

  return (
    <AdminModeProvider value={modeContextValue}>
      <div className="admin-app">
        {/* Группа режима «Приложение» скрывается целиком: иначе её Suspense-заглушка
            наложилась бы на экраны сайта, когда админка открыта сразу в режиме «Сайт». */}
        <div style={mode === 'app' ? show : hide}>
          <Suspense fallback={fallback}>
            <div style={appVisible('dashboard')}>
              <ErrorBoundary>
                <DashboardScreen
                  onGoToBookings={() => goToBookingsLog()}
                  onGoToBookingsLogWithStatus={goToBookingsLog}
                  onGoToAgents={() => setAppTab('agents')}
                  onGoToReviews={() => setAppTab('reviews')}
                  onGoToAnalytics={() => setAppTab('analytics')}
                />
              </ErrorBoundary>
            </div>
            <div style={appVisible('voting')}>
              <ErrorBoundary>
                <VotingManagementScreen />
              </ErrorBoundary>
            </div>
            <div style={appVisible('songs')}>
              <ErrorBoundary>
                <SongsManagementScreen />
              </ErrorBoundary>
            </div>
            <div style={appTab === 'bookings' && bookingsView === 'log' ? show : hide}>
              <ErrorBoundary>
                <BookingsLogScreen
                  onGoToCalendar={() => setBookingsView('calendar')}
                  initialStatusFilter={initialBookingsLogStatus}
                  onConsumeInitialFilter={() => setInitialBookingsLogStatus(null)}
                />
              </ErrorBoundary>
            </div>
            <div style={appTab === 'bookings' && bookingsView === 'calendar' ? show : hide}>
              <ErrorBoundary>
                <BookingsManagementScreen onGoToLog={() => setBookingsView('log')} />
              </ErrorBoundary>
            </div>
            <div style={appVisible('content')}>
              <ErrorBoundary>
                <ContentScreen />
              </ErrorBoundary>
            </div>
            <div style={appVisible('agents')}>
              <ErrorBoundary>
                <AgentsManagementScreen />
              </ErrorBoundary>
            </div>
            <div style={appVisible('reviews')}>
              <ErrorBoundary>
                <ReviewsManagementScreen />
              </ErrorBoundary>
            </div>
            <div style={appVisible('analytics')}>
              <ErrorBoundary>
                <ExtendedAnalyticsScreen />
              </ErrorBoundary>
            </div>
          </Suspense>
        </div>

        {/* Режим «Сайт»: монтируется при первом переходе, дальше живёт рядом (keep-alive).
            У каждого экрана свои Suspense и ErrorBoundary — ошибка или медленный чанк
            одного экрана не гасит остальные. */}
        {siteMounted && (
          <div style={mode === 'site' ? show : hide}>
            <div style={siteVisible('site-content')}>
              <ErrorBoundary>
                <Suspense fallback={fallback}>
                  <SiteContentScreen active={mode === 'site' && siteTab === 'site-content'} />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div style={siteVisible('site-posters')}>
              <ErrorBoundary>
                <Suspense fallback={fallback}>
                  <PostersManagementScreen />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div style={siteVisible('site-bookings')}>
              <ErrorBoundary>
                <Suspense fallback={fallback}>
                  <BookingsLogScreen initialOriginFilter="website" />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div style={siteVisible('site-seo')}>
              <ErrorBoundary>
                <Suspense fallback={fallback}>
                  <SiteSeoScreen active={mode === 'site' && siteTab === 'site-seo'} />
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>
        )}

        <TabBar mode={mode} activeTab={activeTab} onTabChange={handleTabChange} />

        <ConfirmDialog
          open={pendingNavigation !== null}
          title="Несохранённые изменения"
          message="В редакторе сайта остались правки, которые ещё не сохранены. Уйти и потерять их?"
          confirmLabel="Уйти без сохранения"
          cancelLabel="Остаться"
          danger
          onCancel={() => setPendingNavigation(null)}
          onConfirm={confirmNavigation}
        />

        <Toaster
          position="top-center"
          containerClassName="admin-toaster"
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
    </AdminModeProvider>
  );
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminContent />
    </AdminAuthProvider>
  );
}
