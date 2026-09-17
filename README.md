# TMTR20 Website Intelligence

Backend foundation for website tracking, analytics, audits, and monthly reports.

## Phase 1 and Phase 2

Phase 1 provides the TypeScript/Express application shell, environment validation, MongoDB connection handling, Helmet, CORS, request limits, rate limiting, structured logging, centralized error responses, and health endpoints. Phase 2 adds registration, login, access-token authentication, refresh-token rotation, logout, and the current-user endpoint.

## Requirements

- Node.js 20 or newer
- MongoDB 7 or newer, local or hosted

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and replace both JWT secrets with random values of at least 32 characters. Start MongoDB, then run:

```powershell
npm run dev
```

The API listens on `http://localhost:3000` by default.

## Phase 1 checks

```powershell
npm run typecheck
npm run build
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/
```

`/health` reports whether the application can currently see an established MongoDB connection.

## Authentication API

All authentication routes are under `/api/auth`:

- `POST /register` creates an `ADMIN` account. The role is assigned server-side.
- `POST /login` returns an access token and refresh token.
- `POST /refresh` rotates a refresh token and revokes the previous one.
- `POST /logout` revokes the supplied refresh token.
- `GET /me` requires `Authorization: Bearer <accessToken>`.

Access tokens are short-lived. Refresh tokens are persisted as SHA-256 hashes and expire after seven days. Passwords are hashed with bcrypt and never returned in API responses.

Example registration:

```powershell
http POST :3000/api/auth/register name="Test User" email="test@example.com" password="correct-horse-battery-staple"
```

Example login:

```powershell
http POST :3000/api/auth/login email="test@example.com" password="correct-horse-battery-staple"
```

Use the returned `accessToken` with:

```powershell
http GET :3000/api/auth/me "Authorization:Bearer <accessToken>"
```

## Website API

All website routes require `Authorization: Bearer <accessToken>`:

- `POST /api/websites` creates a website and assigns ownership from the token.
- `GET /api/websites` lists only websites owned by the authenticated user.
- `GET /api/websites/:id` retrieves one owned website.
- `PATCH /api/websites/:id` updates an owned website.
- `DELETE /api/websites/:id` archives an owned website rather than physically deleting it.

Website URLs must use `http` or `https`. URLs are normalized, domains are lowercased, and tracking IDs are generated server-side. The client cannot submit an `ownerId`.

Example create request:

```powershell
http POST :3000/api/websites `
	"Authorization:Bearer <accessToken>" `
	name="TMTR20 Demo" `
	url="https://Example.com/landing" `
	timezone="Africa/Johannesburg"
```

## Tracking API

`POST /api/track` is public and does not use dashboard JWT authentication. It requires a valid active website tracking ID. Requests are limited to 120 per IP per minute, use a 100KB body limit, and accept only the supported event names.

Supported events:

`page_view`, `session_start`, `whatsapp_click`, `phone_click`, `email_click`, `form_submission`, `cta_click`, `scroll_depth`, `engagement_time`, `outbound_click`, `form_start`, `form_abandonment`, `rage_click`, `dead_click`, `click`

Example:

```powershell
http POST :3000/api/track `
	trackingId="tmtr_<tracking-id>" `
	visitorId="visitor-123" `
	sessionId="session-123" `
	eventName="page_view" `
	pageUrl="https://example.com/services" `
	pagePath="/services" `
	referrer="https://google.com" `
	utmSource="google" `
	utmMedium="organic" `
	device="desktop" `
	browser="Chrome"
```

Accepted events return `202` with `{ "accepted": true }`. Events are tied to the website resolved from the tracking ID. Sessions are upserted by `(websiteId, sessionId)` and page-view events increment their page-view count.

Conversion analytics are available through the authenticated `GET /api/websites/:id/conversions` endpoint. The response includes conversion event totals, unique converting sessions, conversion breakdowns by page/source/device, and a session-based conversion rate. Website owners can define bounded funnels with `GET/POST /api/websites/:id/funnels` and evaluate one with `?funnel=<key>`.

The `click` event stores only normalized, bucketable coordinates for heatmap aggregation. It excludes form controls and editable content, and the backend does not store screenshots, cursor paths, or session video. Behavior and heatmap aggregates are available through the authenticated `GET /api/websites/:id/behavior` endpoint.

## Real website tracking script

The project now exposes a public browser tracker at `/tracker.js` so real external websites can send analytics into the existing backend without changing the core analytics architecture.

### Install the tracker on a website

```html
<script
  src="http://localhost:3000/tracker.js"
  data-site-id="tmtr_<tracking-id>"
  defer>
