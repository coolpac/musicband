import { z } from 'zod';

export const TelegramAuthSchema = z.object({
  initData: z.string().min(1, 'InitData is required'),
  startParam: z.string().optional(), // Для deep links (например, vote_{sessionId})
});

export const AdminAuthSchema = z.object({
  telegramId: z.number().int().positive('Telegram ID must be positive'),
  password: z.string().min(1, 'Password is required'),
});

export type TelegramAuthDto = z.infer<typeof TelegramAuthSchema>;
export type AdminAuthDto = z.infer<typeof AdminAuthSchema>;
