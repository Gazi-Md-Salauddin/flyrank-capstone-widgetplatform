# Phase 2 Evidence

This file records repeatable checks for the hardened public submission path. Automated checks use `npm test`; the live database/browser checks require PostgreSQL and the separately served customer page.

## Checks and observed results

| Requirement | Observed result |
| --- | --- |
| Valid cross-origin submission is stored | Automated endpoint test passed with an injected repository; a real browser submission from the served `http://localhost:5500` page also displayed `Submission received.` The browser/API check used an in-memory repository, not PostgreSQL. |
| Invalid payload returns 4xx | Passed: malformed schema and widget field-rule cases returned `400`. |
| Oversized payload returns 4xx | Passed: request above the Express 16 KB limit returned `413`. |
| Rate limit returns 429 | Passed: a third request at the test limit returned `429`; a later request succeeded after the window reset. |
| Honeypot is blocked | Passed: filled `website_url` returned `400` and did not call storage. |
| Provider A works | Passed deterministically in mock mode; the service selected `ip-api.com`. No external provider call was made. |
| Provider A failure falls back to B | Passed deterministically with A failing and B mocked; the service selected `ipapi.co`. |
| Both providers fail without blocking submission | Passed with both providers configured to fail; endpoint returned `201` and saved a record in the injected test repository with `geo: null`. |
| Notification failure does not block submission | Passed: notification threw after repository storage, while the endpoint returned `201`. |
| OPTIONS preflight succeeds | Passed: returned `204` with the configured allowed origin and POST method. |
| Database error response is safe | Passed: simulated database failure returned generic `500` JSON without the error text. |
| Client IP ignores spoofed proxy headers | Passed: a spoofed `X-Forwarded-For` value was not stored as the visitor IP. |

**Automated command:** `npm test` — 15 tests passed, 0 failed.

**PostgreSQL runtime limitation:** `npm run db:up` could not start because Docker Desktop's Linux engine pipe was unavailable. Starting Docker Desktop was attempted, but `docker info` reported `Docker Desktop is unable to start`. Therefore, the live PostgreSQL schema, actual durable insert/query, and `npm start` with PostgreSQL have not been verified in this environment. The browser/API cross-origin check used the actual Express route and customer page, but an in-memory repository.

For the remaining live-database proof, start a working Docker daemon, run the startup steps in `README.md`, submit the form from the separate customer origin, then query:

```sql
SELECT id, widget_id, tenant_id, form_data, visitor_ip, geo, created_at
FROM submissions
ORDER BY created_at DESC
LIMIT 5;
```
