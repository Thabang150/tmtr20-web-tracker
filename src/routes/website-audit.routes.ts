import { Router } from 'express';
import * as auditController from '../controllers/website-audit.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const websiteAuditRouter = Router();
websiteAuditRouter.use(requireAuth);
websiteAuditRouter.post('/:id/audits', auditController.run);
websiteAuditRouter.get('/:id/audits', auditController.list);
websiteAuditRouter.get('/:id/audits/latest', auditController.latest);