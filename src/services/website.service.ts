import { Types } from 'mongoose';
import { AppError } from '../middleware/error-handler.js';
import { WebsiteModel, type WebsiteDocument } from '../models/website.model.js';
import type { CreateWebsiteInput, UpdateWebsiteInput } from '../validators/website.validators.js';
import { generateTrackingId, normalizeWebsiteUrl } from '../utils/website.utils.js';

export async function createWebsite(ownerId: string, input: CreateWebsiteInput): Promise<WebsiteDocument> {
  const normalized = normalizeWebsiteUrl(input.url);
  let trackingId = generateTrackingId();

  while (await WebsiteModel.exists({ trackingId })) {
    trackingId = generateTrackingId();
  }

  return WebsiteModel.create({
    ownerId: new Types.ObjectId(ownerId),
    name: input.name,
    ...normalized,
    trackingId,
    timezone: input.timezone,
    status: 'ACTIVE',
  });
}

export async function listWebsites(ownerId: string): Promise<WebsiteDocument[]> {
  return WebsiteModel.find({ ownerId }).sort({ createdAt: -1 });
}

export async function getWebsite(ownerId: string, websiteId: string): Promise<WebsiteDocument> {
  assertObjectId(websiteId);
  const website = await WebsiteModel.findOne({ _id: websiteId, ownerId });
  if (!website) {
    throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  }

  return website;
}

export async function updateWebsite(
  ownerId: string,
  websiteId: string,
  input: UpdateWebsiteInput,
): Promise<WebsiteDocument> {
  assertObjectId(websiteId);
  const updates: Record<string, string> = { ...input };

  if (input.url) {
    const normalized = normalizeWebsiteUrl(input.url);
    updates.url = normalized.url;
    updates.domain = normalized.domain;
  }

  const website = await WebsiteModel.findOneAndUpdate(
    { _id: websiteId, ownerId },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!website) {
    throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  }

  return website;
}

export async function archiveWebsite(ownerId: string, websiteId: string): Promise<void> {
  assertObjectId(websiteId);
  const result = await WebsiteModel.updateOne(
    { _id: websiteId, ownerId },
    { $set: { status: 'ARCHIVED' } },
  );

  if (result.matchedCount === 0) {
    throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  }
}

function assertObjectId(value: string): void {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  }
}