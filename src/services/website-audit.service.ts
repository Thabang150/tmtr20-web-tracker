import { Types } from 'mongoose';
import { AppError } from '../middleware/error-handler.js';
import { WebsiteAuditModel } from '../models/website-audit.model.js';
import { WebsiteModel } from '../models/website.model.js';

const REQUEST_TIMEOUT_MS = 15_000;

export async function runAudit(ownerId: string, websiteId: string) {
  const website = await getOwnedWebsite(ownerId, websiteId);
  if (website.status !== 'ACTIVE') {
    throw new AppError(409, 'WEBSITE_NOT_ACTIVE', 'Only active websites can be audited');
  }

  assertSafeAuditUrl(website.url);
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
      html = await response.text();
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
    const response = await fetch(new URL(path, base), { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

function assertSafeAuditUrl(value: string): void {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new AppError(400, 'UNSAFE_AUDIT_URL', 'Website URL must use HTTP or HTTPS');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || /^127\.|^10\.|^192\.168\./.test(url.hostname)) {
    throw new AppError(400, 'UNSAFE_AUDIT_URL', 'Private website addresses cannot be audited');
  }
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