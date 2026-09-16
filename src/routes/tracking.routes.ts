import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { track } from '../controllers/tracking.controller.js';

const trackingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

export const trackingRouter = Router();
trackingRouter.post('/', trackingRateLimit, track);