import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { WebsiteModel } from '../models/website.model.js';
import { generateMonthlyReport, sendReportEmail } from '../services/report.service.js';

export async function runMonthlyReportJob(referenceDate = new Date()): Promise<void> {
  const period = previousMonthPeriod(referenceDate);
  const websites = await WebsiteModel.find({ status: 'ACTIVE' }).select('_id ownerId name');
  logger.info({ websiteCount: websites.length, period }, 'Monthly report job started');

  for (const website of websites) {
    try {
      const report = await generateMonthlyReport(
        website.ownerId.toString(),
        website._id.toString(),
        { periodStart: period.start.toISOString(), periodEnd: period.end.toISOString() },
      );

      if (report && report.status !== 'SENT') {
        await sendReportEmail(website.ownerId.toString(), website._id.toString(), report._id.toString());
      }

      logger.info({ websiteId: website._id.toString(), reportId: report?._id.toString() }, 'Monthly report processed');
    } catch (error) {
      logger.error({ err: error, websiteId: website._id.toString() }, 'Monthly report failed for website');
    }
  }

  logger.info({ period }, 'Monthly report job finished');
}

export function startMonthlyReportScheduler(): ScheduledTask | undefined {
  if (!env.REPORT_SCHEDULER_ENABLED) {
    logger.info('Monthly report scheduler disabled');
    return undefined;
  }

  if (!cron.validate(env.REPORT_SCHEDULER_CRON)) {
    throw new Error(`Invalid REPORT_SCHEDULER_CRON: ${env.REPORT_SCHEDULER_CRON}`);
  }

  const task = cron.schedule(env.REPORT_SCHEDULER_CRON, () => {
    void runMonthlyReportJob();
  }, { timezone: 'UTC' });
  logger.info({ cron: env.REPORT_SCHEDULER_CRON }, 'Monthly report scheduler started');
  return task;
}

export function previousMonthPeriod(referenceDate: Date): { start: Date; end: Date } {
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return { start, end };
}