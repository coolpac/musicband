import { z } from 'zod';

export const CreatePartnerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  logoUrl: z.string().url().optional().or(z.literal('')),
  link: z.string().url().optional().or(z.literal('')),
  order: z.number().int().min(0).optional(),
});

export const UpdatePartnerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  link: z.string().url().optional().or(z.literal('')),
  order: z.number().int().min(0).optional(),
});

export const ReorderPartnersSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'ids required'),
});

export type CreatePartnerDto = z.infer<typeof CreatePartnerSchema>;
export type UpdatePartnerDto = z.infer<typeof UpdatePartnerSchema>;
export type ReorderPartnersDto = z.infer<typeof ReorderPartnersSchema>;