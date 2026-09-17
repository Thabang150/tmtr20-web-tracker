import { z } from 'zod';
import { EVENT_NAMES } from '../models/event.model.js';

const pathPredicate = z.object({
  pagePath: z.string().trim().min(1).max(2048).optional(),
  pagePathPrefix: z.string().trim().min(1).max(2048).optional(),
}).refine((value) => !(value.pagePath && value.pagePathPrefix), 'Use pagePath or pagePathPrefix, not both');

export const funnelSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,49}$/),
  name: z.string().trim().min(2).max(100),
  active: z.boolean().default(true),
  steps: z.array(z.object({
    key: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,49}$/),
    name: z.string().trim().min(2).max(100),
    eventName: z.enum(EVENT_NAMES),
  }).and(pathPredicate)).min(2).max(5),
}).superRefine((value, context) => {
  if (new Set(value.steps.map((step) => step.key)).size !== value.steps.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['steps'], message: 'Step keys must be unique' });
  }
  if (value.steps[value.steps.length - 1]?.eventName && !['whatsapp_click', 'phone_click', 'email_click', 'form_submission', 'cta_click'].includes(value.steps[value.steps.length - 1].eventName)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['steps'], message: 'The final funnel step must be a conversion event' });
  }
});

export type FunnelInput = z.infer<typeof funnelSchema>;
