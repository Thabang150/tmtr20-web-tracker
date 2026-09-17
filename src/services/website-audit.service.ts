import dns from 'node:dns/promises';
import net from 'node:net';
import { Types } from 'mongoose';
import { AppError } from '../middleware/error-handler.js';
import { WebsiteAuditModel } from '../models/website-audit.model.js';
import { WebsiteModel } from '../models/website.model.js';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_RESOURCE_BYTES = 256 * 1024;
const MAX_RESOURCES = 20;

export async function runAudit(ownerId: string, websiteId: string) {
  const website = await getOwnedWebsite(ownerId, websiteId);
  if (website.status !== 'ACTIVE') {
    throw new AppError(409, 'WEBSITE_NOT_ACTIVE', 'Only active websites can be audited');
  }

  await assertSafeAuditUrl(website.url);
  const scanDate = new Date();
  const issues: { category: string; code: string; message: string }[] = [];
  const recommendations: string[] = [];
  const startedAt = Date.now();
  let response: Response;
  let html = '';

  try {
    response = await fetch(website.url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'user-agent': 'TMTR20-Website-Audit/1.0' },
    });
    if (response.ok || response.status >= 300 && response.status < 400) {
      html = await readResponseText(response, MAX_HTML_BYTES);
      if (!isHtmlResponse(response)) {
        issues.push({ category: 'technical', code: 'NON_HTML_RESPONSE', message: 'The website did not return an HTML document.' });
        html = '';
      }
    }
  } catch {
    issues.push({ category: 'performance', code: 'UNREACHABLE', message: 'The website could not be reached.' });
    recommendations.push('Verify that the website is online and responds within 15 seconds.');
    return saveAudit(website._id, {
      scanDate,
      performanceScore: 0,
      seoScore: 0,
      accessibilityScore: 0,
      mobileScore: 0,
      securityScore: website.url.startsWith('https://') ? 50 : 0,
      https: website.url.startsWith('https://'),
      robotsTxtAvailable: false,
      sitemapAvailable: false,
      pageCount: 0,
      issues,
      recommendations,
      responseTimeMs: Date.now() - startedAt,
    });
  }

  const responseTimeMs = Date.now() - startedAt;
  const https = website.url.startsWith('https://');
  const title = extractTag(html, 'title');
  const description = extractMetaDescription(html);
  const h1Count = countTag(html, 'h1');
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const robotsTxtAvailable = await resourceExists(website.url, '/robots.txt');
  const sitemapAvailable = await resourceExists(website.url, '/sitemap.xml');
  const securityHeaders = ['strict-transport-security', 'content-security-policy', 'x-content-type-options']
    .filter((header) => response.headers.has(header));
  const details = await collectAuditDetails(website.url, html, response, issues, responseTimeMs);

  if (!response.ok) issues.push({ category: 'technical', code: 'HTTP_STATUS', message: `Website returned HTTP ${response.status}.` });
  if (responseTimeMs > 3000) issues.push({ category: 'performance', code: 'SLOW_RESPONSE', message: 'Initial response took more than 3 seconds.' });
  if (!https) issues.push({ category: 'security', code: 'NO_HTTPS', message: 'Website does not use HTTPS.' });
  if (!title) issues.push({ category: 'seo', code: 'MISSING_TITLE', message: 'Page is missing a title.' });
  if (!description) issues.push({ category: 'seo', code: 'MISSING_DESCRIPTION', message: 'Page is missing a meta description.' });
  if (h1Count === 0) issues.push({ category: 'seo', code: 'MISSING_H1', message: 'Page is missing an H1 heading.' });
  if (!viewport) issues.push({ category: 'mobile', code: 'MISSING_VIEWPORT', message: 'Page is missing a responsive viewport declaration.' });
  if (!robotsTxtAvailable) issues.push({ category: 'seo', code: 'MISSING_ROBOTS', message: 'robots.txt was not found.' });
  if (!sitemapAvailable) issues.push({ category: 'seo', code: 'MISSING_SITEMAP', message: 'sitemap.xml was not found.' });
  if (securityHeaders.length < 2) issues.push({ category: 'security', code: 'WEAK_HEADERS', message: 'Fewer than two recommended security headers were found.' });
  if (details.accessibility?.imagesMissingAlt && Number(details.accessibility.imagesMissingAlt) > 0) issues.push({ category: 'accessibility', code: 'IMAGES_MISSING_ALT', message: 'Some images are missing alternative text.' });
  if (details.seo?.canonical === false) issues.push({ category: 'seo', code: 'MISSING_CANONICAL', message: 'The page does not declare a canonical URL.' });
  if (details.security?.mixedContent === true) issues.push({ category: 'security', code: 'MIXED_CONTENT', message: 'The page contains insecure HTTP resources.' });

  if (!title || !description || h1Count === 0) recommendations.push('Add complete title, meta description, and H1 content.');
  if (!robotsTxtAvailable || !sitemapAvailable) recommendations.push('Publish robots.txt and sitemap.xml for crawl guidance.');
  if (!https || securityHeaders.length < 2) recommendations.push('Improve HTTPS configuration and security response headers.');
  if (responseTimeMs > 3000) recommendations.push('Investigate hosting, caching, and asset delivery performance.');

  return saveAudit(website._id, {
    scanDate,
    performanceScore: score(response.ok && responseTimeMs <= 3000),
    seoScore: score(Boolean(title), Boolean(description), h1Count > 0, robotsTxtAvailable, sitemapAvailable),
    accessibilityScore: score(h1Count > 0, viewport),
    mobileScore: score(viewport),
    securityScore: score(https, securityHeaders.length >= 2),
    httpStatus: response.status,
    responseTimeMs,
    https,
    robotsTxtAvailable,
    sitemapAvailable,
    pageCount: 1,
    issues,
    recommendations,
    details,
  });
}

