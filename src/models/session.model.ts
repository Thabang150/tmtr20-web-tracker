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
  device?: string;
  startTime: Date;
  endTime?: Date;
  pageViews: number;
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
  device: { type: String, trim: true, maxlength: 100 },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  pageViews: { type: Number, required: true, default: 0, min: 0 },
});

sessionSchema.index({ websiteId: 1, sessionId: 1 }, { unique: true });
sessionSchema.index({ websiteId: 1, startTime: 1 });

export const SessionModel = model<Session>('Session', sessionSchema);