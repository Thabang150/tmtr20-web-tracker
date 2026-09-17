import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { getAcquisitionData, getReferralDomain } from '../src/utils/acquisition.utils.js';
import { normalizeAudience } from '../src/utils/audience.utils.js';
import { funnelSchema } from '../src/validators/funnel.validators.js';
import { isPrivateAddress } from '../src/services/website-audit.service.js';
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

test('accepts behavior event names with bounded metadata', () => {
  for (const eventName of ['scroll_depth', 'engagement_time', 'outbound_click', 'form_start', 'form_abandonment', 'rage_click', 'dead_click']) {
    const result = trackEventSchema.safeParse({
      eventId: `event_${eventName}`,
      trackingId: 'tmtr_0123456789abcdef0123456789abcdef',
      visitorId: 'visitor_123',
      sessionId: 'session_123',
      eventName,
      metadata: { depthPercent: 25, activeMs: 15000, formId: 'contact' },
    });

    assert.equal(result.success, true, eventName);
  }
});

test('accepts normalized heatmap click metadata', () => {
  const result = trackEventSchema.safeParse({
    eventId: 'event_click_001',
    trackingId: 'tmtr_0123456789abcdef0123456789abcdef',
    visitorId: 'visitor_123',
    sessionId: 'session_123',
    eventName: 'click',
    metadata: {
      x: 4250,
      y: 3175,
      viewportX: 5000,
      viewportY: 2500,
      scrollPercent: 50,
      targetTag: 'button',
      targetId: 'primary-cta',
    },
  });

  assert.equal(result.success, true);
});

test('rejects invalid heatmap click coordinates and unknown metadata', () => {
  const result = trackEventSchema.safeParse({
    eventId: 'event_click_002',
    trackingId: 'tmtr_0123456789abcdef0123456789abcdef',
    visitorId: 'visitor_123',
    sessionId: 'session_123',
    eventName: 'click',
    metadata: {
      x: 10001,
      y: -1,
      viewportX: 5000,
      viewportY: 2500,
      scrollPercent: 50,
      targetTag: 'button',
      cursorPath: 'not allowed',
    },
  });

  assert.equal(result.success, false);
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
  assert.match(trackerSource, /track\('scroll_depth'/);
  assert.match(trackerSource, /track\('engagement_time'/);
  assert.match(trackerSource, /track\('form_start'/);
  assert.match(trackerSource, /track\('outbound_click'/);
  assert.match(trackerSource, /track\('click', \{ metadata: getHeatmapMetadata/);
  assert.match(trackerSource, /data-tmtr20-no-track/);
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

test('accepts a bounded ordered conversion funnel', () => {
  const result = funnelSchema.safeParse({
    key: 'lead-generation',
    name: 'Lead generation',
    active: true,
    steps: [
      { key: 'landing', name: 'Landing', eventName: 'page_view', pagePath: '/services' },
      { key: 'submit', name: 'Submit', eventName: 'form_submission', pagePath: '/contact' },
    ],
  });

  assert.equal(result.success, true);
});

test('rejects invalid funnel step definitions', () => {
  const result = funnelSchema.safeParse({
    key: 'bad funnel',
    name: 'Invalid',
    steps: [
      { key: 'same', name: 'One', eventName: 'page_view', pagePath: '/a', pagePathPrefix: '/a' },
      { key: 'same', name: 'Two', eventName: 'page_view', pagePath: '/b' },
    ],
  });

  assert.equal(result.success, false);
});

test('blocks private IPv4 and IPv6 audit addresses', () => {
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('172.16.0.10'), true);
  assert.equal(isPrivateAddress('192.168.1.20'), true);
  assert.equal(isPrivateAddress('::1'), true);
  assert.equal(isPrivateAddress('8.8.8.8'), false);
});

test('exposes the cross-dimension intelligence analytics route', async () => {
  const [serviceSource, routeSource] = await Promise.all([
    readFile(path.resolve(process.cwd(), 'src', 'services', 'analytics.service.ts'), 'utf8'),
    readFile(path.resolve(process.cwd(), 'src', 'routes', 'analytics.routes.ts'), 'utf8'),
  ]);

  assert.match(serviceSource, /export async function getIntelligence/);
  assert.match(serviceSource, /conversionEvents/);
  assert.match(serviceSource, /landingPage/);
  assert.match(routeSource, /analyticsController\.intelligence/);
});
