import { useEffect, useCallback } from 'react';
import {
  getTelegramWebApp,
  isInsideTelegram,
  initTelegramWebApp,
  hapticImpact,
  hapticSelection,
  hapticNotification,
} from './telegramWebApp';

export type HapticImpactStyle = 'light' | 'medium' | 'heavy';
export type HapticNotificationType = 'success' | 'warning' | 'error';

export function useTelegramWebApp(options?: { initOnMount?: boolean }) {
  const initOnMount = options?.initOnMount ?? true;

  useEffect(() => {
    if (!initOnMount || !isInsideTelegram()) return;
    initTelegramWebApp();
  }, [initOnMount]);

  const showBackButton = useCallback(() => {
    getTelegramWebApp()?.BackButton?.show();
  }, []);

  const hideBackButton = useCallback(() => {
    getTelegramWebApp()?.BackButton?.hide();
  }, []);

  const onBackButtonClick = useCallback((handler: () => void) => {
    const tg = getTelegramWebApp();
    if (!tg?.BackButton) return () => {};
    tg.BackButton.onClick(handler);
    return () => tg.BackButton.offClick(handler);
  }, []);

  return {
    isTelegram: isInsideTelegram(),
    webApp: getTelegramWebApp(),
    showBackButton,
    hideBackButton,
    onBackButtonClick,
    haptic: {
      impact: hapticImpact,
      selection: hapticSelection,
      notification: hapticNotification,
    },
  };
}
