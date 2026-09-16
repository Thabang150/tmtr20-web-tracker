import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { websiteRouter } from './routes/website.routes.js';
import { websiteAuditRouter } from './routes/website-audit.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { trackingRouter } from './routes/tracking.routes.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.includes('*') ? true : allowedOrigins }));

const trackingCors = cors({
  origin: (_origin, callback) => callback(null, true),
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
});

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use((request, _response, next) => {
  request.requestId = randomUUID();
  next();
});
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }));

app.get('/', (_request, response) => {
  response.json({ success: true, data: { service: 'tmtr20-web-tracker' } });
});
app.get('/tracker.js', async (_request, response, next) => {
  try {
    const trackerPath = path.resolve(process.cwd(), 'public', 'tracker.js');
    const trackerSource = await readFile(trackerPath, 'utf8');
    response.type('application/javascript').send(trackerSource.replaceAll('__TMTR20_TRACKING_API_URL__', env.TRACKING_API_URL));
  } catch (error) {
    next(error);
  }
});
app.use(express.static(path.resolve(process.cwd(), 'public')));
app.options('/api/track', trackingCors);
app.use('/api/track', trackingCors, trackingRouter);
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/websites', analyticsRouter);
app.use('/api/websites', websiteAuditRouter);
app.use('/api/websites', reportRouter);
app.use('/api/websites', websiteRouter);

app.use(notFoundHandler);
app.use(errorHandler);
