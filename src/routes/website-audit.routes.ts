import { Router } from 'express';
import * as auditController from '../controllers/website-audit.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import rateLimit from 'express-rate-limit';

export const websiteAuditRouter = Router();
websiteAuditRouter.use(requireAuth);
websiteAuditRouter.post('/:id/audits', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }), auditController.run);
websiteAuditRouter.get('/:id/audits', auditController.list);
websiteAuditRouter.get('/:id/audits/latest', auditController.latest);