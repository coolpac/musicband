import { z } from 'zod';

export const CastVoteSchema = z.object({
  songId: z.string().uuid('Invalid song ID'),
});

/** Временное решение: голосование по telegramId без проверки initData. Небезопасно — telegramId можно подставить. */
export const PublicCastVoteSchema = z.object({
  songId: z.string().uuid('Invalid song ID'),
  telegramId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  sessionId: z.string().uuid('Invalid session ID').optional(),
});

/** Голосование с проверкой initData (Admin Bot или User Bot). Возвращает JWT для сокета. */
export const VoteWithInitDataSchema = z.object({
  initData: z.string().min(1, 'InitData is required'),
  songId: z.string().uuid('Invalid song ID'),
  sessionId: z.string().uuid('Invalid session ID').optional(),
});

export const StartSessionSchema = z.object({
  songIds: z
    .array(z.string().uuid('Invalid song ID'))
    .min(1, 'At least one song is required')
    .max(20, 'Maximum 20 songs allowed'),
});

export type CastVoteDto = z.infer<typeof CastVoteSchema>;
export type PublicCastVoteDto = z.infer<typeof PublicCastVoteSchema>;
export type StartSessionDto = z.infer<typeof StartSessionSchema>;
