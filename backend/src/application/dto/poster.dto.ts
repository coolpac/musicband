import { z } from 'zod';

/** URL (с протоколом) или относительный путь вида /uploads/... */
const urlOrPath = z.union([
  z.string().url(),
  z
    .string()
    .min(1)
    .refine((s) => s.startsWith('/'), { message: 'Must be URL or path starting with /' }),
]);

export const CreatePosterSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  imageUrl: z.union([urlOrPath, z.literal('')]).optional(),
  link: z.string().url().optional().or(z.literal('')),
});

export const UpdatePosterSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  imageUrl: z.union([urlOrPath, z.literal('')]).optional(),
  link: z.string().url().optional().or(z.literal('')),
});

export type CreatePosterDto = z.infer<typeof CreatePosterSchema>;
export type UpdatePosterDto = z.infer<typeof UpdatePosterSchema>;
