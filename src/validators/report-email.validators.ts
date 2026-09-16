import { z } from 'zod';

export const reportEmailSchema = z.object({
  recipientEmail: z.string().trim().toLowerCase().email().max(254).optional(),
});

export type ReportEmailInput = z.infer<typeof reportEmailSchema>;