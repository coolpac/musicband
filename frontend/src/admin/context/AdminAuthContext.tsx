import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from 'react';
import { apiGet, apiPost } from '../../services/apiClient';
import { getTelegramWebApp } from '../../telegram/telegramWebApp';

const API_BASE = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '';
const TOKEN_KEY = 'admin_token';

export type AdminUser = {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: string;
};

export type AdminAuthState = {
  /** Авторизован ли пользователь */
  isAuthenticated: boolean;
  /** Данные пользователя */
  user: AdminUser | null;
  /** Полный URL для загрузки аватарки (GET с cookies) */
  avatarUrl: string | null;
  /** Буква для плейсхолдера, если аватарки нет */
  avatarLetter: string;
  /** Загрузка (проверка токена) */
  loading: boolean;
  /** Функция выхода */
  logout: () => void;
};

const defaultState: AdminAuthState = {
  isAuthenticated: false,
  user: null,
  avatarUrl: null,
  avatarLetter: 'А',
  loading: true,
  logout: () => {},
};

const AdminAuthContext = createContext<AdminAuthState>(defaultState);

/** Получить токен из localStorage */
export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Сохранить токен в localStorage */
function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Удалить токен из localStorage */
function removeAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUserAndToken = useCallback((userData: AdminUser, token: string, avatar?: string) => {
    setAdminToken(token);
    setUser(userData);
    setAvatarUrl(avatar ?? null);
    setIsAuthenticated(true);
  }, []);

  // Проверка авторизации при загрузке
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      // 1. Если есть initData от Admin Bot — авторизуемся по нему
      const tg = getTelegramWebApp();
      const initData = tg?.initData;

      if (initData && initData.length > 0) {
        try {
          const response = await apiPost<{ user: AdminUser; token: string }>('/api/auth/telegram', {
            initData,
            startParam: tg?.initDataUnsafe?.start_param,
          });

          if (cancelled) return;

          if (response.user.role !== 'admin') {
            removeAdminToken();
            setLoading(false);
            return;
          }

          const url = API_BASE ? `${API_BASE.replace(/\/$/, '')}/api/auth/me/avatar` : '/api/auth/me/avatar';
          applyUserAndToken(response.user, response.token, url);
        } catch {
          removeAdminToken();
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      // 2. Иначе проверяем сохранённый токен
      const token = getAdminToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiGet<{ userId: string; telegramId: string; role: string }>('/api/auth/me');
        if (cancelled) return;

        if (data.role !== 'admin') {
          removeAdminToken();
          setLoading(false);
          return;
        }

        const url = API_BASE ? `${API_BASE.replace(/\/$/, '')}/api/auth/me/avatar` : '/api/auth/me/avatar';
        applyUserAndToken(
          { id: data.userId, telegramId: data.telegramId, role: data.role },
          token,
          url
        );
      } catch {
        removeAdminToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [applyUserAndToken]);

  const logout = useCallback(() => {
    removeAdminToken();
    setUser(null);
    setAvatarUrl(null);
    setIsAuthenticated(false);
  }, []);

  const avatarLetter = user?.firstName?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'А';

  const value = useMemo<AdminAuthState>(() => ({
    isAuthenticated,
    user,
    avatarUrl,
    avatarLetter,
    loading,
    logout,
  }), [isAuthenticated, user, avatarUrl, avatarLetter, loading, logout]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  return useContext(AdminAuthContext);
}
