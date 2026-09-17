import { Types } from 'mongoose';
import { EventModel } from '../models/event.model.js';
import { SessionModel } from '../models/session.model.js';
import { WebsiteModel } from '../models/website.model.js';
import { AppError } from '../middleware/error-handler.js';
import { CONVERSION_EVENT_NAMES, type EventName } from '../models/event.model.js';
import type { Funnel, FunnelStep } from '../models/website.model.js';

const CONVERSION_EVENTS = CONVERSION_EVENT_NAMES;

interface DateRange {
  start: Date;
  end: Date;
}

interface EventSummary {
  visitors: number;
  sessions: number;
  pageViews: number;
}

export async function assertWebsiteAccess(ownerId: string, websiteId: string): Promise<Types.ObjectId> {
  if (!Types.ObjectId.isValid(websiteId)) {
    throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  }

  const website = await WebsiteModel.exists({ _id: websiteId, ownerId });
  if (!website) {
    throw new AppError(404, 'WEBSITE_NOT_FOUND', 'Website not found');
  }

  return new Types.ObjectId(websiteId);
}

export async function getOverview(websiteId: Types.ObjectId, range: DateRange) {
  const [summary, conversions, sessionSummary] = await Promise.all([
    getEventSummary(websiteId, range),
    getConversionSummary(websiteId, range),
    getSessionSummary(websiteId, range),
  ]);

  return {
    period: { startDate: range.start.toISOString(), endDate: range.end.toISOString() },
    visitors: summary.visitors,
    sessions: summary.sessions,
    pageViews: summary.pageViews,
    pagesPerSession: summary.sessions ? round(summary.pageViews / summary.sessions) : 0,
    averageSessionDurationSeconds: sessionSummary.averageDurationSeconds,
    conversions: conversions.total,
    conversionRate: summary.sessions ? round((conversions.convertingSessions / summary.sessions) * 100) : 0,
    conversionBreakdown: conversions.breakdown,
  };
}

