import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);
analyticsRouter.get('/:id/overview', analyticsController.overview);
analyticsRouter.get('/:id/traffic', analyticsController.traffic);
analyticsRouter.get('/:id/conversions', analyticsController.conversions);
analyticsRouter.get('/:id/sources', analyticsController.sources);
analyticsRouter.get('/:id/audience', analyticsController.audience);
analyticsRouter.get('/:id/behavior', analyticsController.behavior);
analyticsRouter.get('/:id/intelligence', analyticsController.intelligence);
analyticsRouter.get('/:id/top-pages', analyticsController.topPages);