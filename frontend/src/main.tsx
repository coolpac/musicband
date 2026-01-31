import React, { useState, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppLoader from './components/AppLoader';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/base.css';
import './styles/home.css';

const AdminApp = lazy(() => import('./admin/AdminApp'));

const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');

function ClientRoot() {
  const [loaderReady, setLoaderReady] = useState(false);

  if (isAdminRoute) {
    return (
      <Suspense fallback={<div className="admin-loader">Загрузка...</div>}>
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
