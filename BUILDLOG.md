# Build Log

## Phase 2 — Hardened Submission Path

- **AI assistance used:** Copilot-assisted implementation/review for the layered Express/PostgreSQL setup, Zod validation, CORS, rate limiting, honeypot, provider fallback, notification isolation, second-origin page, tests, and documentation.
- **Changes:** Implemented public submission storage with deterministic geo and notification modes and added Phase 2 tests and evidence.
- **Corrections:** Limited in-memory rate limiting to trusted client IP instead of client-controlled widget IDs. Guarded geolocation independently so unexpected failures are non-critical. Mocked provider modes provide deterministic local fallback tests.
- **Verification:** 15 tests passed. A cross-origin browser form submission succeeded against Express with an in-memory repository. Docker's Linux engine could not start; the PostgreSQL-backed flow remained unverified at the Phase 2 checkpoint.

## Phase 3 — Delivery, Dashboard & Proof

- **AI assistance used:** Copilot-assisted implementation and testing for owner-authenticated widget CRUD, public config delivery, safe DOM-based widget rendering, tenant-scoped dashboard queries, migration-safe schema setup, cross-origin proof, and documentation.
- **Changes:** Added single configured owner bearer-token/tenant authentication, widget create/list/read/update/soft-delete and snippet APIs, public config API, `/widget.js`, owner dashboard list/stats endpoints, schema columns/migration/seed update, and focused Phase 3 tests.
- **Security choices:** Owner and dashboard queries use the authenticated tenant ID rather than caller-supplied tenant IDs. Public config explicitly selects only renderable fields. Widget text is inserted with DOM `textContent`, and form types/origins are validated.
- **Mistakes discovered:** The first test harness had no separate public widget page; the Phase 3 customer page now loads the actual embed script and renders into its container. The database initialization SQL alone would not apply to an existing Docker volume, so startup now also runs the idempotent schema/seed SQL.
- **Verification:** `npm test` passed all 23 tests; JavaScript syntax, example environment validation, and `docker compose config --quiet` passed. A browser on `http://localhost:5500` fetched config from port 5000, rendered the widget, and submitted successfully to the in-memory API harness. Docker Desktop's Linux engine is still unavailable, so PostgreSQL startup and durable storage remain unverified.
