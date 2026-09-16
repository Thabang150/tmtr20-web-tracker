import type { RequestHandler } from 'express';
import { AppError } from './error-handler.js';
import { UserModel } from '../models/user.model.js';
import { verifyAccessToken } from '../utils/token.utils.js';

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHENTICATED', 'A bearer access token is required');
    }

    const token = authorization.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);
    const user = await UserModel.findById(payload.sub);

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    request.user = { id: user.id, role: user.role };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'));
  }
};