export async function listAudits(ownerId: string, websiteId: string) {
  await getOwnedWebsite(ownerId, websiteId);
  return WebsiteAuditModel.find({ websiteId }).sort({ scanDate: -1 });
}

export async function getLatestAudit(ownerId: string, websiteId: string) {
  await getOwnedWebsite(ownerId, websiteId);
  return WebsiteAuditModel.findOne({ websiteId }).sort({ scanDate: -1 });
}

async function getOwnedWebsite(ownerId: string, websiteId: string) {
  if (!Types.ObjectId.isValid(websiteId)) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  const website = await WebsiteModel.findOne({ _id: websiteId, ownerId });
  if (!website) throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  return website;
}

async function saveAudit(websiteId: Types.ObjectId, data: Omit<Parameters<typeof WebsiteAuditModel.create>[0], 'websiteId'>) {
  return WebsiteAuditModel.create({ websiteId, ...data });
}

async function resourceExists(baseUrl: string, path: string): Promise<boolean> {
  try {
    const base = new URL(baseUrl);
    const target = new URL(path, base);
    await assertSafeAuditUrl(target.toString());
    const response = await fetch(target, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5000) });
    await readResponseText(response, MAX_RESOURCE_BYTES);
    return response.ok;
  } catch {
    return false;
  }
}

async function assertSafeAuditUrl(value: string): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new AppError(400, 'UNSAFE_AUDIT_URL', 'Website URL must use HTTP or HTTPS');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) {
    throw new AppError(400, 'UNSAFE_AUDIT_URL', 'Private website addresses cannot be audited');
  }
  const addresses = net.isIP(url.hostname) ? [url.hostname] : (await dns.lookup(url.hostname, { all: true })).map((entry) => entry.address);
  if (addresses.some(isPrivateAddress)) throw new AppError(400, 'UNSAFE_AUDIT_URL', 'Private website addresses cannot be audited');
}

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [first, second] = address.split('.').map(Number);
    return first === 10 || first === 127 || first === 0 || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31) || (first === 169 && second === 254);
  }
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('::ffff:127.');
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total <= maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('Response body exceeded limit');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

function isHtmlResponse(response: Response): boolean {
  return (response.headers.get('content-type') || '').toLowerCase().includes('text/html');
}

async function collectAuditDetails(baseUrl: string, html: string, response: Response, issues: Array<{ category: string; code: string; message: string }>, responseTimeMs: number) {
  const resourceUrls = extractResourceUrls(baseUrl, html);
  const resources = await Promise.all(resourceUrls.map(async (url) => {
    try {
      await assertSafeAuditUrl(url);
      const resourceResponse = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
      await readResponseText(resourceResponse, MAX_RESOURCE_BYTES);
      return { url, status: resourceResponse.status, ok: resourceResponse.ok };
    } catch {
      return { url, status: 0, ok: false };
    }
  }));
  const failedResourceCount = resources.filter((resource) => !resource.ok).length;
  if (failedResourceCount > 0) issues.push({ category: 'technical', code: 'FAILED_RESOURCES', message: `${failedResourceCount} referenced resources could not be loaded.` });
  const imageMatches = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesMissingAlt = imageMatches.filter((image) => !/\balt\s*=\s*["'][^"']*["']/i.test(image)).length;
  const formControlsMissingLabels = (html.match(/<(input|select|textarea)\b/gi) ?? []).length - (html.match(/<label\b/gi) ?? []).length;
  const headers = Object.fromEntries(['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy'].map((name) => [name, response.headers.get(name)]));
  return {
    performance: { responseTimeMs, contentType: response.headers.get('content-type'), bytes: Number(response.headers.get('content-length') || 0), resourceCount: resources.length, failedResourceCount },
    seo: { titleLength: extractTag(html, 'title')?.length ?? 0, canonical: /<link\b[^>]*rel=["']canonical["']/i.test(html), lang: /<html\b[^>]*lang=["'][^"']+["']/i.test(html), openGraph: /<meta\b[^>]*property=["']og:/i.test(html), structuredData: /<script\b[^>]*type=["']application\/ld\+json["']/i.test(html) },
    accessibility: { imagesMissingAlt, formControlsMissingLabels: Math.max(0, formControlsMissingLabels), landmarks: /<(main|nav|header|footer|aside)\b/i.test(html), headingOrder: true },
    security: { headers, mixedContent: baseUrl.startsWith('https://') && resourceUrls.some((url) => url.startsWith('http:')) },
    resources,
    javascript: { runtimeErrorsAvailable: false, errors: [] },
  };
}

function extractResourceUrls(baseUrl: string, html: string): string[] {
  const urls = new Set<string>();
  const pattern = /<(?:script|link|img)\b[^>]+(?:src|href)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === new URL(baseUrl).origin && ['http:', 'https:'].includes(url.protocol)) urls.add(url.toString());
    } catch { /* Ignore malformed resource references. */ }
    if (urls.size >= MAX_RESOURCES) break;
  }
  return [...urls];
}

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1].replace(/<[^>]+>/g, '').trim() || null;
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  return match?.[1].trim() || null;
}

function countTag(html: string, tag: string): number {
  return (html.match(new RegExp(`<${tag}(?:\\s|>)`, 'gi')) ?? []).length;
}

function score(...checks: boolean[]): number {
  return checks.length ? Math.round((checks.filter(Boolean).length / checks.length) * 100) : 0;
}