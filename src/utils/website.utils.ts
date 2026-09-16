import { randomBytes } from 'node:crypto';

export function normalizeWebsiteUrl(value: string): { url: string; domain: string } {
  const parsedUrl = new URL(value);
  parsedUrl.hash = '';
  parsedUrl.hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/, '');

  return {
    url: parsedUrl.toString(),
    domain: parsedUrl.hostname,
  };
}

export function generateTrackingId(): string {
  return `tmtr_${randomBytes(16).toString('hex')}`;
}