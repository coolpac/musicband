import React, { useState, useEffect, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppLoader from './components/AppLoader';
import AdminTerminalLoader, { MIN_LOADER_DISPLAY_MS } from './admin/components/AdminTerminalLoader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initTelegramWebApp, isInsideTelegram } from './telegram/telegramWebApp';
import './styles/base.css';
import './styles/home.css';
import './styles/admin.css';

const AdminApp = lazy(() => import('./admin/AdminApp'));

const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');

function ClientRoot() {
  const [loaderReady, setLoaderReady] = useState(false);
  const [minLoaderElapsed, setMinLoaderElapsed] = useState(false);

  useEffect(() => {
    if (isAdminRoute) {
      if (isInsideTelegram()) initTelegramWebApp();
      const t = setTimeout(() => setMinLoaderElapsed(true), MIN_LOADER_DISPLAY_MS);
      return () => clearTimeout(t);
    }
    // Основное приложение: сразу сообщаем Telegram ready(), чтобы скрыть сплэш и показать наш лоадер
    if (isInsideTelegram()) initTelegramWebApp();
  }, [isAdminRoute]);

  if (isAdminRoute) {
    if (!minLoaderElapsed) {
      return <AdminTerminalLoader />;
    }
    return (
      <Suspense fallback={<AdminTerminalLoader />}>
        <AdminApp />
      </Suspense>
    );
  }

  if (!loaderReady) {
    return <AppLoader onReady={() => setLoaderReady(true)} />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClientRoot />
    </ErrorBoundary>
  </React.StrictMode>
);
