import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const reportRouter = Router();
reportRouter.use(requireAuth);
reportRouter.post('/:id/reports/monthly', reportController.generate);
reportRouter.get('/:id/reports', reportController.list);
reportRouter.get('/:id/reports/latest', reportController.latest);
reportRouter.get('/:id/reports/:reportId/pdf', reportController.pdf);
reportRouter.post('/:id/reports/:reportId/email', reportController.email);