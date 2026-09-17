import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
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
});