export async function getTraffic(websiteId: Types.ObjectId, range: DateRange) {
  const [summary, trend] = await Promise.all([
    getEventSummary(websiteId, range),
    EventModel.aggregate([
      { $match: eventMatch(websiteId, range) },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          visitors: { $addToSet: '$visitorId' },
          sessions: { $addToSet: '$sessionId' },
          pageViews: { $sum: { $cond: [{ $eq: ['$eventName', 'page_view'] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          visitors: { $size: '$visitors' },
          sessions: { $size: '$sessions' },
          pageViews: 1,
        },
      },
      { $sort: { date: 1 } },
    ]),
  ]);

  return { period: periodResponse(range), summary, trend };
}

export async function getConversions(websiteId: Types.ObjectId, range: DateRange, funnelKey?: string) {
  const conversions = await getConversionSummary(websiteId, range);
  const summary = await getEventSummary(websiteId, range);

  if (funnelKey) {
    const website = await WebsiteModel.findById(websiteId).select('funnels').lean();
    const funnel = (website?.funnels ?? []).find((value: Funnel) => value.key === funnelKey && value.active);
    if (!funnel) throw new AppError(404, 'FUNNEL_NOT_FOUND', 'Active funnel not found');
    const funnelResult = await evaluateFunnel(websiteId, range, funnel);
    return {
      period: periodResponse(range),
      funnel: { key: funnel.key, name: funnel.name },
      steps: funnelResult.steps,
      completedSessions: funnelResult.completedSessions,
      conversionRate: summary.sessions ? round((funnelResult.completedSessions / summary.sessions) * 100) : 0,
    };
  }

  return {
    period: periodResponse(range),
    ...conversions,
    sessions: summary.sessions,
    conversionRate: summary.sessions ? round((conversions.convertingSessions / summary.sessions) * 100) : 0,
  };
}

export async function getSources(websiteId: Types.ObjectId, range: DateRange) {
  const sources = await SessionModel.aggregate([
    { $match: { websiteId, startTime: { $gte: range.start, $lt: range.end } } },
    {
      $group: {
        _id: {
          source: { $ifNull: ['$source', '(direct)'] },
          medium: { $ifNull: ['$medium', '(none)'] },
          campaign: { $ifNull: ['$campaign', '(none)'] },
          content: { $ifNull: ['$content', '(none)'] },
          term: { $ifNull: ['$term', '(none)'] },
          referralDomain: { $ifNull: ['$referralDomain', '(none)'] },
          sourceCategory: { $ifNull: ['$sourceCategory', 'Other'] },
        },
        sessions: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
      },
    },
    {
      $project: {
        _id: 0,
        source: '$_id.source',
        medium: '$_id.medium',
        campaign: '$_id.campaign',
        content: '$_id.content',
        term: '$_id.term',
        referralDomain: '$_id.referralDomain',
        sourceCategory: '$_id.sourceCategory',
        sessions: 1,
        visitors: { $size: '$visitors' },
      },
    },
    { $sort: { sessions: -1 } },
  ]);

  return { period: periodResponse(range), sources };
}

export async function getTopPages(websiteId: Types.ObjectId, range: DateRange) {
  const pages = await EventModel.aggregate([
    { $match: { ...eventMatch(websiteId, range), eventName: 'page_view' } },
    { $group: { _id: { $ifNull: ['$pagePath', '(unknown)'] }, pageViews: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
    { $project: { _id: 0, pagePath: '$_id', pageViews: 1, visitors: { $size: '$visitors' } } },
    { $sort: { pageViews: -1 } },
    { $limit: 100 },
  ]);

  return { period: periodResponse(range), pages };
}

async function getEventSummary(websiteId: Types.ObjectId, range: DateRange): Promise<EventSummary> {
  const [result] = await EventModel.aggregate([
    { $match: eventMatch(websiteId, range) },
    {
      $group: {
        _id: null,
        visitors: { $addToSet: '$visitorId' },
        sessions: { $addToSet: '$sessionId' },
        pageViews: { $sum: { $cond: [{ $eq: ['$eventName', 'page_view'] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, visitors: { $size: '$visitors' }, sessions: { $size: '$sessions' }, pageViews: 1 } },
  ]);

  return result ?? { visitors: 0, sessions: 0, pageViews: 0 };
}

async function getConversionSummary(websiteId: Types.ObjectId, range: DateRange) {
  const rows = await EventModel.aggregate([
    { $match: { ...eventMatch(websiteId, range), eventName: { $in: CONVERSION_EVENTS } } },
    { $group: { _id: '$eventName', count: { $sum: 1 }, sessions: { $addToSet: '$sessionId' } } },
  ]);
  const breakdown = Object.fromEntries(CONVERSION_EVENTS.map((eventName) => [eventName, 0]));
  const convertingSessions = new Set<string>();
  for (const row of rows) {
    breakdown[row._id] = row.count;
    row.sessions.forEach((sessionId: string) => convertingSessions.add(sessionId));
  }

  const [byPage, bySource, byDevice] = await Promise.all([
    getConversionDimension(websiteId, range, { pagePath: { $ifNull: ['$pagePath', '(unknown)'] } }, 'pagePath'),
    getConversionDimension(websiteId, range, { source: { $ifNull: ['$utmSource', '(direct)'] }, medium: { $ifNull: ['$utmMedium', '(none)'] }, sourceCategory: { $ifNull: ['$sourceCategory', 'Other'] } }, 'source'),
    getConversionDimension(websiteId, range, { device: { $ifNull: ['$device', '(unknown)'] } }, 'device'),
  ]);

  return {
    total: Object.values(breakdown).reduce((total, count) => total + count, 0),
    conversionEvents: Object.values(breakdown).reduce((total, count) => total + count, 0),
    convertingSessions: convertingSessions.size,
    breakdown,
    byPage,
    bySource,
    byDevice,
  };
}

async function getConversionDimension(websiteId: Types.ObjectId, range: DateRange, group: Record<string, unknown>, name: string) {
  return EventModel.aggregate([
    { $match: { ...eventMatch(websiteId, range), eventName: { $in: CONVERSION_EVENTS } } },
    { $group: { _id: group, conversionEvents: { $sum: 1 }, sessions: { $addToSet: '$sessionId' } } },
    { $project: { _id: 0, [name]: '$_id', conversionEvents: 1, convertingSessions: { $size: '$sessions' } } },
    { $sort: { conversionEvents: -1 } },
    { $limit: 100 },
  ]);
}

async function getFunnelEvents(websiteId: Types.ObjectId, range: DateRange) {
  return EventModel.find(eventMatch(websiteId, range), 'sessionId eventName pagePath timestamp')
    .sort({ sessionId: 1, timestamp: 1 })
    .lean();
}

async function evaluateFunnel(websiteId: Types.ObjectId, range: DateRange, funnel: Funnel) {
  const events = await getFunnelEvents(websiteId, range);
  const sessions = groupFunnelEvents(events);
  const counts = funnel.steps.map((step) => ({ key: step.key, sessions: 0, rate: 0 }));
  const completed = new Set<string>();
  for (const [sessionId, sessionEvents] of sessions) {
    let stepIndex = 0;
    for (const event of sessionEvents) {
      if (matchesFunnelStep(event, funnel.steps[stepIndex])) {
        counts[stepIndex].sessions += 1;
        stepIndex += 1;
        if (stepIndex === funnel.steps.length) { completed.add(sessionId); break; }
      }
    }
  }
  const base = counts[0]?.sessions || 0;
  return {
    steps: counts.map((step) => ({ ...step, rate: base ? round((step.sessions / base) * 100) : 0 })),
    completedSessions: completed.size,
  };
}

function groupFunnelEvents(events: Array<{ sessionId: string; eventName: string; pagePath?: string }>) {
  const sessions = new Map<string, typeof events>();
  for (const event of events) sessions.set(event.sessionId, [...(sessions.get(event.sessionId) ?? []), event]);
  return sessions;
}

function matchesFunnelStep(event: { eventName: string; pagePath?: string }, step?: FunnelStep) {
  if (!step || event.eventName !== step.eventName) return false;
  if (step.pagePath && event.pagePath !== step.pagePath) return false;
  if (step.pagePathPrefix && !event.pagePath?.startsWith(step.pagePathPrefix)) return false;
  return true;
}

async function getSessionSummary(websiteId: Types.ObjectId, range: DateRange) {
  const [result] = await SessionModel.aggregate([
    { $match: { websiteId, startTime: { $gte: range.start, $lt: range.end }, endTime: { $exists: true } } },
    { $project: { durationSeconds: { $divide: [{ $subtract: ['$endTime', '$startTime'] }, 1000] } } },
    { $group: { _id: null, averageDurationSeconds: { $avg: '$durationSeconds' } } },
  ]);

  return { averageDurationSeconds: result ? round(result.averageDurationSeconds) : 0 };
}

function eventMatch(websiteId: Types.ObjectId, range: DateRange) {
  return { websiteId, timestamp: { $gte: range.start, $lt: range.end } };
}

function periodResponse(range: DateRange) {
  return { startDate: range.start.toISOString(), endDate: range.end.toISOString() };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getAudience(websiteId: Types.ObjectId, range: DateRange) {
  const match = { websiteId, startTime: { $gte: range.start, $lt: range.end } };
  const [devices, operatingSystems, languages, timezones, viewports, screens] = await Promise.all([
    getAudienceBreakdown(match, '$device', '(unknown)'),
    getAudienceBreakdown(match, '$os', '(unknown)'),
    getAudienceBreakdown(match, '$language', '(unknown)'),
    getAudienceBreakdown(match, '$timezone', '(unknown)'),
    getAudienceBreakdown(match, '$viewportCategory', '(unknown)'),
    getAudienceBreakdown(match, '$screenCategory', '(unknown)'),
  ]);

  return {
    period: periodResponse(range),
    devices,
    operatingSystems,
    languages,
    timezones,
    viewports,
    screens,
  };
}

async function getAudienceBreakdown(match: Record<string, unknown>, field: string, fallback: string) {
  return SessionModel.aggregate([
    { $match: match },
    { $group: { _id: { $ifNull: [field, fallback] }, sessions: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
    { $project: { _id: 0, value: '$_id', sessions: 1, visitors: { $size: '$visitors' } } },
    { $sort: { sessions: -1, value: 1 } },
  ]);
}

export async function getBehavior(websiteId: Types.ObjectId, range: DateRange) {
  const [scrollDepth, engagement, outboundClicks, forms, interactionProblems, clicks] = await Promise.all([
    EventModel.aggregate([
      { $match: { ...eventMatch(websiteId, range), eventName: 'scroll_depth' } },
      { $group: { _id: { pagePath: { $ifNull: ['$pagePath', '(unknown)'] }, depthPercent: '$metadata.depthPercent' }, reached: { $sum: 1 } } },
      { $project: { _id: 0, pagePath: '$_id.pagePath', depthPercent: '$_id.depthPercent', reached: 1 } },
      { $sort: { pagePath: 1, depthPercent: 1 } },
    ]),
    SessionModel.aggregate([
      { $match: { websiteId, startTime: { $gte: range.start, $lt: range.end } } },
      { $group: { _id: null, averageActiveMs: { $avg: '$engagementTimeMs' }, sessions: { $sum: 1 }, maxScrollDepthPercent: { $avg: '$maxScrollDepthPercent' } } },
      { $project: { _id: 0, averageActiveMs: { $round: ['$averageActiveMs', 0] }, sessions: 1, averageMaxScrollDepthPercent: { $round: ['$maxScrollDepthPercent', 2] } } },
    ]),
    EventModel.aggregate([
      { $match: { ...eventMatch(websiteId, range), eventName: 'outbound_click' } },
      { $group: { _id: { origin: '$metadata.destinationOrigin', path: '$metadata.destinationPath' }, clicks: { $sum: 1 } } },
      { $project: { _id: 0, destinationOrigin: '$_id.origin', destinationPath: '$_id.path', clicks: 1 } },
      { $sort: { clicks: -1 } },
      { $limit: 100 },
    ]),
    EventModel.aggregate([
      { $match: { ...eventMatch(websiteId, range), eventName: { $in: ['form_start', 'form_submission', 'form_abandonment'] } } },
      { $group: { _id: { eventName: '$eventName', formId: { $ifNull: ['$metadata.formId', '(unknown)'] } }, count: { $sum: 1 } } },
      { $project: { _id: 0, eventName: '$_id.eventName', formId: '$_id.formId', count: 1 } },
      { $sort: { count: -1 } },
    ]),
    EventModel.aggregate([
      { $match: { ...eventMatch(websiteId, range), eventName: { $in: ['rage_click', 'dead_click'] } } },
      { $group: { _id: { eventName: '$eventName', pagePath: { $ifNull: ['$pagePath', '(unknown)'] } }, count: { $sum: 1 } } },
      { $project: { _id: 0, eventName: '$_id.eventName', pagePath: '$_id.pagePath', count: 1 } },
      { $sort: { count: -1 } },
    ]),
    EventModel.aggregate([
      { $match: { ...eventMatch(websiteId, range), eventName: 'click' } },
      {
        $group: {
          _id: {
            pagePath: { $ifNull: ['$pagePath', '(unknown)'] },
            x: { $multiply: [{ $floor: { $divide: ['$metadata.x', 100] } }, 100] },
            y: { $multiply: [{ $floor: { $divide: ['$metadata.y', 100] } }, 100] },
          },
          clicks: { $sum: 1 },
        },
      },
      { $project: { _id: 0, pagePath: '$_id.pagePath', x: '$_id.x', y: '$_id.y', clicks: 1 } },
      { $sort: { clicks: -1 } },
      { $limit: 5000 },
    ]),
  ]);

  return {
    period: periodResponse(range),
    scrollDepth,
    engagement: engagement[0] ?? { averageActiveMs: 0, sessions: 0, averageMaxScrollDepthPercent: 0 },
    outboundClicks,
    forms,
    interactionProblems,
    clicks,
  };
}