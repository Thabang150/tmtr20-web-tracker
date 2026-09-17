# TMTR20 Backend Capabilities

Current baseline for the TMTR20 Website Intelligence backend.

## Core stack

- Node.js 20+ with TypeScript and Express
- MongoDB with Mongoose models
- Render web-service deployment support
- Helmet security headers, CORS, request limits, rate limiting, structured logging, and centralized error handling

## Public website tracking

A customer website loads the public script:

```html
<script
  src="https://tmtr20-web-tracker.onrender.com/tracker.js"
  data-site-id="tmtr_<website-tracking-id>"
  defer>
</script>
```

The script runs in the visitor's browser and sends events to `POST /api/track`. It currently records:

- `session_start`
- `page_view`
- `whatsapp_click`
- `phone_click`
- `email_click`
- `form_submission`
- `cta_click`

It also captures anonymous visitor/session IDs, page URL and path, referrer, UTM parameters including `utm_term`, device type, browser, coarse operating system, language, timezone, viewport category, screen category, and timestamps. The backend derives a normalized referral domain and classifies traffic as Direct, Organic Search, Paid Search, Social, Paid Social, Video, Referral, Email, or Other. Session records retain first-touch and last-touch acquisition data plus an audience snapshot. It does not collect form values, passwords, raw user agents, exact screen sizes, or invasive device fingerprints.

Each new event now has an event ID and schema version. The backend records both the client event timestamp and a server receipt timestamp, rejects timestamps that are more than five minutes in the future or 30 days old, and treats repeated event IDs for the same website as an idempotent duplicate. Sessions also track their latest activity time.

The tracker asset is intentionally available cross-origin, and the public tracking endpoint supports cross-origin browser requests. Valid tracking events return `202 Accepted` and are stored in MongoDB.

## Authentication

Dashboard users can:

- Register
- Log in
- Refresh access tokens
- Log out and revoke refresh tokens
- Retrieve the current user

Dashboard and management routes require a JWT access token. Passwords are hashed, and refresh tokens are stored as hashes.

## Website management

Authenticated users can:

- Create websites and receive server-generated tracking IDs
- List their own websites
- View one website
- Update website details
- Archive websites instead of physically deleting them

Tracking events are associated with a website through its active tracking ID.

## Analytics

Authenticated website owners can query:

- Overview metrics
- Traffic trends
- Conversion metrics
- Sources and campaigns
- Top pages
- Audience breakdowns by device, operating system, language, timezone, viewport category, and screen category
- Behaviour analytics for scroll depth, active engagement time, outbound clicks, form lifecycle, and interaction problems
- Conversion analytics by event, page, source, device, and unique converting session
- Website-owned conversion funnel definitions and ordered funnel reporting

Analytics are calculated from stored events and sessions for a requested date range. Audience breakdowns are session-based to avoid repeatedly aggregating stable technology values from every event.

## Website audits

Authenticated users can run and view website audits. Audits currently inspect items such as:

- HTTP status and response time
- HTTPS
- Page title, meta description, and H1
- Viewport configuration
- `robots.txt` and sitemap
- Selected security headers

Audit results are saved historically, with latest-audit access available.

## Monthly reports

Authenticated users can:

- Generate monthly report data
- List historical reports
- Retrieve the latest report
- Download a generated PDF
- Email a report through configured SMTP

Reports reuse analytics and the latest website audit.

## Operational endpoints

- `GET /` confirms the service is responding.
- `GET /health` reports service and MongoDB health.
- `GET /tracker.js` serves the public browser tracker.

## Route summary

- Public: `/tracker.js`, `/api/track`, `/health`, `/`
- Authentication: `/api/auth/*`
- Website management: `/api/websites/*`
- Analytics, audits, and reports: `/api/websites/:id/*`

The audience analytics endpoint is `GET /api/websites/:id/audience` and requires dashboard authentication and website ownership.

The behavior analytics endpoint is `GET /api/websites/:id/behavior` and requires dashboard authentication and website ownership. The tracker emits bounded scroll thresholds, visibility-aware engagement intervals, navigation metadata, outbound link events, form starts and abandonments, and conservative rage/dead-click signals. It does not collect form values, keystrokes, exact cursor paths, or full DOM text.

Conversion analytics are available at `GET /api/websites/:id/conversions`. Headline conversion rate is based on unique sessions containing at least one conversion event; total conversion event count remains available separately. Optional funnel definitions are managed through `GET/POST /api/websites/:id/funnels`, `PATCH/DELETE /api/websites/:id/funnels/:funnelKey`, and evaluated with `?funnel=<key>` on the conversions endpoint.

Behavior analytics also includes a heatmap data foundation. The tracker emits one normalized `click` point per ordinary click, excluding form controls, editable content, and elements marked with `data-tmtr20-no-track`. Coordinates are stored as integer basis points and aggregated into 1% page-position cells. The system stores no screenshots, cursor paths, or session video.

The authenticated dashboard routes remain protected while only the tracker asset and public tracking endpoint are configured for cross-origin use.

## Current boundaries

- The backend records events sent by the browser; it does not independently crawl or monitor customer websites.
- Tracking requires a valid active website tracking ID.
- Analytics depend on the tracker successfully loading and the event request reaching the backend.
- MongoDB is required for event, session, user, website, audit, token, and report persistence.
- The current tracker is intentionally lightweight and does not provide consent management, bot filtering, advanced attribution, real-time dashboards, or custom event definitions yet.

This document is a baseline for planning future upgrades.
