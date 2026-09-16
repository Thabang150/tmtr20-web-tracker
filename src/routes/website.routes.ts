import { Router } from 'express';
import * as websiteController from '../controllers/website.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const websiteRouter = Router();

websiteRouter.use(requireAuth);
websiteRouter.post('/', websiteController.create);
websiteRouter.get('/', websiteController.list);
websiteRouter.get('/:id', websiteController.get);
websiteRouter.patch('/:id', websiteController.update);
websiteRouter.delete('/:id', websiteController.remove);