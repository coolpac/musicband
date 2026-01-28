import { z } from 'zod';

export const CreateBookingSchema = z.object({
  formatId: z.string().uuid().optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  fullName: z.string().min(2, 'Full name is required').max(255),
  contactType: z.string().optional(),
  contactValue: z.string().min(5, 'Contact value is required').max(255),
  city: z.string().max(255).optional(),
  source: z.string().max(255).optional(),
  referralCode: z.string().optional(),
});

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(['confirmed', 'cancelled']),
});

export const UpdateBookingIncomeSchema = z.object({
  income: z.number().min(0, 'Income cannot be negative'),
});

export const BlockDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z.string().optional(),
});

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingStatusDto = z.infer<typeof UpdateBookingStatusSchema>;
export type UpdateBookingIncomeDto = z.infer<typeof UpdateBookingIncomeSchema>;
export type BlockDateDto = z.infer<typeof BlockDateSchema>;
