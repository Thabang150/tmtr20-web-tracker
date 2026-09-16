import { HydratedDocument, Model, Schema, Types, model } from 'mongoose';

export const REPORT_STATUSES = ['PENDING', 'GENERATED', 'SENT', 'FAILED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface MonthlyReport {
  websiteId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  metrics: Record<string, unknown>;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  recommendations: string[];
  pdfPath?: string;
  generatedAt?: Date;
  sentAt?: Date;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type MonthlyReportDocument = HydratedDocument<MonthlyReport>;

const monthlyReportSchema = new Schema<MonthlyReport, Model<MonthlyReport>>(
  {
    websiteId: { type: Schema.Types.ObjectId, ref: 'Website', required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    metrics: { type: Schema.Types.Mixed, required: true },
    strengths: { type: [String], required: true, default: [] },
    weaknesses: { type: [String], required: true, default: [] },
    opportunities: { type: [String], required: true, default: [] },
    recommendations: { type: [String], required: true, default: [] },
    pdfPath: { type: String },
    generatedAt: { type: Date },
    sentAt: { type: Date },
    status: { type: String, enum: REPORT_STATUSES, required: true, default: 'PENDING' },
  },
  { timestamps: true },
);

monthlyReportSchema.index({ websiteId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });
monthlyReportSchema.index({ websiteId: 1, periodStart: -1 });

export const MonthlyReportModel = model<MonthlyReport>('MonthlyReport', monthlyReportSchema);