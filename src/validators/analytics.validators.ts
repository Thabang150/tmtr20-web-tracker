import { z } from 'zod';

const dateValue = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'Date must be valid');

export const analyticsDateRangeSchema = z.object({
  startDate: dateValue,
  endDate: dateValue,
}).refine(({ startDate, endDate }) => new Date(startDate) < new Date(endDate), {
  message: 'startDate must be before endDate',
  path: ['endDate'],
});

export type AnalyticsDateRangeInput = z.infer<typeof analyticsDateRangeSchema>;

export function toUtcDateRange(input: AnalyticsDateRangeInput): { start: Date; end: Date } {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);

  if (/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
    end.setUTCDate(end.getUTCDate() + 1);
  }

  return { start, end };
}