import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { getAcquisitionData, getReferralDomain } from '../src/utils/acquisition.utils.js';
import { normalizeAudience } from '../src/utils/audience.utils.js';
import { trackEventSchema } from '../src/validators/tracking.validators.js';

test('accepts a versioned tracker event with an event ID', () => {
  const result = trackEventSchema.safeParse({
    eventId: 'event_123',
    trackingId: 'tmtr_0123456789abcdef0123456789abcdef',
    visitorId: 'visitor_123',
    sessionId: 'session_123',
    eventName: 'page_view',
    timestamp: new Date().toISOString(),
  });

  assert.equal(result.success, true);
});

test('rejects a blank event ID when supplied', () => {
  const result = trackEventSchema.safeParse({
    eventId: '   ',
    trackingId: 'tmtr_0123456789abcdef0123456789abcdef',
    visitorId: 'visitor_123',
    sessionId: 'session_123',
    eventName: 'page_view',
  });

  assert.equal(result.success, false);
});

test('tracker source creates an event ID for every payload', async () => {
  const trackerSource = await readFile(path.resolve(process.cwd(), 'public', 'tracker.js'), 'utf8');

  assert.match(trackerSource, /eventId:\s*generateId\('event'\)/);
  assert.match(trackerSource, /utmTerm: params\.get\('utm_term'\)/);
  assert.match(trackerSource, /os: getOperatingSystem\(\)/);
  assert.match(trackerSource, /viewportCategory: getViewportCategory\(\)/);
});

test('classifies paid search and normalizes the referral domain', () => {
  const acquisition = getAcquisitionData({
    referrer: 'https://www.google.com/search?q=tmtr20',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'spring',
    utmTerm: 'analytics',
  });

  assert.equal(acquisition.referralDomain, 'www.google.com');
  assert.equal(acquisition.sourceCategory, 'Paid Search');
  assert.equal(acquisition.utmTerm, 'analytics');
});

test('classifies empty acquisition data as direct', () => {
  assert.equal(getAcquisitionData({}).sourceCategory, 'Direct');
  assert.equal(getReferralDomain('not-a-url'), undefined);
});

test('normalizes supported audience fields and removes invalid values', () => {
  assert.deepEqual(normalizeAudience({
    os: 'Android',
    language: 'en-ZA',
    timezone: 'Africa/Johannesburg',
    viewportCategory: 'small',
    screenCategory: 'large',
  }), {
    os: 'Android',
    language: 'en-ZA',
    timezone: 'Africa/Johannesburg',
    viewportCategory: 'small',
    screenCategory: 'large',
  });

  assert.deepEqual(normalizeAudience({ os: 'Unknown OS', language: 'not valid', timezone: 'Not/AZone', viewportCategory: 'exact' }), {
    os: undefined,
    language: undefined,
    timezone: undefined,
    viewportCategory: undefined,
    screenCategory: undefined,
  });
});
