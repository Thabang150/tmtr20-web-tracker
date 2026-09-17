import { AppError } from '../middleware/error-handler.js';
import { EventModel } from '../models/event.model.js';
import { SessionModel } from '../models/session.model.js';
import { WebsiteModel } from '../models/website.model.js';
import type { TrackEventInput } from '../validators/tracking.validators.js';
import { randomUUID } from 'node:crypto';

export async function trackEvent(input: TrackEventInput): Promise<void> {
  const website = await WebsiteModel.findOne({ trackingId: input.trackingId, status: 'ACTIVE' }).select('_id');
  if (!website) {
    throw new AppError(404, 'TRACKING_ID_NOT_FOUND', 'Tracking ID is invalid or inactive');
  }

  const receivedAt = new Date();
  const timestamp = input.timestamp ?? receivedAt;
  validateTimestamp(timestamp, receivedAt);
  const eventId = input.eventId ?? randomUUID();
  const { eventId: _eventId, trackingId: _trackingId, timestamp: _timestamp, ...eventFields } = input;

  try {
    await EventModel.create({
      ...eventFields,
      eventId,
      schemaVersion: 1,
      websiteId: website._id,
      timestamp,
      receivedAt,
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
    await updateExistingSession(website._id.toString(), input, timestamp);
    return;
  }

  try {
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

    await updateExistingSession(website._id.toString(), input, timestamp);
  }
}

async function updateExistingSession(
  websiteId: string,
  input: TrackEventInput,
  timestamp: Date,
): Promise<void> {
  await SessionModel.updateOne(
    { websiteId, sessionId: input.sessionId },
    {
      $set: {
        exitPage: input.pagePath,
        endTime: timestamp,
        lastActivityAt: new Date(),
      },
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