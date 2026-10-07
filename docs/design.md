# Embeddable Widget & Lead-Capture Platform

## 1. Problem

Businesses need a simple way to collect leads from websites they control without building and maintaining a separate form backend for each site. This platform lets an owner configure reusable widgets, embed them on a customer website, and manage the resulting submissions and basic performance statistics in one place.

## 2. System Actors

- **Widget Owner** — Authenticates to create, configure, publish, and manage widgets, and to review their submissions and dashboard statistics.
- **Customer Website** — An external website where the owner places the widget's embed script. It loads the widget code and displays the configured form to its visitors.
- **Website Visitor** — A person who sees a widget on a customer website and submits its form. The visitor does not need an owner account.

## 3. Widget Data Model

| Field | Purpose |
| --- | --- |
| `id` | Unique, unguessable widget identifier; also used to request public configuration. |
| `tenant_id` | Identifies the owner/account that owns the widget. |
| `type` | Widget presentation/form type, initially a single lead-capture form. |
| `title` | Short heading shown on the widget. |
| `description` | Optional explanatory text shown with the form. |
| `form_fields` | Ordered field definitions (for example, name, email, and message), including labels, input types, required status, and validation constraints. |
| `button_text` | Text shown on the submit button. |
| `display_options` | Small set of presentation options, such as theme and placement; not arbitrary scripts or HTML. |
| `allowed_origins` | Customer-site origins permitted to load configuration and submit this widget. |
| `created_at`, `updated_at` | UTC timestamps for creation and last update. |

Widgets are tenant-scoped: every owner API query and mutation must constrain by both the authenticated `tenant_id` and widget `id`. A widget ID alone never grants owner access. Public endpoints may use the widget ID to locate the public configuration, but can expose only publishable settings and must enforce that widget's origin and submission rules. An unknown widget and a widget belonging to another tenant should not be distinguishable through owner APIs.

## 4. Submission Data Model

| Field | Purpose |
| --- | --- |
| `id` | Unique submission identifier. |
| `widget_id` | Widget that received the submission. |
| `tenant_id` | Owning tenant, stored for efficient tenant-scoped reads and isolation. |
| `form_data` | Validated submitted values keyed by the configured field identifiers. |
| `visitor_ip` | Client IP as observed by the trusted application/proxy configuration; restrict access and retention. |
| `geo` | Optional enrichment such as country code, region, and city, plus provider/status metadata when useful. |
| `origin` | Request origin, when present, for diagnostics and abuse monitoring. |
| `user_agent` | Optional request user-agent for diagnostics. |
| `created_at` | UTC submission timestamp. |

Index `widget_id` and `tenant_id` for widget- and tenant-scoped listing, and index `created_at` (or a composite `(tenant_id, created_at)`) for recent-submission and date-range dashboard queries. Add a composite `(tenant_id, widget_id, created_at)` if widget-filtered dashboard queries need it. Do not index arbitrary form values by default; they are variable and may contain personal data. Apply pagination and bounded date ranges to listing queries.

## 5. Embed Flow

1. The customer creates a widget through the authenticated owner API.
2. The API returns the widget's public identifier and a one-line embed snippet. The snippet uses a conceptual script URL, for example `<script src="<widget-script-url>" data-widget-id="<widget-id>" async></script>`; the actual URL is configured for the running environment and is not a production domain assumption.
3. The customer places that line in the HTML of a website served from another origin (for local development, a separate local port).
4. `widget.js` loads, reads the widget identifier, and requests `GET /api/widgets/:id/config`.
5. The public config API checks the request origin against the widget's allowed origins and returns only public display and form configuration. `widget.js` renders the form on the customer page.
6. A visitor fills in and submits the form. The widget sends the values to `POST /api/submissions` with the widget identifier.
7. The submission API validates the widget, origin, payload, rate limits, and spam controls, then attempts geo enrichment on a best-effort basis and stores the submission even if enrichment is unavailable. Email/webhook notification runs after storage and cannot make the submission fail.

## 6. API Surface

### Authenticated Owner APIs

All owner endpoints require an authenticated session or bearer credential. The authenticated identity determines `tenant_id`; clients cannot select another tenant by supplying an ID.

| Method and path | Purpose and important input | Expected response/status |
| --- | --- | --- |
| `POST /api/widgets` | Create a widget from type, title, description, form fields, button text, display options, and allowed origins. | `201` with the created widget and embed snippet; `400` for invalid input. |
| `GET /api/widgets` | List the current tenant's widgets; supports bounded pagination. | `200` with a paginated widget list. |
| `GET /api/widgets/:id` | Read one widget belonging to the current tenant. | `200` with widget; `404` if not found in that tenant. |
| `PATCH /api/widgets/:id` | Update permitted configuration fields for a tenant-owned widget. | `200` with updated widget; `400` for invalid input, `404` if not found in that tenant. |
| `DELETE /api/widgets/:id` | Delete a tenant-owned widget (and apply the documented submission retention/deletion policy). | `204` on success; `404` if not found in that tenant. |

