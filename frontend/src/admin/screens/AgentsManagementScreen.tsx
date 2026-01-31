import { useState, useEffect, useMemo, useCallback } from 'react';
import AdminHeader from '../components/AdminHeader';
import '../../styles/admin.css';
import './AgentsManagementScreen.css';

const LOADING_DURATION_MS = 4500;
const MESSAGE_INTERVAL_MS = 680;

const LOADING_MESSAGES = [
  'вот вот...',
  'скоро...',
  'совсем чуть-чуть...',
  'почти...',
  'ещё секундочку...',
  'собираем агентов...',
  'агенты на подходе...',
  'уже почти готово...',
] as const;

export default function AgentsManagementScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = useMemo(() => LOADING_MESSAGES, []);

  const finishLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) return;

    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, MESSAGE_INTERVAL_MS);

    const doneTimer = setTimeout(finishLoading, LOADING_DURATION_MS);

    return () => {
      clearInterval(messageTimer);
      clearTimeout(doneTimer);
    };
  }, [isLoading, messages.length, finishLoading]);

  return (
    <div className="admin-screen agents-screen">
      <AdminHeader />
      <div className="admin-content">
        <h1 className="admin-title">Агенты (рефералы)</h1>

        {isLoading ? (
          <div className="agents-loading" role="status" aria-live="polite" aria-label="Загрузка раздела агентов">
            <div className="agents-loading__inner">
              <div className="agents-loading__icon" aria-hidden="true">
                <span className="agents-loading__dot" />
                <span className="agents-loading__dot" />
                <span className="agents-loading__dot" />
              </div>
              <p className="agents-loading__message" key={messageIndex}>
                {messages[messageIndex]}
              </p>
              <div className="agents-loading__bar">
                <div className="agents-loading__bar-fill" />
              </div>
            </div>
          </div>
        ) : (
          <div className="agents-placeholder">
            <div className="agents-placeholder__sticker" aria-hidden="true">
              <svg viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg" className="agents-laptop-sticker" fill="none">
                <defs>
                  <linearGradient id="agents-laptop-screen" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6B9BD1" />
                    <stop offset="100%" stopColor="#4A7AB8" />
                  </linearGradient>
                  <filter id="agents-laptop-shadow" x="-20%" y="-10%" width="140%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.15" />
                  </filter>
                </defs>
                <g filter="url(#agents-laptop-shadow)" className="agents-laptop-sticker__group">
                  <rect x="28" y="12" width="104" height="62" rx="4" fill="#3D3D3D" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <rect x="32" y="16" width="96" height="50" rx="2" fill="url(#agents-laptop-screen)" className="agents-laptop-sticker__screen" />
                  <rect x="36" y="20" width="88" height="6" rx="1" fill="rgba(255,255,255,0.4)" />
                  <rect x="36" y="30" width="60" height="4" rx="1" fill="rgba(255,255,255,0.25)" />
                  <rect x="36" y="36" width="70" height="4" rx="1" fill="rgba(255,255,255,0.2)" />
                  <path d="M24 76 h112 v8 H24 z" fill="#2D2D2D" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                  <rect x="68" y="78" width="24" height="4" rx="1" fill="#1a1a1a" />
                </g>
              </svg>
            </div>
            <p className="agents-placeholder__text">Раздел в разработке</p>
          </div>
        )}
      </div>
    </div>
  );
}
