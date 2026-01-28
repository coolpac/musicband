import { z } from 'zod';

export const CreatePosterSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  link: z.string().url().optional().or(z.literal('')),
});

export const UpdatePosterSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  link: z.string().url().optional().or(z.literal('')),
});

export type CreatePosterDto = z.infer<typeof CreatePosterSchema>;
export type UpdatePosterDto = z.infer<typeof UpdatePosterSchema>;
