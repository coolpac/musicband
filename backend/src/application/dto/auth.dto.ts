import { z } from 'zod';

export const TelegramAuthSchema = z.object({
  initData: z.string().min(1, 'InitData is required'),
  // nullish: фронтенд шлёт startParam: getStartParam(), который === null без deep-link.
  startParam: z.string().nullish(), // Для deep links (например, vote_{sessionId})
});

export const MaxAuthSchema = z.object({
  initData: z.string().min(1, 'InitData is required'),
  // nullish: см. TelegramAuthSchema — null допустим, когда deep-link отсутствует.
  startParam: z.string().nullish(), // Для deep links (например, vote_{sessionId})
});

export const AdminAuthSchema = z.object({
  telegramId: z.number().int().positive('Telegram ID must be positive'),
  password: z.string().min(1, 'Password is required'),
});

export type TelegramAuthDto = z.infer<typeof TelegramAuthSchema>;
export type MaxAuthDto = z.infer<typeof MaxAuthSchema>;
export type AdminAuthDto = z.infer<typeof AdminAuthSchema>;
