import { Router } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  const databaseState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  response.json({
    success: true,
    data: {
      status: 'ok',
      database: databaseState,
      timestamp: new Date().toISOString(),
    },
    message: 'TMTR20 Website Intelligence API is running',
  });
});
