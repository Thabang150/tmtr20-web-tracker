import type { RequestHandler } from 'express';
import { AppError } from '../middleware/error-handler.js';
import * as trackingService from '../services/tracking.service.js';
import { trackEventSchema } from '../validators/tracking.validators.js';

export const track: RequestHandler = async (request, response, next) => {
  try {
    const input = trackEventSchema.safeParse(request.body);
    if (!input.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Tracking payload is invalid');
    }

    await trackingService.trackEvent(input.data);
    response.status(202).json({
      success: true,
      data: { accepted: true },
      message: 'Event accepted',
    });
  } catch (error) {
    next(error);
  }
};