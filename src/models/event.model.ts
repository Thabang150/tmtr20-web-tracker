import { Model, Schema, Types, model } from 'mongoose';

export const EVENT_NAMES = [
  'page_view',
  'session_start',
  'whatsapp_click',
  'phone_click',
  'email_click',
  'form_submission',
  'cta_click',
  'scroll_depth',
  'engagement_time',
  'outbound_click',
  'form_start',
  'form_abandonment',
  'rage_click',
  'dead_click',
  'click',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export const CONVERSION_EVENT_NAMES = [
  'whatsapp_click',
  'phone_click',
  'email_click',
  'form_submission',
  'cta_click',
] as const;

export interface Event {
  eventId: string;
  schemaVersion: number;
  websiteId: Types.ObjectId;
  visitorId: string;
  sessionId: string;
  eventName: EventName;
  pageUrl?: string;
  pagePath?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referralDomain?: string;
  sourceCategory?: string;
  os?: string;
  language?: string;
  timezone?: string;
  viewportCategory?: string;
  screenCategory?: string;
  device?: string;
  browser?: string;
  country?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  receivedAt: Date;
  createdAt: Date;
}

const eventSchema = new Schema<Event, Model<Event>>(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 200 },
    schemaVersion: { type: Number, required: true, default: 1, min: 1 },
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true },
    visitorId: { type: String, required: true, trim: true, maxlength: 200 },
    sessionId: { type: String, required: true, trim: true, maxlength: 200 },
    eventName: { type: String, enum: EVENT_NAMES, required: true },
    pageUrl: { type: String, trim: true, maxlength: 2048 },
    pagePath: { type: String, trim: true, maxlength: 2048 },
    referrer: { type: String, trim: true, maxlength: 2048 },
    utmSource: { type: String, trim: true, maxlength: 200 },
    utmMedium: { type: String, trim: true, maxlength: 200 },
    utmCampaign: { type: String, trim: true, maxlength: 200 },
    utmContent: { type: String, trim: true, maxlength: 200 },
    utmTerm: { type: String, trim: true, maxlength: 200 },
    referralDomain: { type: String, trim: true, maxlength: 255 },
    sourceCategory: { type: String, trim: true, maxlength: 50 },
    os: { type: String, trim: true, maxlength: 30 },
    language: { type: String, trim: true, maxlength: 20 },
    timezone: { type: String, trim: true, maxlength: 100 },
    viewportCategory: { type: String, trim: true, maxlength: 20 },
    screenCategory: { type: String, trim: true, maxlength: 20 },
    device: { type: String, trim: true, maxlength: 100 },
    browser: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 100 },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

eventSchema.index({ websiteId: 1, timestamp: 1 });
eventSchema.index({ websiteId: 1, eventName: 1, timestamp: 1 });
eventSchema.index({ websiteId: 1, timestamp: 1, sessionId: 1, eventName: 1 });
eventSchema.index({ websiteId: 1, eventName: 1, pagePath: 1, timestamp: 1 });
eventSchema.index({ websiteId: 1, eventId: 1 }, { unique: true, sparse: true });
eventSchema.index({ websiteId: 1, visitorId: 1 });
eventSchema.index({ websiteId: 1, sessionId: 1 });

export const EventModel = model<Event>('Event', eventSchema);