import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { apiGet } from '../../services/apiClient';

const API_BASE = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '';

export type AdminAuthState = {
  /** Полный URL для загрузки аватарки (GET с cookies) */
  avatarUrl: string | null;
  /** Буква для плейсхолдера, если аватарки нет */
  avatarLetter: string;
  loading: boolean;
};

const defaultState: AdminAuthState = {
  avatarUrl: null,
  avatarLetter: 'А',
  loading: true,
};

const AdminAuthContext = createContext<AdminAuthState>(defaultState);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminAuthState>(defaultState);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiGet<{ userId: string; telegramId: string; role: string; avatarUrl?: string }>(
          '/api/auth/me'
        );
        if (cancelled) return;

        const avatarUrl = data?.avatarUrl
          ? (API_BASE ? `${API_BASE.replace(/\/$/, '')}${data.avatarUrl}` : data.avatarUrl)
          : null;

        setState({
          avatarUrl,
          avatarLetter: 'А',
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => state, [state.avatarUrl, state.avatarLetter, state.loading]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  return useContext(AdminAuthContext);
}
