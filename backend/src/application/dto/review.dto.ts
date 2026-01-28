import { z } from 'zod';

export const CreateReviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  text: z.string().max(1000, 'Review text cannot exceed 1000 characters').optional(),
});

export type CreateReviewDto = z.infer<typeof CreateReviewSchema>;
