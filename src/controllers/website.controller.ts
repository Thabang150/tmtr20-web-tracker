import type { RequestHandler } from 'express';
import { AppError } from '../middleware/error-handler.js';
import * as websiteService from '../services/website.service.js';
import { createWebsiteSchema, updateWebsiteSchema } from '../validators/website.validators.js';

export const create: RequestHandler = async (request, response, next) => {
  try {
    const userId = requireUserId(request);
    const input = createWebsiteSchema.safeParse(request.body);
    if (!input.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request body is invalid');
    }

    const website = await websiteService.createWebsite(userId, input.data);
    response.status(201).json({ success: true, data: website, message: 'Website created successfully' });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (request, response, next) => {
  try {
    const websites = await websiteService.listWebsites(requireUserId(request));
    response.json({ success: true, data: websites, message: 'Websites retrieved successfully' });
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (request, response, next) => {
  try {
    const website = await websiteService.getWebsite(requireUserId(request), getWebsiteId(request));
    response.json({ success: true, data: website, message: 'Website retrieved successfully' });
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (request, response, next) => {
  try {
    const input = updateWebsiteSchema.safeParse(request.body);
    if (!input.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request body is invalid');
    }

    const website = await websiteService.updateWebsite(requireUserId(request), getWebsiteId(request), input.data);
    response.json({ success: true, data: website, message: 'Website updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (request, response, next) => {
  try {
    await websiteService.archiveWebsite(requireUserId(request), getWebsiteId(request));
    response.json({ success: true, data: null, message: 'Website archived successfully' });
  } catch (error) {
    next(error);
  }
};

function requireUserId(request: Parameters<RequestHandler>[0]): string {
  if (!request.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
  }

  return request.user.id;
}

function getWebsiteId(request: Parameters<RequestHandler>[0]): string {
  const websiteId = request.params.id;
  if (typeof websiteId !== 'string') {
    throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  }

  return websiteId;
}