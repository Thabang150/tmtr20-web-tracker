import { AppError } from '../middleware/error-handler.js';
import { WebsiteModel } from '../models/website.model.js';
import type { FunnelInput } from '../validators/funnel.validators.js';

export async function listFunnels(ownerId: string, websiteId: string) {
  const website = await getWebsite(ownerId, websiteId);
  return website.funnels ?? [];
}

export async function createFunnel(ownerId: string, websiteId: string, input: FunnelInput) {
  const website = await getWebsite(ownerId, websiteId);
  const funnels = website.funnels ?? [];
  if (funnels.length >= 10 || funnels.some((funnel) => funnel.key === input.key)) {
    throw new AppError(409, 'FUNNEL_EXISTS', 'Funnel limit reached or key already exists');
  }
  const now = new Date();
  const funnel = { ...input, createdAt: now, updatedAt: now };
  website.funnels = [...funnels, funnel];
  await website.save();
  return funnel;
}

export async function updateFunnel(ownerId: string, websiteId: string, key: string, input: FunnelInput) {
  const website = await getWebsite(ownerId, websiteId);
  const funnels = website.funnels ?? [];
  const index = funnels.findIndex((funnel) => funnel.key === key);
  if (index < 0) throw new AppError(404, 'FUNNEL_NOT_FOUND', 'Funnel not found');
  if (input.key !== key && funnels.some((funnel) => funnel.key === input.key)) throw new AppError(409, 'FUNNEL_EXISTS', 'Funnel key already exists');
  const updated = { ...input, createdAt: funnels[index].createdAt, updatedAt: new Date() };
  funnels[index] = updated;
  website.funnels = funnels;
  await website.save();
  return updated;
}

export async function deleteFunnel(ownerId: string, websiteId: string, key: string): Promise<void> {
  const website = await getWebsite(ownerId, websiteId);
  const funnels = website.funnels ?? [];
  if (!funnels.some((funnel) => funnel.key === key)) throw new AppError(404, 'FUNNEL_NOT_FOUND', 'Funnel not found');
  website.funnels = funnels.filter((funnel) => funnel.key !== key);
  await website.save();
}

export async function getFunnel(ownerId: string, websiteId: string, key: string) {
  const website = await getWebsite(ownerId, websiteId);
  const funnel = (website.funnels ?? []).find((value) => value.key === key);
  if (!funnel) throw new AppError(404, 'FUNNEL_NOT_FOUND', 'Funnel not found');
  return funnel;
}

async function getWebsite(ownerId: string, websiteId: string) {
  const website = await WebsiteModel.findOne({ _id: websiteId, ownerId });
  if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  return website;
}