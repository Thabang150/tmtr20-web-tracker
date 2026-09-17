import { z } from 'zod';
import { EVENT_NAMES } from '../models/event.model.js';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const clickMetadataSchema = z.object({
  x: z.number().int().min(0).max(10000),
  y: z.number().int().min(0).max(10000),
  viewportX: z.number().int().min(0).max(10000),
  viewportY: z.number().int().min(0).max(10000),
  scrollPercent: z.number().int().min(0).max(100),
  targetTag: z.string().trim().max(30),
  targetId: z.string().trim().max(100).optional(),
}).strict();

export const trackEventSchema = z.object({
  eventId: z.string().trim().min(1).max(200).optional(),
  trackingId: z.string().trim().regex(/^tmtr_[a-f0-9]{32}$/),
  visitorId: z.string().trim().min(1).max(200),
  sessionId: z.string().trim().min(1).max(200),
  eventName: z.enum(EVENT_NAMES),
  pageUrl: optionalText(2048),
  pagePath: optionalText(2048),
  referrer: optionalText(2048),
  utmSource: optionalText(200),
  utmMedium: optionalText(200),
  utmCampaign: optionalText(200),
  utmContent: optionalText(200),
  utmTerm: optionalText(200),
  device: optionalText(100),
  browser: optionalText(100),
  country: optionalText(100),
  os: optionalText(30),
  language: optionalText(20),
  timezone: optionalText(100),
  viewportCategory: z.enum(['small', 'medium', 'large']).optional(),
  screenCategory: z.enum(['small', 'medium', 'large']).optional(),
  timestamp: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
    .refine((value) => !value || Object.keys(value).length <= 20, 'Metadata cannot contain more than 20 keys')
    .refine((value) => !value || JSON.stringify(value).length <= 4096, 'Metadata cannot exceed 4KB'),
}).superRefine((value, context) => {
  if (value.eventName !== 'click') return;
  const result = clickMetadataSchema.safeParse(value.metadata);
  if (!result.success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['metadata'], message: 'Click metadata is invalid' });
  }
});

export type TrackEventInput = z.infer<typeof trackEventSchema>;