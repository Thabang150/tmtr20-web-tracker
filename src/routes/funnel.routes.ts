import { Router } from 'express';
import * as funnelController from '../controllers/funnel.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const funnelRouter = Router();
funnelRouter.use(requireAuth);
funnelRouter.get('/:id/funnels', funnelController.list);
funnelRouter.post('/:id/funnels', funnelController.create);
funnelRouter.patch('/:id/funnels/:funnelKey', funnelController.update);
funnelRouter.delete('/:id/funnels/:funnelKey', funnelController.remove);