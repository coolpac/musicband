import { z } from 'zod';

export const CreateReferralLinkSchema = z.object({
  name: z.string().max(255).optional(),
  expiresAt: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
});

export type CreateReferralLinkDto = z.infer<typeof CreateReferralLinkSchema>;
