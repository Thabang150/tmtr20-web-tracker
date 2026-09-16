import { z } from 'zod';

const websiteUrl = z.string().trim().url().max(2048).refine((value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, 'URL must use http or https');

export const createWebsiteSchema = z.object({
  name: z.string().trim().min(2).max(150),
  url: websiteUrl,
  timezone: z.string().trim().min(1).max(100).default('UTC'),
});

export const updateWebsiteSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  url: websiteUrl.optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type CreateWebsiteInput = z.infer<typeof createWebsiteSchema>;
export type UpdateWebsiteInput = z.infer<typeof updateWebsiteSchema>;