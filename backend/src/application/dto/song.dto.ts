import { z } from 'zod';

export const CreateSongSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  artist: z.string().min(1, 'Artist is required').max(255),
  coverUrl: z.string().url().optional().or(z.literal('')),
  lyrics: z.string().optional(),
  isActive: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const UpdateSongSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  artist: z.string().min(1).max(255).optional(),
  coverUrl: z.string().url().optional().or(z.literal('')),
  lyrics: z.string().optional(),
  isActive: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export type CreateSongDto = z.infer<typeof CreateSongSchema>;
export type UpdateSongDto = z.infer<typeof UpdateSongSchema>;
