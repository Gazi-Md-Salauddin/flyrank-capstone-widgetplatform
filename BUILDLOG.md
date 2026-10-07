# Build Log

## Phase 2 — Hardened Submission Path

- **AI assistance used:** Copilot-assisted code authoring and review for the Express/PostgreSQL layered setup, Zod payload validation, CORS policy, rate limiting, honeypot handling, provider fallback abstraction, notification isolation, cross-origin sample page, tests, and documentation.
- **What was changed:** Implemented the public `POST /api/submissions` flow, local PostgreSQL schema and demo widget, deterministic geo/notification test modes, dependency-free second-origin test-page server, automated tests, environment example, and Phase 2 run/evidence documentation.
- **What was changed from initial suggestions:** Rate limiting is by the trusted socket IP only (rather than using arbitrary widget IDs as map keys), avoiding client-controlled key growth while satisfying the per-IP requirement. Geo enrichment is separately guarded in the controller so even an unexpected service-level failure cannot interrupt persistence.
- **Mistakes discovered:** Initial rate-limit keying by both IP and submitted widget ID would have allowed arbitrary widget IDs to create unnecessary in-memory buckets. It was narrowed to trusted IP before tests. Initial example provider modes were changed to deterministic development mocks so local behavior can be exercised without external services; live mode remains available.
- **Verification:** `npm test` passed all 15 tests. A browser submission from the separate-origin customer page succeeded against a temporary Express harness with an in-memory repository. Docker Desktop's Linux engine could not start, so PostgreSQL initialization, durable storage, and running `npm start` against the database remain unverified; this limitation is recorded in `EVIDENCE.md`.
