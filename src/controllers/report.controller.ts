import type { RequestHandler } from 'express';
import { createReadStream } from 'node:fs';
import { AppError } from '../middleware/error-handler.js';
import * as reportService from '../services/report.service.js';
import { monthlyReportPeriodSchema } from '../validators/report.validators.js';
import { reportEmailSchema } from '../validators/report-email.validators.js';

export const generate: RequestHandler = async (request, response, next) => {
  try {
    const input = monthlyReportPeriodSchema.safeParse(request.body);
    if (!input.success) throw new AppError(400, 'VALIDATION_ERROR', 'Report period is invalid');
    const report = await reportService.generateMonthlyReport(requireUserId(request), getWebsiteId(request), input.data);
    response.status(201).json({ success: true, data: report, message: 'Monthly report generated successfully' });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (request, response, next) => {
  try {
    const reports = await reportService.listReports(requireUserId(request), getWebsiteId(request));
    response.json({ success: true, data: reports, message: 'Monthly reports retrieved successfully' });
  } catch (error) {
    next(error);
  }
};

export const latest: RequestHandler = async (request, response, next) => {
  try {
    const report = await reportService.getLatestReport(requireUserId(request), getWebsiteId(request));
    response.json({ success: true, data: report, message: 'Latest monthly report retrieved successfully' });
  } catch (error) {
    next(error);
  }
};

export const pdf: RequestHandler = async (request, response, next) => {
  try {
    const result = await reportService.getReportPdf(requireUserId(request), getWebsiteId(request), getReportId(request));
    response.type('application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${result.report._id.toString()}.pdf"`);
    createReadStream(result.absolutePath).on('error', next).pipe(response);
  } catch (error) {
    next(error);
  }
};

export const email: RequestHandler = async (request, response, next) => {
  try {
    const input = reportEmailSchema.safeParse(request.body);
    if (!input.success) throw new AppError(400, 'VALIDATION_ERROR', 'Recipient email is invalid');
    const report = await reportService.sendReportEmail(requireUserId(request), getWebsiteId(request), getReportId(request), input.data);
    response.json({ success: true, data: report, message: 'Monthly report emailed successfully' });
  } catch (error) {
    next(error);
  }
};

function requireUserId(request: Parameters<RequestHandler>[0]): string {
  if (!request.user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
  return request.user.id;
}

function getWebsiteId(request: Parameters<RequestHandler>[0]): string {
  const websiteId = request.params.id;
  if (typeof websiteId !== 'string') throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  return websiteId;
}

function getReportId(request: Parameters<RequestHandler>[0]): string {
  const reportId = request.params.reportId;
  if (typeof reportId !== 'string') throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
  return reportId;
}