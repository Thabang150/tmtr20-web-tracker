import { Types } from 'mongoose';
import path from 'node:path';
import { AppError } from '../middleware/error-handler.js';
import { MonthlyReportModel, type MonthlyReportDocument } from '../models/monthly-report.model.js';
import { WebsiteAuditModel } from '../models/website-audit.model.js';
import { WebsiteModel } from '../models/website.model.js';
import { UserModel } from '../models/user.model.js';
import * as analyticsService from './analytics.service.js';
import { sendMonthlyReport } from './email.service.js';
import { generateReportPdf } from './pdf.service.js';
import type { MonthlyReportPeriodInput } from '../validators/report.validators.js';
import type { ReportEmailInput } from '../validators/report-email.validators.js';

interface ReportPeriod {
  start: Date;
  end: Date;
}

export async function generateMonthlyReport(ownerId: string, websiteId: string, input: MonthlyReportPeriodInput) {
  const websiteObjectId = await assertWebsiteAccess(ownerId, websiteId);
  const period = { start: new Date(input.periodStart), end: new Date(input.periodEnd) };
  const existing = await MonthlyReportModel.findOne({ websiteId: websiteObjectId, periodStart: period.start, periodEnd: period.end });
  if (existing) {
    if (!existing.pdfPath || !path.basename(existing.pdfPath).startsWith('TMTR20-')) {
      await attachPdf(existing, ownerId, websiteId);
    }
    return existing;
  }

  const [overview, traffic, conversions, sources, topPages, audit] = await Promise.all([
    analyticsService.getOverview(websiteObjectId, period),
    analyticsService.getTraffic(websiteObjectId, period),
    analyticsService.getConversions(websiteObjectId, period),
    analyticsService.getSources(websiteObjectId, period),
    analyticsService.getTopPages(websiteObjectId, period),
    WebsiteAuditModel.findOne({ websiteId: websiteObjectId }).sort({ scanDate: -1 }),
  ]);

  const insights = buildInsights(overview, audit);
  try {
    const report = await MonthlyReportModel.create({
      websiteId: websiteObjectId,
      periodStart: period.start,
      periodEnd: period.end,
      metrics: { overview, traffic, conversions, sources, topPages, audit },
      ...insights,
      status: 'GENERATED',
      generatedAt: new Date(),
    });
    await attachPdf(report, ownerId, websiteId);
    return report;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    return MonthlyReportModel.findOne({ websiteId: websiteObjectId, periodStart: period.start, periodEnd: period.end });
  }
}

export async function listReports(ownerId: string, websiteId: string) {
  const websiteObjectId = await assertWebsiteAccess(ownerId, websiteId);
  return MonthlyReportModel.find({ websiteId: websiteObjectId }).sort({ periodStart: -1 });
}

export async function getLatestReport(ownerId: string, websiteId: string) {
  const websiteObjectId = await assertWebsiteAccess(ownerId, websiteId);
  return MonthlyReportModel.findOne({ websiteId: websiteObjectId }).sort({ periodStart: -1 });
}

async function assertWebsiteAccess(ownerId: string, websiteId: string): Promise<Types.ObjectId> {
  if (!Types.ObjectId.isValid(websiteId)) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  const website = await WebsiteModel.exists({ _id: websiteId, ownerId });
  if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  return new Types.ObjectId(websiteId);
}

function buildInsights(overview: Awaited<ReturnType<typeof analyticsService.getOverview>>, audit: { performanceScore: number; seoScore: number; securityScore: number; mobileScore: number } | null) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const recommendations: string[] = [];

  if (overview.visitors > 0) strengths.push(`The website attracted ${overview.visitors} unique visitors during the reporting period.`);
  if (overview.conversions > 0) strengths.push(`The website recorded ${overview.conversions} conversions.`);
  if (overview.conversionRate >= 3) strengths.push(`The conversion rate was ${overview.conversionRate}%.`);
  if (overview.visitors === 0) weaknesses.push('No tracked visitors were recorded during the reporting period.');
  if (overview.sessions > 0 && overview.conversionRate < 1) weaknesses.push(`Conversion rate was ${overview.conversionRate}%, below the 1% review threshold.`);
  if (audit && audit.performanceScore < 70) weaknesses.push(`Latest performance audit score was ${audit.performanceScore}/100.`);
  if (audit && audit.seoScore < 70) opportunities.push(`SEO audit score was ${audit.seoScore}/100; improve on-page search signals.`);
  if (audit && audit.mobileScore < 70) opportunities.push(`Mobile audit score was ${audit.mobileScore}/100; review mobile layout and loading.`);
  if (overview.pageViews > 0 && overview.conversions === 0) opportunities.push('Existing traffic could be converted more effectively with clearer calls to action.');
  if (overview.sessions > 0 && overview.conversionRate < 1) recommendations.push('Review landing pages and calls to action, then measure conversion changes next period.');
  if (audit && audit.performanceScore < 70) recommendations.push('Improve page loading performance and repeat the audit after optimization.');
  if (audit && audit.seoScore < 70) recommendations.push('Address missing or incomplete SEO metadata and crawl resources.');
  if (recommendations.length === 0) recommendations.push('Continue monitoring traffic and conversions with consistent tracking coverage.');

  return { strengths, weaknesses, opportunities, recommendations };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

export async function getReportPdf(ownerId: string, websiteId: string, reportId: string) {
  const websiteObjectId = await assertWebsiteAccess(ownerId, websiteId);
  if (!Types.ObjectId.isValid(reportId)) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
  const report = await MonthlyReportModel.findOne({ _id: reportId, websiteId: websiteObjectId });
  if (!report || !report.pdfPath) throw new AppError(404, 'REPORT_PDF_NOT_FOUND', 'Report PDF not found');
  return { report, absolutePath: path.resolve(report.pdfPath) };
}

export async function sendReportEmail(ownerId: string, websiteId: string, reportId: string, input: ReportEmailInput = {}) {
  const websiteObjectId = await assertWebsiteAccess(ownerId, websiteId);
  if (!Types.ObjectId.isValid(reportId)) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');

  const [website, report] = await Promise.all([
    WebsiteModel.findOne({ _id: websiteObjectId, ownerId }),
    MonthlyReportModel.findOne({ _id: reportId, websiteId: websiteObjectId }),
  ]);
  if (!website || !report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
  if (!report.pdfPath) throw new AppError(409, 'REPORT_PDF_NOT_FOUND', 'Generate the report PDF before sending it');

  const owner = await UserModel.findById(website.ownerId).select('email');
  if (!owner) throw new AppError(404, 'USER_NOT_FOUND', 'Report recipient not found');

  try {
    await sendMonthlyReport(input.recipientEmail ?? owner.email, report, website, path.resolve(report.pdfPath));
    report.sentAt = new Date();
    report.status = 'SENT';
    await report.save();
    return report;
  } catch (error) {
    report.status = 'FAILED';
    await report.save();
    throw error;
  }
}

async function attachPdf(report: MonthlyReportDocument, ownerId: string, websiteId: string): Promise<void> {
  const websiteObjectId = await assertWebsiteAccess(ownerId, websiteId);
  const website = await WebsiteModel.findById(websiteObjectId);
  if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  try {
    report.pdfPath = await generateReportPdf(report, website);
    report.status = 'GENERATED';
    await report.save();
  } catch (error) {
    report.status = 'FAILED';
    await report.save();
    throw error;
  }
}