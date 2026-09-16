import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);
analyticsRouter.get('/:id/overview', analyticsController.overview);
analyticsRouter.get('/:id/traffic', analyticsController.traffic);
analyticsRouter.get('/:id/conversions', analyticsController.conversions);
analyticsRouter.get('/:id/sources', analyticsController.sources);
analyticsRouter.get('/:id/top-pages', analyticsController.topPages);