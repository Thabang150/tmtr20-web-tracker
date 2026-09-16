import type { RequestHandler } from 'express';
import { AppError } from '../middleware/error-handler.js';
import * as auditService from '../services/website-audit.service.js';

export const run: RequestHandler = async (request, response, next) => {
  try {
    const result = await auditService.runAudit(requireUserId(request), getWebsiteId(request));
    response.status(201).json({ success: true, data: result, message: 'Website audit completed successfully' });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (request, response, next) => {
  try {
    const result = await auditService.listAudits(requireUserId(request), getWebsiteId(request));
    response.json({ success: true, data: result, message: 'Website audits retrieved successfully' });
  } catch (error) {
    next(error);
  }
};

export const latest: RequestHandler = async (request, response, next) => {
  try {
    const result = await auditService.getLatestAudit(requireUserId(request), getWebsiteId(request));
    response.json({ success: true, data: result, message: 'Latest website audit retrieved successfully' });
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