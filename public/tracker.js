(function () {
  'use strict';

  const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const CTA_KEYWORDS = [
    'get started',
    'book now',
    'request quote',
    'contact us',
    'view properties',
    'learn more',
    'apply now',
    'enquire now',
    'schedule',
    'sign up',
    'start free',
    'talk to us',
    'get a quote',
  ];

  const scriptElement = document.currentScript || Array.from(document.querySelectorAll('script[data-site-id]')).at(-1);
  if (!scriptElement) {
    return;
  }

  const siteId = (scriptElement.getAttribute('data-site-id') || '').trim();
  const scriptOrigin = scriptElement.src ? new URL(scriptElement.src, document.baseURI).origin : window.location.origin;
  const configuredApiUrl = '__TMTR20_TRACKING_API_URL__';
  const apiUrl = scriptElement.getAttribute('data-api-url') || window.TMTR20_TRACKING_API_URL || (configuredApiUrl === '__TMTR20_TRACKING_API_URL__' ? new URL('/api/track', scriptOrigin).toString() : configuredApiUrl);
  const debugMode = new URLSearchParams(window.location.search).get('tmtr20_debug') === 'true' || Boolean(window.TMTR20_TRACKING_DEBUG);

  function log(...args) {
    if (debugMode) {
      console.log('[TMTR20]', ...args);
    }
  }

  function generateId(prefix) {
    const value = typeof crypto !== 'undefined' && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint32Array(2)).reduce((sum, current) => sum + current, 0).toString(16)
      : Math.random().toString(16).slice(2);
    return `${prefix}_${value}`;
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_error) {
      // Ignore storage restrictions to keep tracking silent.
    }
  }

  function getVisitorId() {
    let visitorId = readStorage('tmtr20_visitor_id');
    if (!visitorId) {
      visitorId = generateId('visitor');
      writeStorage('tmtr20_visitor_id', visitorId);
    }
    return visitorId;
  }

  function getSessionState() {
    try {
      const raw = window.sessionStorage.getItem('tmtr20_session');
      if (!raw) {
        return null;
      }
      const state = JSON.parse(raw);
      if (!state || typeof state !== 'object') {
        return null;
      }
      return state;
    } catch (_error) {
      return null;
    }
  }

  function setSessionState(state) {
    try {
      window.sessionStorage.setItem('tmtr20_session', JSON.stringify(state));
    } catch (_error) {
      // Ignore storage restrictions.
    }
  }

  function getOrCreateSession() {
    const now = Date.now();
    const existing = getSessionState();

    if (existing && existing.sessionId && existing.startedAt) {
      const elapsed = now - Number(existing.startedAt);
      if (elapsed <= DEFAULT_SESSION_TIMEOUT_MS) {
        return existing;
      }
    }

    const state = {
      sessionId: generateId('session'),
      startedAt: now,
      hasSentStart: false,
    };

    setSessionState(state);
    return state;
  }

  function getDeviceType() {
    const userAgent = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
    const isTablet = /(iPad|Tablet|Silk)/i.test(userAgent);

    if (isMobile && !isTablet) {
      return 'mobile';
    }
    if (isTablet) {
      return 'tablet';
    }
    return 'desktop';
  }

  function getBrowserName() {
    const userAgent = navigator.userAgent || '';
    if (/Edg|EdgA|EdgiOS/i.test(userAgent)) {
      return 'Edge';
    }
    if (/OPR|Opera/i.test(userAgent)) {
      return 'Opera';
    }
    if (/Firefox/i.test(userAgent)) {
      return 'Firefox';
    }
    if (/Chrome|CriOS/i.test(userAgent)) {
      return 'Chrome';
    }
    if (/Safari/i.test(userAgent)) {
      return 'Safari';
    }
    return 'Unknown';
  }

  function getReferrer() {
    return document.referrer || '';
  }

  function getUtmData() {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmContent: params.get('utm_content') || undefined,
    };
  }

  function buildPayload(eventName, extra = {}) {
    const session = getOrCreateSession();
    const payload = {
      trackingId: siteId,
      visitorId: getVisitorId(),
      sessionId: session.sessionId,
      eventName,
      pageUrl: window.location.href,
      pagePath: window.location.pathname + window.location.search,
      referrer: getReferrer(),
      device: getDeviceType(),
      browser: getBrowserName(),
      timestamp: new Date().toISOString(),
      ...getUtmData(),
      ...extra,
    };

    return payload;
  }

  function serializePayload(payload) {
    return JSON.stringify(payload);
  }

  function sendEvent(payload) {
    if (!siteId) {
      log('No tracking ID configured; skipping event.', payload.eventName);
      return;
    }

    const body = serializePayload(payload);

    try {
      if (navigator.sendBeacon && navigator.sendBeacon(apiUrl, new Blob([body], { type: 'application/json' }))) {
        log('Event sent via sendBeacon', payload.eventName);
        return;
      }
    } catch (_error) {
      // Fall back to fetch below.
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    }).catch(() => {
      log('Tracking request failed silently.', payload.eventName);
    });
  }

  function track(eventName, extra = {}) {
    const payload = buildPayload(eventName, extra);
    sendEvent(payload);
    return payload;
  }

  function ensureSessionStarted() {
    const session = getOrCreateSession();
    if (!session.hasSentStart) {
      track('session_start', {
        pageUrl: window.location.href,
        pagePath: window.location.pathname + window.location.search,
      });
      session.hasSentStart = true;
      setSessionState(session);
    }
  }

  let lastTrackedPage = '';

  function trackPageView(force = false) {
    const nextPage = window.location.href;
    if (!force && nextPage === lastTrackedPage) {
      return;
    }

    lastTrackedPage = nextPage;
    track('page_view', {
      pageUrl: nextPage,
      pagePath: window.location.pathname + window.location.search,
      referrer: getReferrer(),
    });
  }

  function normalizeText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function getElementText(element) {
    if (!element) {
      return '';
    }

    const label = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('data-label');
    if (label) {
      return normalizeText(label);
    }

    return normalizeText(element.textContent || '');
  }

  function isCtaElement(element) {
    const text = normalizeText(getElementText(element)).toLowerCase();
    if (!text) {
      return false;
    }

    if (element.matches('button, [role="button"], input[type="submit"], input[type="button"], a')) {
      if (CTA_KEYWORDS.some((keyword) => text.includes(keyword))) {
        return true;
      }

      const negativeMatches = /close|cancel|back|next|previous|menu|search|submit/i;
      if (!negativeMatches.test(text) && text.length <= 80) {
        return true;
      }
    }

    return false;
  }

  function handleOutboundLink(event) {
    const link = event.target.closest('a');
    if (!link) {
      return;
    }

    const href = (link.getAttribute('href') || '').trim();
    if (!href) {
      return;
    }

    if (/^https?:\/\/(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)|^whatsapp:|^https?:\/\/.*\bwa\.me\b/i.test(href)) {
      event.preventDefault();
      track('whatsapp_click', {
        pageUrl: window.location.href,
        pagePath: window.location.pathname + window.location.search,
        metadata: {
          destination: href,
        },
      });
      window.setTimeout(() => {
        window.location.href = href;
      }, 120);
      return;
    }

    if (/^tel:/i.test(href)) {
      event.preventDefault();
      track('phone_click', {
        pageUrl: window.location.href,
        pagePath: window.location.pathname + window.location.search,
        metadata: {
          destination: href,
        },
      });
      window.setTimeout(() => {
        window.location.href = href;
      }, 120);
      return;
    }

    if (/^mailto:/i.test(href)) {
      event.preventDefault();
      track('email_click', {
        pageUrl: window.location.href,
        pagePath: window.location.pathname + window.location.search,
        metadata: {
          destination: href,
        },
      });
      window.setTimeout(() => {
        window.location.href = href;
      }, 120);
    }
  }

  function handleClickableCta(event) {
    const target = event.target.closest('a, button, input[type="submit"], [role="button"]');
    if (!target || !isCtaElement(target)) {
      return;
    }

    const label = normalizeText(getElementText(target));
    track('cta_click', {
      pageUrl: window.location.href,
      pagePath: window.location.pathname + window.location.search,
      metadata: {
        ctaText: label.slice(0, 120),
        targetUrl: (target.getAttribute('href') || '').trim(),
      },
    });
  }

  function handleFormSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const formName = form.getAttribute('id') || form.getAttribute('name') || form.getAttribute('data-name') || form.getAttribute('action') || 'unknown';
    track('form_submission', {
      pageUrl: window.location.href,
      pagePath: window.location.pathname + window.location.search,
      metadata: {
        formId: formName,
        formAction: form.getAttribute('action') || '',
      },
    });
  }

  function initialize() {
    if (!siteId) {
      log('TMTR20 tracking script is missing data-site-id.');
      return;
    }

    log('TMTR20 analytics initialized', { siteId, apiUrl });

    ensureSessionStarted();
    trackPageView(true);

    document.addEventListener('click', handleOutboundLink, true);
    document.addEventListener('click', handleClickableCta, true);
    document.addEventListener('submit', handleFormSubmit, true);

    const pushState = window.history.pushState;
    window.history.pushState = function (...args) {
      const result = pushState.apply(this, args);
      setTimeout(() => {
        ensureSessionStarted();
        trackPageView(true);
      }, 0);
      return result;
    };

    const replaceState = window.history.replaceState;
    window.history.replaceState = function (...args) {
      const result = replaceState.apply(this, args);
      setTimeout(() => {
        ensureSessionStarted();
        trackPageView(true);
      }, 0);
      return result;
    };

    window.addEventListener('popstate', () => {
      ensureSessionStarted();
      trackPageView(true);
    });
  }

  initialize();
})();
