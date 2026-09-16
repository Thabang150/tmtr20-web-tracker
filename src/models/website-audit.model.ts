import { HydratedDocument, Model, Schema, Types, model } from 'mongoose';

export interface AuditIssue {
  category: string;
  code: string;
  message: string;
}

export interface WebsiteAudit {
  websiteId: Types.ObjectId;
  scanDate: Date;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  mobileScore: number;
  securityScore: number;
  httpStatus?: number;
  responseTimeMs?: number;
  https: boolean;
  robotsTxtAvailable: boolean;
  sitemapAvailable: boolean;
  pageCount: number;
  issues: AuditIssue[];
  recommendations: string[];
  createdAt: Date;
}

export type WebsiteAuditDocument = HydratedDocument<WebsiteAudit>;

const auditIssueSchema = new Schema<AuditIssue>(
  {
    category: { type: String, required: true },
    code: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false },
);

const websiteAuditSchema = new Schema<WebsiteAudit, Model<WebsiteAudit>>(
  {
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true },
    scanDate: { type: Date, required: true, default: Date.now },
    performanceScore: { type: Number, required: true, min: 0, max: 100 },
    seoScore: { type: Number, required: true, min: 0, max: 100 },
    accessibilityScore: { type: Number, required: true, min: 0, max: 100 },
    mobileScore: { type: Number, required: true, min: 0, max: 100 },
    securityScore: { type: Number, required: true, min: 0, max: 100 },
    httpStatus: { type: Number },
    responseTimeMs: { type: Number },
    https: { type: Boolean, required: true },
    robotsTxtAvailable: { type: Boolean, required: true },
    sitemapAvailable: { type: Boolean, required: true },
    pageCount: { type: Number, required: true, min: 0 },
    issues: { type: [auditIssueSchema], required: true, default: [] },
    recommendations: { type: [String], required: true, default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

websiteAuditSchema.index({ websiteId: 1, scanDate: -1 });

export const WebsiteAuditModel = model<WebsiteAudit>('WebsiteAudit', websiteAuditSchema);