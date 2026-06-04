import React, { useState, useEffect, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppLoader from './components/AppLoader';
import AdminTerminalLoader, { MIN_LOADER_DISPLAY_MS } from './admin/components/AdminTerminalLoader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { init as initPlatform, isInsideMiniApp } from './platform/platform';
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
      if (isInsideMiniApp()) initPlatform();
      const t = setTimeout(() => setMinLoaderElapsed(true), MIN_LOADER_DISPLAY_MS);
      return () => clearTimeout(t);
    }
    // Основное приложение: сразу сообщаем платформе ready(), чтобы скрыть сплэш и показать наш лоадер
    if (isInsideMiniApp()) initPlatform();
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

// ВРЕМЕННАЯ ДИАГНОСТИКА: сообщаем на бэкенд, что реально отдаёт Mini App SDK
// внутри Max (чтобы понять пустой initData). Шлём дважды — SDK грузится async.
function sendClientInfo(tag: string): void {
  try {
    const w = window as unknown as {
      Telegram?: { WebApp?: { initData?: unknown; initDataUnsafe?: { user?: unknown } } };
      WebApp?: { initData?: unknown; initDataUnsafe?: Record<string, unknown> };
    };
    const tg = w.Telegram?.WebApp;
    const wa = w.WebApp;
    const body = {
      tag,
      ua: navigator.userAgent,
      href: location.href,
      hasTelegram: !!tg,
      tgInitDataLen: typeof tg?.initData === 'string' ? (tg.initData as string).length : 0,
      tgHasUser: !!tg?.initDataUnsafe?.user,
      hasWebApp: !!wa,
      webAppKeys: wa ? Object.keys(wa).slice(0, 50) : null,
      maxInitDataType: wa ? typeof wa.initData : 'no-webapp',
      maxInitDataLen: typeof wa?.initData === 'string' ? (wa.initData as string).length : 0,
      maxUnsafeKeys: wa?.initDataUnsafe ? Object.keys(wa.initDataUnsafe) : null,
      maxHasUser: !!wa?.initDataUnsafe?.user,
    };
    fetch('/api/debug/clientinfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
setTimeout(() => sendClientInfo('t1500'), 1500);
setTimeout(() => sendClientInfo('t4000'), 4000);
