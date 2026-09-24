import { z } from 'zod';

/** URL (с протоколом) или относительный путь вида /uploads/... */
const urlOrPath = z.union([
  z.string().url(),
  z
    .string()
    .min(1)
    .refine((s) => s.startsWith('/'), { message: 'Must be URL or path starting with /' }),
]);

/** Дата события афиши: 'YYYY-MM-DD' либо null (баннер без даты). */
const eventDate = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    z.literal(''),
    z.null(),
  ])
  .optional();

/** Площадка/время свободным текстом; null или '' — очистить. */
const venue = z.union([z.string().max(255), z.null()]).optional();

export const CreatePosterSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  imageUrl: z.union([urlOrPath, z.literal('')]).optional(),
  link: z.string().url().optional().or(z.literal('')),
  order: z.number().int().min(0).optional(),
  eventDate,
  venue,
});

export const UpdatePosterSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  imageUrl: z.union([urlOrPath, z.literal('')]).optional(),
  link: z.string().url().optional().or(z.literal('')),
  order: z.number().int().min(0).optional(),
  eventDate,
  venue,
});

export type CreatePosterDto = z.infer<typeof CreatePosterSchema>;
export type UpdatePosterDto = z.infer<typeof UpdatePosterSchema>;
