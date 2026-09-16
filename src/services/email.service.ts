import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error-handler.js';
import type { MonthlyReportDocument } from '../models/monthly-report.model.js';

interface EmailWebsite {
  name: string;
  domain: string;
}

export async function sendMonthlyReport(
  recipient: string,
  report: MonthlyReportDocument,
  website: EmailWebsite,
  pdfPath: string,
): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.REPORT_EMAIL_FROM) {
    throw new AppError(503, 'EMAIL_NOT_CONFIGURED', 'SMTP email delivery is not configured');
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });

  const period = `${formatDate(report.periodStart)} to ${formatDate(report.periodEnd)}`;
  const overview = getOverview(report);

  await transporter.sendMail({
    from: env.REPORT_EMAIL_FROM,
    to: recipient,
    subject: `TMTR20 monthly report: ${website.name} (${period})`,
    text: [
      `Hello,`,
      '',
      `Your TMTR20 website report for ${website.name} is ready.`,
      `Reporting period: ${period}`,
      '',
      `Visitors: ${overview.visitors ?? 0}`,
      `Sessions: ${overview.sessions ?? 0}`,
      `Page views: ${overview.pageViews ?? 0}`,
      `Conversions: ${overview.conversions ?? 0}`,
      `Conversion rate: ${overview.conversionRate ?? 0}%`,
      '',
      'The full report is attached as a PDF.',
      '',
      'TMTR20 Website Intelligence',
    ].join('\n'),
    attachments: [{ filename: pdfPath.split(/[\\/]/).pop() ?? 'TMTR20-report.pdf', path: pdfPath }],
  });
}

function getOverview(report: MonthlyReportDocument): Record<string, unknown> {
  const metrics = report.metrics as Record<string, unknown>;
  const overview = metrics.overview;
  return typeof overview === 'object' && overview !== null ? overview as Record<string, unknown> : {};
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}