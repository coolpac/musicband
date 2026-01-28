import { z } from 'zod';

export const CastVoteSchema = z.object({
  songId: z.string().uuid('Invalid song ID'),
});

export const StartSessionSchema = z.object({
  songIds: z.array(z.string().uuid('Invalid song ID')).min(1, 'At least one song is required').max(20, 'Maximum 20 songs allowed'),
});

export type CastVoteDto = z.infer<typeof CastVoteSchema>;
export type StartSessionDto = z.infer<typeof StartSessionSchema>;