</script>
```

For production, use the hosted tracker URL configured by the environment, for example:

```html
<script
  src="https://analytics.tmtr20.com/tracker.js"
  data-site-id="tmtr_<tracking-id>"
  defer>
</script>
```

The script automatically:

- creates or reuses an anonymous visitor ID in localStorage
- creates or reuses a session ID with a 30-minute inactivity timeout
- sends `session_start` once per new session
- sends `page_view` on page load and SPA route changes
- tracks WhatsApp, telephone, email, form, and CTA clicks
- captures UTM parameters, referrer, browser, and device metadata
- fails silently if the analytics endpoint is unavailable

### Browser debug mode

Append `?tmtr20_debug=true` to the page URL to enable lightweight console logging for development.

The demo page is intentionally not part of the backend deployment. Use a real client website or a temporary HTML page in a separate project when testing installation.

## Analytics API

All analytics routes require `Authorization: Bearer <accessToken>` and ownership of the requested website:

- `GET /api/websites/:id/overview`
- `GET /api/websites/:id/traffic`
- `GET /api/websites/:id/conversions`
- `GET /api/websites/:id/sources`
- `GET /api/websites/:id/top-pages`

Every route requires `startDate` and `endDate` query parameters. Date-only values are interpreted as UTC calendar dates, with `endDate` inclusive.

Example:

```powershell
http GET ":3000/api/websites/<website-id>/overview?startDate=2026-09-01&endDate=2026-09-30" `
	"Authorization:Bearer <accessToken>"
```

The overview returns visitors, sessions, page views, pages per session, average session duration, conversions, conversion rate, and conversion breakdown. Traffic returns daily trends; sources returns source/medium/campaign rows; top-pages returns page-view rankings.

## Website Audit API

All audit routes require `Authorization: Bearer <accessToken>` and ownership of the requested website:

- `POST /api/websites/:id/audits` runs a new audit. The website must be active.
- `GET /api/websites/:id/audits` returns historical audits, newest first.
- `GET /api/websites/:id/audits/latest` returns the newest audit or `null`.

The current audit engine checks HTTP status, response time, HTTPS, title, meta description, H1, viewport, robots.txt, sitemap.xml, and selected security headers. Each run is saved as a separate historical document. The engine is intentionally lightweight and can later be extended with PageSpeed or Lighthouse integrations.

Example:

```powershell
http POST :3000/api/websites/<website-id>/audits `
	"Authorization:Bearer <accessToken>"
```

## Monthly Report API

All report routes require `Authorization: Bearer <accessToken>` and ownership of the requested website:

- `POST /api/websites/:id/reports/monthly` generates report data for a period.
- `GET /api/websites/:id/reports` returns historical reports, newest first.
- `GET /api/websites/:id/reports/latest` returns the newest report or `null`.
- `GET /api/websites/:id/reports/:reportId/pdf` downloads the generated PDF.
- `POST /api/websites/:id/reports/:reportId/email` emails the PDF to the website owner.

Report generation reuses the analytics service and latest website audit. The period is unique per website, so repeating the same request returns the existing report rather than creating a duplicate. PDF files are stored under `REPORT_STORAGE_PATH`, which defaults to `storage/reports`. Filenames use the website name and month, for example `TMTR20-site-for-B-September-2026-report.pdf`.

Example:

```powershell
http POST :3000/api/websites/<website-id>/reports/monthly `
	"Authorization:Bearer <accessToken>" `
	periodStart="2026-09-01" `
	periodEnd="2026-10-01"
```

After generation, copy the report `_id` and download its PDF:

```powershell
http GET :3000/api/websites/<website-id>/reports/<report-id>/pdf `
	"Authorization:Bearer <accessToken>" `
	--download --output tmtr20-report.pdf
```

Email the report after configuring SMTP:

```powershell
http POST :3000/api/websites/<website-id>/reports/<report-id>/email `
	"Authorization:Bearer <accessToken>"
```

The email is sent to the website owner’s login email by default and includes the PDF attachment. To provide another recipient:

```powershell
http POST :3000/api/websites/<website-id>/reports/<report-id>/email `
	"Authorization:Bearer <accessToken>" `
	recipientEmail="client@example.com"
```

Successful delivery changes the report status to `SENT`; failed delivery changes it to `FAILED`. The sender is always configured by `REPORT_EMAIL_FROM`.

Required email environment variables:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
REPORT_EMAIL_FROM=reports@example.com
```

## Monthly Scheduler

