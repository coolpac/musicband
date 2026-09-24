import { defineConfig } from 'vitest/config';

// Минимальная конфигурация vitest, изолированная под платформенный фасад.
// Тесты используют jsdom (нужен window/document для мокинга глобалов Telegram/Max).
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
