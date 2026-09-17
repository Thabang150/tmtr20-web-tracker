import { AppError } from '../middleware/error-handler.js';
import { EventModel } from '../models/event.model.js';
import { SessionModel } from '../models/session.model.js';
import { WebsiteModel } from '../models/website.model.js';
import type { TrackEventInput } from '../validators/tracking.validators.js';
import { randomUUID } from 'node:crypto';
import { getAcquisitionData, hasAttribution } from '../utils/acquisition.utils.js';

export async function trackEvent(input: TrackEventInput): Promise<void> {
  const website = await WebsiteModel.findOne({ trackingId: input.trackingId, status: 'ACTIVE' }).select('_id');
  if (!website) {
    throw new AppError(404, 'TRACKING_ID_NOT_FOUND', 'Tracking ID is invalid or inactive');
  }

  const receivedAt = new Date();
  const timestamp = input.timestamp ?? receivedAt;
  validateTimestamp(timestamp, receivedAt);
  const eventId = input.eventId ?? randomUUID();
  const acquisition = getAcquisitionData(input);
  const { eventId: _eventId, trackingId: _trackingId, timestamp: _timestamp, ...eventFields } = input;

  try {
    await EventModel.create({
      ...eventFields,
      eventId,
      schemaVersion: 1,
      websiteId: website._id,
      timestamp,
      receivedAt,
      referralDomain: acquisition.referralDomain,
      sourceCategory: acquisition.sourceCategory,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return;
    }
    throw error;
  }

  const existingSession = await SessionModel.exists({
    websiteId: website._id,
    sessionId: input.sessionId,
  });

  if (existingSession) {
    await updateExistingSession(website._id.toString(), input, timestamp, acquisition);
    return;
  }

  try {
    const firstTouch = toSessionAttribution(acquisition);
    await SessionModel.create({
      websiteId: website._id,
      sessionId: input.sessionId,
      visitorId: input.visitorId,
      landingPage: input.pagePath,
      exitPage: input.pagePath,
      referrer: input.referrer,
      source: input.utmSource,
      medium: input.utmMedium,
      campaign: input.utmCampaign,
      content: input.utmContent,
      term: input.utmTerm,
      referralDomain: acquisition.referralDomain,
      sourceCategory: acquisition.sourceCategory,
      firstTouch,
      lastTouch: firstTouch,
      device: input.device,
      startTime: timestamp,
      endTime: timestamp,
      lastActivityAt: receivedAt,
      pageViews: input.eventName === 'page_view' ? 1 : 0,
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    await updateExistingSession(website._id.toString(), input, timestamp, acquisition);
  }
}

async function updateExistingSession(
  websiteId: string,
  input: TrackEventInput,
  timestamp: Date,
  acquisition: ReturnType<typeof getAcquisitionData>,
): Promise<void> {
  const update: Record<string, unknown> = {
    exitPage: input.pagePath,
    endTime: timestamp,
    lastActivityAt: new Date(),
  };
  if (hasAttribution(input)) {
    Object.assign(update, {
      content: input.utmContent,
      term: input.utmTerm,
      referralDomain: acquisition.referralDomain,
      sourceCategory: acquisition.sourceCategory,
      lastTouch: toSessionAttribution(acquisition),
    });
  }

  await SessionModel.updateOne(
    { websiteId, sessionId: input.sessionId },
    {
      $set: update,
      ...(input.eventName === 'page_view' ? { $inc: { pageViews: 1 } } : {}),
    },
  );
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function validateTimestamp(timestamp: Date, receivedAt: Date): void {
  const maximumFutureSkewMs = 5 * 60 * 1000;
  const maximumAgeMs = 30 * 24 * 60 * 60 * 1000;
  const timestampMs = timestamp.getTime();
  const receivedAtMs = receivedAt.getTime();

  if (timestampMs > receivedAtMs + maximumFutureSkewMs || timestampMs < receivedAtMs - maximumAgeMs) {
    throw new AppError(400, 'INVALID_EVENT_TIMESTAMP', 'Event timestamp is outside the accepted range');
  }
}

function toSessionAttribution(acquisition: ReturnType<typeof getAcquisitionData>) {
  return {
    referrer: acquisition.referrer,
    referralDomain: acquisition.referralDomain,
    source: acquisition.utmSource,
    medium: acquisition.utmMedium,
    campaign: acquisition.utmCampaign,
    content: acquisition.utmContent,
    term: acquisition.utmTerm,
    sourceCategory: acquisition.sourceCategory,
  };
}