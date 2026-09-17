import { z } from 'zod';
import { EVENT_NAMES } from '../models/event.model.js';

const optionalText = (max: number) => z.string().trim().max(max).optional();

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
  timestamp: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
    .refine((value) => !value || Object.keys(value).length <= 20, 'Metadata cannot contain more than 20 keys')
    .refine((value) => !value || JSON.stringify(value).length <= 4096, 'Metadata cannot exceed 4KB'),
});

export type TrackEventInput = z.infer<typeof trackEventSchema>;