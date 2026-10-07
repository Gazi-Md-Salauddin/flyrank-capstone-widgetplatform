# flyrank-capstone-widgetplatform

Embeddable lead-capture widgets with a hardened public submission path, owner widget APIs, safe cross-origin widget delivery, and a tenant-scoped dashboard API.

## Technology stack

Node.js, Express, PostgreSQL, Docker Compose, Zod, and a small plain-JavaScript widget delivered from the API. `customer-site/` is a plain HTML site on a separate local origin for the browser proof.

## Install and configure

Requirements: Node.js 20+ and Docker Compose.

```powershell
npm install
Copy-Item .env.example .env
```

Set the same local-only password in `POSTGRES_PASSWORD` and in the password portion of `DATABASE_URL`. Replace `OWNER_API_TOKEN` with a locally generated random token of at least 32 characters (for example, `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`). `OWNER_TENANT_ID` defaults to the seeded demo tenant. Never commit `.env`.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` for local use. Test provider modes are rejected in production. |
| `PORT`, `HOST` | API listen address; default `5000` and `localhost`. |
| `POSTGRES_PASSWORD`, `DATABASE_URL` | Docker database password and API PostgreSQL connection. |
| `API_BASE_URL` | API origin inserted into the owner embed snippet; default `http://localhost:5000`. |
| `OWNER_API_TOKEN`, `OWNER_TENANT_ID` | Local owner bearer credential and its tenant. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact browser origins. Default `http://localhost:5500`; no wildcard or credentials. |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | Public submission limit per observed client IP. |
| `GEO_PROVIDER_A_MODE`, `GEO_PROVIDER_B_MODE` | `live`, `mock`, or `fail`; non-live modes are development/test only. |
| `NOTIFICATION_MODE` | `console` or deterministic development/test `fail`. |

## Start PostgreSQL and API

```powershell
npm run db:up
npm start
```

The API is available at `http://localhost:5000`. On startup, it applies the idempotent schema/seed SQL so existing local databases receive the widget columns required for delivery. `GET /health` is the health check.

The cross-origin browser gate was verified with the real customer page and Express config/render/submit routes using an in-memory repository. PostgreSQL-backed persistence was not verified in the current environment because Docker Desktop's Linux engine could not start; see [EVIDENCE.md](./EVIDENCE.md).

The seeded widget ID is `11111111-1111-4111-8111-111111111111`; it permits `http://localhost:5500`. The owner APIs use `Authorization: Bearer <OWNER_API_TOKEN>`. To create a widget:

```powershell
$headers = @{ Authorization = "Bearer YOUR_LOCAL_OWNER_API_TOKEN" }
$body = @{
  type = "lead_capture"
  title = "Newsletter"
  description = "Get occasional updates."
  form_fields = @(@{ name = "email"; label = "Email"; type = "email"; required = $true; max_length = 254 })
  button_text = "Subscribe"
  display_options = @{ theme = "light" }
  allowed_origins = @("http://localhost:5500")
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/widgets -Headers $headers -ContentType "application/json" -Body $body
```

The response includes `embed_snippet`. `GET /api/widgets/:id/embed` returns that snippet separately. Copy it into the customer site's HTML.

## Start the cross-origin widget proof

In another terminal:

```powershell
npm run customer-site
```

Open `http://localhost:5500`. The page includes the seeded widget's embed script from port 5000. The script fetches the public config, renders a form, and submits to the public endpoint. To use a different owner-created widget, replace the ID in `customer-site/index.html`; permit the page origin in both the widget's `allowed_origins` and `CORS_ALLOWED_ORIGINS`.

## API surface

### Owner APIs (Bearer authentication required)

- `POST /api/widgets` — create and return a widget plus embed snippet.
- `GET /api/widgets` — list the authenticated tenant's widgets.
- `GET /api/widgets/:id` — read an owned widget.
- `GET /api/widgets/:id/embed` — retrieve its embed snippet.
- `PATCH /api/widgets/:id` — update an owned widget.
- `DELETE /api/widgets/:id` — soft-delete an owned widget; existing submissions are retained.
- `GET /api/dashboard/submissions` — tenant-scoped, paginated submission list.
- `GET /api/dashboard/stats` — tenant-scoped counts by widget.

The local capstone configures one owner token/tenant pair. Owner SQL still scopes every operation by that authenticated tenant; a widget outside the tenant scope returns `404`.

### Public APIs

- `GET /api/widgets/:id/config` — minimal public render configuration, checked against allowed origins.
- `GET /widget.js?id=<widget-id>` — embeddable widget bundle.
- `POST /api/submissions` — validated, rate-limited lead capture with honeypot, best-effort geo, durable insert, then best-effort notification.

Dashboard date filters accept ISO timestamps via `from` and `to`, with a maximum 90-day span; submissions also accept `limit` (1–100), `offset`, and `widget_id`. Default date range is the most recent 30 days.

## Database query and automated tests

After a browser submission, inspect stored records:

```powershell
docker compose exec db psql -U widgetplatform -d widgetplatform -c "SELECT id, widget_id, tenant_id, form_data, visitor_ip, geo, created_at FROM submissions ORDER BY created_at DESC LIMIT 5;"
```

Run all submission, delivery, owner isolation, dashboard, and CORS tests:

```powershell
npm test
```

The tests use injected repositories and deterministic provider/notification behavior. See [EVIDENCE.md](./EVIDENCE.md) for actual results and environment-specific limitations.

**Current status:** Phase 3 — Delivery, Dashboard & Proof
