# Phase 3 Evidence

This file distinguishes automated checks from the full live database proof. Test results are recorded only after execution.

## Automated tests

| Requirement | Evidence |
| --- | --- |
| Phase 2 validation, payload size, rate limit, honeypot, CORS, geo fallback, and safe notification behavior | `npm test` runs the Phase 2 endpoint tests and deterministic provider/notification checks. |
| Owner widget CRUD requires auth and returns expected statuses | Owner route tests cover unauthenticated `401`, create `201`, reads/updates `200`, delete `204`, and deleted-resource `404`. |
| Cross-tenant widget read/update/delete denied | Tests use two distinct authenticated tenant identities and verify the second tenant receives `404` on another tenant's widget. Repository calls use authenticated tenant scope. |
| Widget input validation and embed snippet | Tests reject invalid origins and check snippets include the actual widget ID and configured API URL. |
| Public config is minimal and origin checked | Test asserts exact response keys and `403` for a disallowed origin. |
| Widget script is delivered | Test checks `GET /widget.js` returns JavaScript containing config and submission calls. |
| Dashboard APIs are authenticated and tenant scoped | Tests verify unauthenticated `401`, authenticated response, and tenant-scoped repository calls; date spans above 90 days return `400`. |

## Browser delivery gate

**Observed:** The page at `http://localhost:5500` loaded the embed script from `http://localhost:5000`, fetched public widget config cross-origin, and rendered the `Contact us` widget with its Name and Email fields. A browser form submission displayed “Thank you. Your submission was received.” The API harness logged the submitted visitor name.

**Important limitation:** This browser run used an in-memory repository because Docker Desktop's PostgreSQL engine is unavailable. It proves cross-origin config fetch, rendering, and submission response through the actual Express routes; it does not prove durable PostgreSQL storage.

## Durable database gate

Not verified: the PostgreSQL container could not be started in this environment. After a PostgreSQL-backed browser submit, query:

```sql
SELECT id, widget_id, tenant_id, form_data, visitor_ip, geo, created_at
FROM submissions
ORDER BY created_at DESC
LIMIT 5;
```

Record the observed row/result here only after a PostgreSQL-backed run.

## Phase 3 checks performed

- `npm test` — 23 tests passed, 0 failed (Phase 2 and Phase 3).
- JavaScript syntax checks passed for application, customer site, and tests.
- `docker compose config --quiet` passed with `.env.example` values copied temporarily to `.env`; the temporary file was removed afterward.
- Environment validation passed against `.env.example`.
- Browser delivery and form submission passed across ports 5500 and 5000 using the in-memory API harness described above.
- `npm run db:up`/live database verification remains blocked by Docker Desktop: its Linux engine failed to start. Compose syntax/configuration validation did pass with the example environment values.
