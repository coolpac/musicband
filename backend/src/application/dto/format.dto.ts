import { z } from 'zod';

export const CreateFormatSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
});

export const UpdateFormatSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

export type CreateFormatDto = z.infer<typeof CreateFormatSchema>;
export type UpdateFormatDto = z.infer<typeof UpdateFormatSchema>;
