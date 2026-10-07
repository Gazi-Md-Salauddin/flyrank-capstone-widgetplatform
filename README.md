# flyrank-capstone-widgetplatform

An embeddable widget and lead-capture platform that accepts validated visitor submissions from an external customer website and stores them with optional IP geolocation. Phase 2 implements the hardened public submission path only; widget configuration delivery, owner APIs, and the dashboard are not implemented.

## Technology stack

Node.js, Express, PostgreSQL, Docker Compose, Zod, and plain HTML for the separate-origin customer test page.

## Install and configure

Requirements: Node.js 20+ and Docker Compose.

```powershell
npm install
Copy-Item .env.example .env
```

The example file uses a local placeholder password. Set the same local-only password in `POSTGRES_PASSWORD` and in the password portion of `DATABASE_URL` in `.env`. The database initializes the demo widget on its first start.

Environment variables:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Environment (`development` for local testing). |
| `PORT`, `HOST` | API listen address; default `5000` and `localhost`. |
| `POSTGRES_PASSWORD` | Local Docker PostgreSQL password. |
| `DATABASE_URL` | API connection URL for PostgreSQL. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact customer origins; default `http://localhost:5500`. No wildcard or credentials. |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | Per-client-IP submission limit and window. |
| `GEO_PROVIDER_A_MODE`, `GEO_PROVIDER_B_MODE` | `live`, `mock`, or `fail`; non-live modes are development/test only. |
| `NOTIFICATION_MODE` | `console` or deterministic development/test `fail`. |

By default the local example uses mock geolocation so tests do not depend on external providers. To call `ip-api.com` and then `ipapi.co`, set both geo modes to `live`. For deterministic fallback demonstrations use `A=fail, B=mock`; for both unavailable use `A=fail, B=fail`. Restart the API after changing `.env`.

## Start PostgreSQL and API

```powershell
npm run db:up
npm start
```

The API listens at `http://localhost:5000`. Health check: `GET http://localhost:5000/health`. The seeded demo widget ID is `11111111-1111-4111-8111-111111111111`. The database init SQL permits `http://localhost:5500` for that widget. Add any extra permitted origin to both `CORS_ALLOWED_ORIGINS` and the widget's `allowed_origins` database value.

## Start the customer test page

In a second terminal:

```powershell
npm run customer-site
```

Open `http://localhost:5500`. This page sends a real browser JSON POST to the API on port 5000, exercising cross-origin CORS preflight. The hidden `website_url` honeypot must remain empty.

## Test a submission

Submit the customer form, then query PostgreSQL for stored records:

```powershell
docker compose exec db psql -U widgetplatform -d widgetplatform -c "SELECT id, widget_id, tenant_id, form_data, visitor_ip, geo, created_at FROM submissions ORDER BY created_at DESC LIMIT 5;"
```

Run the automated checks (they use an injected repository for deterministic endpoint tests and do not require PostgreSQL):

```powershell
npm test
```

The public endpoint is `POST /api/submissions`. It accepts `widget_id`, `form_data`, and the optional hidden honeypot `website_url`. It stores records only after payload and widget field/origin checks. Geo and notification failures do not fail a stored submission.

**Current status:** Phase 2 — Hardened Submission Path
