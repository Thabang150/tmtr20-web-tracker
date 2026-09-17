import { Model, Schema, Types, model } from 'mongoose';

export interface Session {
  websiteId: Types.ObjectId;
  sessionId: string;
  visitorId: string;
  landingPage?: string;
  exitPage?: string;
  referrer?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referralDomain?: string;
  sourceCategory?: string;
  firstTouch?: SessionAttribution;
  lastTouch?: SessionAttribution;
  device?: string;
  os?: string;
  language?: string;
  timezone?: string;
  viewportCategory?: string;
  screenCategory?: string;
  startTime: Date;
  endTime?: Date;
  lastActivityAt?: Date;
  engagementTimeMs: number;
  maxScrollDepthPercent: number;
  pageViews: number;
}

export interface SessionAttribution {
  referrer?: string;
  referralDomain?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  sourceCategory?: string;
}

const sessionSchema = new Schema<Session, Model<Session>>({
  websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true },
  sessionId: { type: String, required: true, trim: true, maxlength: 200 },
  visitorId: { type: String, required: true, trim: true, maxlength: 200 },
  landingPage: { type: String, trim: true, maxlength: 2048 },
  exitPage: { type: String, trim: true, maxlength: 2048 },
  referrer: { type: String, trim: true, maxlength: 2048 },
  source: { type: String, trim: true, maxlength: 200 },
  medium: { type: String, trim: true, maxlength: 200 },
  campaign: { type: String, trim: true, maxlength: 200 },
  content: { type: String, trim: true, maxlength: 200 },
  term: { type: String, trim: true, maxlength: 200 },
  referralDomain: { type: String, trim: true, maxlength: 255 },
  sourceCategory: { type: String, trim: true, maxlength: 50 },
  firstTouch: { type: Schema.Types.Mixed },
  lastTouch: { type: Schema.Types.Mixed },
  device: { type: String, trim: true, maxlength: 100 },
  os: { type: String, trim: true, maxlength: 30 },
  language: { type: String, trim: true, maxlength: 20 },
  timezone: { type: String, trim: true, maxlength: 100 },
  viewportCategory: { type: String, trim: true, maxlength: 20 },
  screenCategory: { type: String, trim: true, maxlength: 20 },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  lastActivityAt: { type: Date },
  engagementTimeMs: { type: Number, required: true, default: 0, min: 0 },
  maxScrollDepthPercent: { type: Number, required: true, default: 0, min: 0, max: 100 },
  pageViews: { type: Number, required: true, default: 0, min: 0 },
});

sessionSchema.index({ websiteId: 1, sessionId: 1 }, { unique: true });
sessionSchema.index({ websiteId: 1, startTime: 1 });

export const SessionModel = model<Session>('Session', sessionSchema);