import type { RequestHandler } from 'express';
import { AppError } from '../middleware/error-handler.js';
import * as authService from '../services/auth.service.js';
import { loginSchema, refreshSchema, registerSchema } from '../validators/auth.validators.js';

export const register: RequestHandler = async (request, response, next) => {
  try {
    const input = registerSchema.safeParse(request.body);
    if (!input.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request body is invalid');
    }

    const data = await authService.register(input.data);
    response.status(201).json({ success: true, data, message: 'Account registered successfully' });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (request, response, next) => {
  try {
    const input = loginSchema.safeParse(request.body);
    if (!input.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request body is invalid');
    }

    const data = await authService.login(input.data);
    response.json({ success: true, data, message: 'Login successful' });
  } catch (error) {
    next(error);
  }
};

export const refresh: RequestHandler = async (request, response, next) => {
  try {
    const input = refreshSchema.safeParse(request.body);
    if (!input.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request body is invalid');
    }

    const data = await authService.refresh(input.data.refreshToken);
    response.json({ success: true, data, message: 'Token refreshed successfully' });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (request, response, next) => {
  try {
    const input = refreshSchema.safeParse(request.body);
    if (!input.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request body is invalid');
    }

    await authService.logout(input.data.refreshToken);
    response.json({ success: true, data: null, message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = async (request, response, next) => {
  try {
    if (!request.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    const data = await authService.getCurrentUser(request.user.id);
    response.json({ success: true, data, message: 'Current user retrieved successfully' });
  } catch (error) {
    next(error);
  }
};
