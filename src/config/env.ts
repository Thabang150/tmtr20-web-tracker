import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1),
  CORS_ORIGIN: z.string().default('*'),
  TRACKING_SCRIPT_URL: z.string().url().default('http://localhost:3000/tracker.js'),
  TRACKING_API_URL: z.string().url().default('http://localhost:3000/api/track'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  REPORT_STORAGE_PATH: z.string().default('storage/reports'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  REPORT_EMAIL_FROM: z.string().email().optional(),
  REPORT_SCHEDULER_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  REPORT_SCHEDULER_CRON: z.string().default('0 2 1 * *'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration', parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
