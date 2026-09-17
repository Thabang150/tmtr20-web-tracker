import type { RequestHandler } from 'express';
import { AppError } from '../middleware/error-handler.js';
import * as funnelService from '../services/funnel.service.js';
import { funnelSchema } from '../validators/funnel.validators.js';

export const list: RequestHandler = async (request, response, next) => {
  try { response.json({ success: true, data: await funnelService.listFunnels(requireUser(request), getId(request)), message: 'Funnels retrieved successfully' }); } catch (error) { next(error); }
};
export const create: RequestHandler = async (request, response, next) => {
  try { const parsed = funnelSchema.safeParse(request.body); if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Funnel definition is invalid'); response.status(201).json({ success: true, data: await funnelService.createFunnel(requireUser(request), getId(request), parsed.data), message: 'Funnel created successfully' }); } catch (error) { next(error); }
};
export const update: RequestHandler = async (request, response, next) => {
  try { const parsed = funnelSchema.safeParse(request.body); if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Funnel definition is invalid'); response.json({ success: true, data: await funnelService.updateFunnel(requireUser(request), getId(request), getKey(request), parsed.data), message: 'Funnel updated successfully' }); } catch (error) { next(error); }
};
export const remove: RequestHandler = async (request, response, next) => {
  try { await funnelService.deleteFunnel(requireUser(request), getId(request), getKey(request)); response.json({ success: true, data: null, message: 'Funnel deleted successfully' }); } catch (error) { next(error); }
};

function requireUser(request: Parameters<RequestHandler>[0]): string { if (!request.user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'); return request.user.id; }
function getId(request: Parameters<RequestHandler>[0]): string { if (typeof request.params.id !== 'string') throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found'); return request.params.id; }
function getKey(request: Parameters<RequestHandler>[0]): string { if (typeof request.params.funnelKey !== 'string') throw new AppError(404, 'FUNNEL_NOT_FOUND', 'Funnel not found'); return request.params.funnelKey; }