import type { RequestHandler } from 'express';
import { AppError } from '../middleware/error-handler.js';
import * as analyticsService from '../services/analytics.service.js';
import { analyticsDateRangeSchema, toUtcDateRange } from '../validators/analytics.validators.js';

export const overview: RequestHandler = async (request, response, next) => {
  await handle(request, response, next, 'overview', analyticsService.getOverview);
};

export const traffic: RequestHandler = async (request, response, next) => {
  await handle(request, response, next, 'traffic', analyticsService.getTraffic);
};

export const conversions: RequestHandler = async (request, response, next) => {
  await handle(request, response, next, 'conversions', analyticsService.getConversions);
};

export const sources: RequestHandler = async (request, response, next) => {
  await handle(request, response, next, 'sources', analyticsService.getSources);
};

export const audience: RequestHandler = async (request, response, next) => {
  await handle(request, response, next, 'audience', analyticsService.getAudience);
};

export const topPages: RequestHandler = async (request, response, next) => {
  await handle(request, response, next, 'top-pages', analyticsService.getTopPages);
};

async function handle(
  request: Parameters<RequestHandler>[0],
  response: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2],
  message: string,
  operation: (websiteId: import('mongoose').Types.ObjectId, range: { start: Date; end: Date }) => Promise<unknown>,
): Promise<void> {
  try {
    if (!request.user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    const websiteId = getWebsiteId(request);
    const dateRange = analyticsDateRangeSchema.safeParse(request.query);
    if (!dateRange.success) throw new AppError(400, 'VALIDATION_ERROR', 'startDate and endDate must be valid');

    const ownedWebsiteId = await analyticsService.assertWebsiteAccess(request.user.id, websiteId);
    const data = await operation(ownedWebsiteId, toUtcDateRange(dateRange.data));
    response.json({ success: true, data, message: `${message} analytics retrieved successfully` });
  } catch (error) {
    next(error);
  }
}

function getWebsiteId(request: Parameters<RequestHandler>[0]): string {
  const websiteId = request.params.id;
  if (typeof websiteId !== 'string') throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  return websiteId;
}