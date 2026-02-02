import { useState, type FormEvent } from 'react';
import FlexGuardLogo from '../components/FlexGuardLogo';
import './LoginScreen.css';

type LoginScreenProps = {
  onLogin: (telegramId: string, password: string) => Promise<void>;
  error: string | null;
};

export default function LoginScreen({ onLogin, error }: LoginScreenProps) {
  const [telegramId, setTelegramId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!telegramId.trim() || !password.trim()) return;

    setLoading(true);
    try {
      await onLogin(telegramId.trim(), password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <FlexGuardLogo />
        </div>
        <h1 className="login-title">Вход в админ-панель</h1>
        <p className="login-subtitle">Введите ваш Telegram ID и пароль</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="telegramId">Telegram ID</label>
            <input
              id="telegramId"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="123456789"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="login-button"
            disabled={loading || !telegramId.trim() || !password.trim()}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <p className="login-hint">
          Узнать свой Telegram ID можно у бота <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer">@userinfobot</a>
        </p>
      </div>
    </div>
  );
}
