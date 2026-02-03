import { useTelegramWebApp } from '../../telegram/useTelegramWebApp';
import './LoginScreen.css';

export default function LoginScreen() {
  useTelegramWebApp({ initOnMount: true });

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-avatar" aria-hidden>
          <span className="login-avatar__letter">А</span>
        </div>
        <h1 className="login-title">Админ‑панель</h1>
        <p className="login-subtitle">
          Вход только через Telegram‑бота администратора.
        </p>
        <div className="login-hint">
          Откройте админку по ссылке из Admin Bot и Telegram автоматически передаст initData.
        </div>
        <p className="login-hint login-hint--refresh">
          Сменили аккаунт? Нажмите кнопку ниже — страница обновится и войдёт текущий пользователь Telegram.
        </p>
        <button type="button" className="login-refresh-btn" onClick={handleRefresh}>
          Обновить страницу и войти
        </button>
      </div>
    </div>
  );
}