### Public Widget APIs

These endpoints do not require owner authentication. They are scoped by widget ID, origin policy, validation, and rate limits.

| Method and path | Purpose and important input | Expected response/status |
| --- | --- | --- |
| `GET /api/widgets/:id/config` | Fetch publishable form/display configuration; requires a permitted `Origin` where available. | `200` with public config; `404` for unknown/unavailable widget; `403` for a disallowed origin. |
| `POST /api/submissions` | Accept a widget ID and form values; validate against the widget's current field rules. | `201` with a submission receipt; `400` for invalid data, `404` for unknown widget, `429` when rate limited. |

### Dashboard APIs

Dashboard endpoints require owner authentication and derive tenant scope from the authenticated identity.

| Method and path | Purpose and important input | Expected response/status |
| --- | --- | --- |
| `GET /api/dashboard/submissions` | List the tenant's submissions, optionally filtered by widget and bounded date range; supports pagination. | `200` with submission records and pagination metadata; `400` for invalid filters. |
| `GET /api/dashboard/stats` | Return basic counts, such as submissions by widget and over a bounded date range. | `200` with aggregate statistics. |

Unauthenticated owner/dashboard requests receive `401`; authenticated access to a resource outside the tenant scope receives `404`.

## 7. Security & Resilience Design

- **CORS and origins:** Allow only the configured customer-site origins for public widget requests. Do not use wildcard origins with credentials. CORS is a browser control, not authentication; validate the `Origin` against the widget's allowlist on configuration and submission requests when supplied.
- **Request validation:** Validate owner input, public payloads, and configured field constraints with Zod. Reject unknown or malformed values where appropriate, and never trust client-supplied tenant IDs, widget rules, or forwarded IP headers from untrusted proxies.
- **Payload limits:** Set a small request-body limit suitable for form submissions. Reject oversized requests with `413` before processing or storing them.
- **Rate limiting:** Limit by observed IP and widget ID, with stricter limits for public submissions; return `429` and avoid relying on a single client-controlled identifier.
- **Spam protection:** Include a hidden honeypot field and reject or safely discard likely bot submissions. Keep the public widget usable without an account for visitors.
- **Tenant isolation:** Derive tenant identity from authenticated credentials and scope every owner/dashboard database operation by tenant. Enforce the same ownership check for widget updates and deletion; never accept a caller-provided tenant ID as authorization.
- **IP geolocation fallback:** Treat geolocation as best-effort. Try provider A, then provider B if A fails or yields no usable result. Record the result or an explicit unavailable status. If both providers fail, store the submission with geo unavailable and continue successfully.
- **Email/webhook side effects:** Run notifications only after the submission is durably stored. A failed email or webhook is logged/retried as appropriate, but does not roll back storage or turn the submission response into a failure.
- **Secrets:** Read database credentials and provider/email/webhook secrets from environment variables at runtime. Keep local secret files out of version control; do not place secrets in widget configuration, embed snippets, or source code.

**Critical behavior:** Geo enrichment and non-critical email/webhook side effects must never cause the main submission to fail after valid submission data has been accepted and stored.

## 8. Architecture

```text
Widget Owner
    |
    v
Authenticated Widget API ------> Database

Customer Website
    |
    v
widget.js ------> Public Config API ------> Widget rendered on page
                                            |
Website Visitor ----------------------------+
    |
    v
Public Submission API
    |
    v
Validation
    |
    v
Rate Limit / Spam Protection
    |
    v
Geo Enrichment (best-effort)
    |
    v
Database
    |
    +------> Email/Webhook side effect (best-effort)

Owner
    |
    v
Dashboard API ------> Tenant-scoped Submission/Analytics data
```

## 9. Explicit Non-Goal

This project will not build a real CDN. The embed script and widget JavaScript will be served by the application in the local/development setup; introducing CDN infrastructure is unnecessary for demonstrating the capstone's core backend flows.

## 10. Technology Choice

- **Runtime:** Node.js
- **HTTP framework:** Express
- **Database:** PostgreSQL
- **Local environment:** Docker
- **Request/schema validation:** Zod
- **Second-origin customer website:** Plain HTML served separately, such as on another local port

The backend remains the primary project focus; this design does not implement the application.
