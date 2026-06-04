import { afterEach, describe, expect, it, vi } from 'vitest';

// Тестируем платформенный фасад: детекцию платформы и делегирование
// getInitData/getStartParam/getUserId к правильному источнику (Telegram vs Max).

// Модуль читает window.Telegram / window.WebApp лениво, поэтому модуль
// импортируется свежим в каждом тесте через resetModules + dynamic import.

function setTelegram(value: unknown): void {
  window.Telegram = value as Window['Telegram'];
}

function setMax(value: unknown): void {
  window.WebApp = value as Window['WebApp'];
}

function clearGlobals(): void {
  delete window.Telegram;
  delete window.WebApp;
}

async function importPlatform() {
  vi.resetModules();
  return import('../platform');
}

const fakeTelegramWebApp = {
  initData: 'tg-init-data',
  initDataUnsafe: {
    user: { id: 111, first_name: 'Tg', last_name: 'User', username: 'tg_user' },
    start_param: 'tg-start',
  },
  version: '8.0',
  platform: 'tdesktop',
  themeParams: {},
  ready: () => {},
  expand: () => {},
  isVersionAtLeast: () => true,
  BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
  HapticFeedback: { impactOccurred: () => {}, selectionChanged: () => {}, notificationOccurred: () => {} },
};

const fakeMaxWebApp = {
  initData: 'max-init-data',
  initDataUnsafe: {
    user: { id: 222, first_name: 'Max', last_name: 'User', username: 'max_user' },
    start_param: 'max-start',
  },
  version: '1.0',
  platform: 'max-android',
  openLink: () => {},
  openMaxLink: () => {},
  BackButton: { show: () => {}, onClick: () => {} },
};

afterEach(() => {
  clearGlobals();
  vi.restoreAllMocks();
});

describe('getPlatform detection', () => {
  it('returns "max" when window.WebApp looks like the Max SDK', async () => {
    setMax(fakeMaxWebApp);
    const { getPlatform } = await importPlatform();
    expect(getPlatform()).toBe('max');
  });

  it('returns "telegram" when window.Telegram.WebApp is present', async () => {
    setTelegram({ WebApp: fakeTelegramWebApp });
    const { getPlatform } = await importPlatform();
    expect(getPlatform()).toBe('telegram');
  });

  it('returns "web" when neither global is present', async () => {
    const { getPlatform } = await importPlatform();
    expect(getPlatform()).toBe('web');
  });

  it('prefers "telegram" when BOTH have a real session', async () => {
    setTelegram({ WebApp: fakeTelegramWebApp });
    setMax(fakeMaxWebApp);
    const { getPlatform } = await importPlatform();
    expect(getPlatform()).toBe('telegram');
  });

  // Регрессия: telegram-web-app.js определяет window.Telegram.WebApp ВСЕГДА
  // (даже внутри Max), но без сессии. Раньше getPlatform по факту наличия объекта
  // возвращал 'telegram' → /api/auth/max не вызывался → 0 Max-юзеров.
  it('returns "max" when Telegram SDK is loaded WITHOUT a session but Max HAS one', async () => {
    setTelegram({ WebApp: { initData: '', initDataUnsafe: {}, ready() {}, expand() {} } });
    setMax(fakeMaxWebApp);
    const { getPlatform } = await importPlatform();
    expect(getPlatform()).toBe('max');
  });
});

describe('facade delegation per platform', () => {
  it('delegates to Telegram source inside Telegram', async () => {
    setTelegram({ WebApp: fakeTelegramWebApp });
    const { getInitData, getStartParam, getUserId, isInsideMiniApp } = await importPlatform();
    expect(isInsideMiniApp()).toBe(true);
    expect(getInitData()).toBe('tg-init-data');
    expect(getStartParam()).toBe('tg-start');
    expect(getUserId()).toBe(111);
  });

  it('delegates to Max source inside Max', async () => {
    setMax(fakeMaxWebApp);
    const { getInitData, getStartParam, getUserId, isInsideMiniApp } = await importPlatform();
    expect(isInsideMiniApp()).toBe(true);
    expect(getInitData()).toBe('max-init-data');
    expect(getStartParam()).toBe('max-start');
    expect(getUserId()).toBe(222);
  });

  it('isInsideMiniApp is false on plain web', async () => {
    const { isInsideMiniApp, getInitData, getUserId } = await importPlatform();
    expect(isInsideMiniApp()).toBe(false);
    expect(getInitData()).toBeNull();
    expect(getUserId()).toBeNull();
  });
});
