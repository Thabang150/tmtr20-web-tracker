import { HydratedDocument, Model, Schema, Types, model } from 'mongoose';

export const WEBSITE_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
export type WebsiteStatus = (typeof WEBSITE_STATUSES)[number];

export interface Website {
  ownerId: Types.ObjectId;
  name: string;
  url: string;
  domain: string;
  trackingId: string;
  timezone: string;
  status: WebsiteStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type WebsiteDocument = HydratedDocument<Website>;

const websiteSchema = new Schema<Website, Model<Website>>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
    url: { type: String, required: true, trim: true },
    domain: { type: String, required: true, trim: true, lowercase: true, index: true },
    trackingId: { type: String, required: true, unique: true, index: true },
    timezone: { type: String, required: true, default: 'UTC' },
    status: { type: String, enum: WEBSITE_STATUSES, required: true, default: 'ACTIVE' },
  },
  { timestamps: true },
);

websiteSchema.index({ ownerId: 1, status: 1 });

export const WebsiteModel = model<Website>('Website', websiteSchema);