The scheduler processes every active website, generates the previous completed UTC calendar month, generates its PDF, emails it to the website owner, and records `SENT` or `FAILED` status. Each website is handled independently, and the unique report period prevents duplicate report records on repeated runs.

The scheduler is disabled by default:

```env
REPORT_SCHEDULER_ENABLED=false
REPORT_SCHEDULER_CRON=0 2 1 * *
```

Enable it for production with:

```env
REPORT_SCHEDULER_ENABLED=true
REPORT_SCHEDULER_CRON=0 2 1 * *
```

For a local smoke test, temporarily use `REPORT_SCHEDULER_CRON=* * * * *` and set `REPORT_SCHEDULER_ENABLED=true`, then start the server and watch the logs. Restore the monthly expression and disable the scheduler afterward to avoid repeated test emails.

## Deploying the backend to Render

Render is the recommended host for this backend because it runs as a persistent Node/Express service, maintains a MongoDB connection, serves `/tracker.js`, and can run the monthly scheduler. Vercel serverless functions are not a good fit for this process-oriented architecture.

This repository includes `render.yaml` for a Blueprint deployment and `Dockerfile` for container-based hosting.

### Render setup

1. Push this backend repository to GitHub.
2. In Render, choose **New +** then **Blueprint** and select the repository.
3. Render will use `render.yaml` to build with `npm ci && npm run build` and start with `npm start`.
4. Set the Blueprint's secret environment values:
	 - `MONGODB_URI`: your MongoDB Atlas connection string.
	 - `CORS_ORIGIN`: the exact frontend origin, such as `https://app.example.com`. Use comma-separated origins for more than one frontend.
	 - `TRACKING_SCRIPT_URL`: `https://<your-render-service>.onrender.com/tracker.js`.
	 - `TRACKING_API_URL`: `https://<your-render-service>.onrender.com/api/track`.
	 - SMTP variables only if report email is enabled.
5. In MongoDB Atlas, add Render's outbound access as allowed network access. For an initial deployment, `0.0.0.0/0` works technically but should be restricted when your hosting network policy allows it.
6. Confirm the deployment health check at `https://<your-render-service>.onrender.com/health`.
7. Confirm the tracker file at `https://<your-render-service>.onrender.com/tracker.js`.

Do not commit `.env`, database credentials, SMTP credentials, or JWT secrets. Use `.env.example` as the local template and Render's environment settings for production secrets.

### Render free-tier note

Render's free web services can sleep after inactivity. The first tracking request after sleep may be delayed or missed by a visitor leaving immediately. Use an always-on plan for dependable production analytics, or keep the service warm with an external health check if that fits your deployment policy.

## Connecting a real external website

1. Start the backend locally or deploy it to Render.
2. Create the website through the authenticated dashboard/API. The backend generates the `trackingId`; never invent or expose an owner ID in the browser.
3. Copy the generated tracking ID from the website record.
4. Add this snippet inside the external website's `<head>`:

```html
<script
	src="https://<your-render-service>.onrender.com/tracker.js"
	data-site-id="tmtr_<tracking-id-from-tmtr20>"
	defer>
</script>
```

The served script uses the backend's `TRACKING_API_URL` configuration automatically. You can override it explicitly with `data-api-url="https://<your-render-service>.onrender.com/api/track"` when a proxy or custom domain separates the script and API hosts.

5. Publish the external website and visit it once.
6. Confirm the browser Network panel shows `POST /api/track` requests returning `202`.
7. Use the dashboard analytics endpoints with the website's authenticated owner account to confirm sessions and page views.

The same snippet works in plain HTML, WordPress/custom HTML headers, React's public HTML template, and Next.js `app/layout.tsx` or `pages/_document.tsx`. Replace only the `src` URL and `data-site-id`; do not put JWTs, MongoDB credentials, or other backend secrets in the snippet.

For local testing, use `http://localhost:3000/tracker.js` and a real active tracking ID. The external page must be opened from a web server rather than relying on `file://` when testing browser requests.

The tracker automatically sends `session_start` and `page_view`, reuses anonymous visitor/session IDs, detects SPA navigation, and records WhatsApp, phone, email, form, and CTA events. It does not collect form values or passwords. Add `?tmtr20_debug=true` to a test page URL for non-sensitive console diagnostics.

## Planned architecture

`User -> Website -> Event, Session, Lead, WebsiteAudit, MonthlyReport`

Every analytics record is website-scoped. Authenticated website and analytics routes will enforce ownership server-side. The public tracking route will use a website tracking ID, strict validation, and separate rate limits.