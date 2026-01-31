import { z } from 'zod';

const FormatStatusSchema = z.enum(['available', 'hidden']);

export const CreateFormatSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  imageUrl: z.string().optional(),
  suitableFor: z.unknown().optional(),
  performers: z.unknown().optional(),
  status: FormatStatusSchema.optional(),
  order: z.number().int().min(0).optional(),
});

export const UpdateFormatSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  imageUrl: z.string().optional(),
  suitableFor: z.unknown().optional(),
  performers: z.unknown().optional(),
  status: FormatStatusSchema.optional(),
  order: z.number().int().min(0).optional(),
});

export type CreateFormatDto = z.infer<typeof CreateFormatSchema>;
export type UpdateFormatDto = z.infer<typeof UpdateFormatSchema>;
