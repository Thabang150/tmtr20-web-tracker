import { z } from 'zod';

export const monthlyReportPeriodSchema = z.object({
  periodStart: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'periodStart must be a valid date'),
  periodEnd: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'periodEnd must be a valid date'),
}).refine(({ periodStart, periodEnd }) => new Date(periodStart) < new Date(periodEnd), {
  message: 'periodStart must be before periodEnd',
  path: ['periodEnd'],
});

export type MonthlyReportPeriodInput = z.infer<typeof monthlyReportPeriodSchema>;