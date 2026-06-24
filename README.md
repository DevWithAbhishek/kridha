# Kridha

A hyperlocal B2B + B2C self-pickup marketplace — multi-vendor checkout, geospatial seller discovery, and payment reconciliation, built and operated end to end: architecture, security model, and correctness guarantees owned start to finish.

---

## Executive Summary

**Problem.** Self-pickup commerce breaks the assumptions most e-commerce backends are built on: a single cart can span multiple independent sellers, each with their own pickup point, fulfillment timeline, and settlement, and "nearby" has to mean a real geographic radius query, not a city-level filter.

**Constraint.** Built and run by one engineer, with no dedicated ops team and no margin for silent data corruption — inventory races or payment/state mismatches aren't tolerable bugs to discover later, they're the thing the architecture has to rule out by construction.

**Solution.** A Next.js + PostgreSQL/PostGIS + Redis + Razorpay system where multi-vendor orders are decomposed into independently-tracked sub-orders, inventory writes are serialized at the database layer, and payment state is only ever trusted from a verified webhook — never from a client callback.

**Why the architecture matters.** The hard problems here were never CRUD. They were: never overselling a shared inventory pool under concurrent checkout, never trusting a client's word that a payment succeeded, and never letting one seller's order state corrupt another seller's in the same cart.

---

## Engineering Highlights

- **Refresh-token family rotation with theft detection** — reuse of an already-rotated refresh token invalidates the entire token family, not just the one token.
- **Idempotent webhook processing** — a unique constraint on the webhook event ID makes duplicate Razorpay deliveries a no-op instead of a double-processing bug.
- **Pessimistic concurrency control on inventory** — `SELECT FOR UPDATE` on hot SKUs at decrement time, chosen specifically because optimistic retries are unacceptable UX at checkout.
- **Order → SubOrder decomposition** — a multi-vendor cart's fulfillment, cancellation, and settlement states are tracked per seller, not flattened into one order record.
- **PostGIS-backed proximity search** — geography columns + GIST indexing for "sellers near me," not application-level Haversine math over a full table scan.
- **Load testing that found real defects before users did** — k6 runs against the system surfaced four distinct issues (below), not zero.

---

## Architecture Overview

```
Buyer / Seller (Web)
        │ HTTPS
        ▼
Next.js App Router  ──▶  Auth middleware (cookie-based JWT)
        │                          │
        ▼                          ▼
  Service layer  ───────▶  PostgreSQL (Neon + PostGIS)
        │                          ▲
        ▼                          │
      Redis  ── cache / rate-limit state
        │
        ▼
   Razorpay (checkout)
        │  webhook (signed)
        ▼
 Webhook handler → WebhookLog (unique constraint) → Order / SubOrder state transition
```

**Request flow.** Request → cookie-based auth middleware validates the access token → service layer → Prisma → PostgreSQL → response. Hot reads (catalog, session checks) go through Redis first; a cache miss falls through to Postgres.

**Data flow.** All multi-row writes (checkout, stock decrement, order state transitions) run inside a single database transaction — partial writes are not a state the system can be left in.

**Payment flow.** An order is created in a `pending_payment` state before the Razorpay checkout is initiated client-side. A successful client-side callback is treated as a hint, not a fact — the order only transitions to `paid` once the corresponding webhook is received and its signature verified. This is the two-phase part: client success and server truth are deliberately decoupled.

**Webhook flow.** Razorpay webhook → HMAC signature verification → event ID written to `WebhookLog` under a unique constraint → if the event ID already exists, return success without reprocessing → otherwise process the event and transition the relevant Order/SubOrder.

**Scale indicators:** 61 REST endpoints · 22 Prisma models · 39 typed error codes · 19 documented system invariants.

---

## Key Engineering Decisions

### ADR-01 — PostgreSQL (Neon, with PostGIS) over DynamoDB / MongoDB
- **Context:** Needed ACID transactions across orders, sub-orders, and inventory, plus native geospatial queries — in one engine, not two systems kept in sync.
- **Decision:** PostgreSQL with the PostGIS extension, served via Neon.
- **Alternatives considered:** DynamoDB — rejected; multi-item transactional writes across the order/inventory access pattern don't map cleanly onto its model. MongoDB — rejected; weaker cross-collection transactional guarantees than Postgres for the same multi-table writes.
- **Tradeoff accepted:** Neon scales compute to zero, which means cold starts. Mitigated with a retry wrapper around the connection client, and by using the unpooled (`DIRECT_URL`) connection string for operations — like seeding — that don't tolerate PgBouncer-style transaction pooling.

### ADR-02 — Pessimistic locking over optimistic concurrency for inventory
- **Context:** Hot SKUs face concurrent decrement attempts at checkout; overselling is a direct financial and trust cost in a multi-vendor marketplace.
- **Decision:** `SELECT FOR UPDATE` row-locks the stock row inside the same transaction as the decrement.
- **Alternatives considered:** Optimistic locking via a version column — rejected for hot paths; under real contention it produces client-facing retries at exactly the moment (checkout) where a retry is least acceptable.
- **Tradeoff accepted:** Writes to the same row serialize, capping per-SKU throughput. Acceptable because checkout volume per SKU is bounded by real-world pickup capacity, not unbounded online demand.

### ADR-03 — HttpOnly cookie auth with token-family rotation over localStorage bearer tokens
- **Context:** A client-rendered Next.js app has real XSS exposure; a token readable by JavaScript is a token stealable by JavaScript.
- **Decision:** Short-lived access tokens in `HttpOnly`, `Secure` cookies; refresh tokens grouped into rotating families.
- **Alternatives considered:** localStorage bearer tokens — rejected; directly exfiltratable via XSS, no isolation from page JS. Refresh rotation without family tracking — rejected; doesn't detect reuse of an already-rotated, stolen token.
- **Tradeoff accepted:** Cookie auth requires explicit CSRF mitigation (SameSite policy plus header-based verification on state-changing requests) and complicates a future native mobile client, which can't rely on browser cookie jars the same way.

### ADR-04 — Lazy expiry over scheduled token sweeps
- **Context:** A cron-based sweep to expire stale refresh tokens is an extra operational job with its own failure mode — a missed run silently extends how long a stale token stays valid.
- **Decision:** Expired or already-rotated tokens are rejected at the point of use. No background cleanup job exists.
- **Alternatives considered:** Scheduled cleanup job — deferred; the security property ("an expired token never authenticates") holds without it, so the job buys cleanliness, not correctness.
- **Tradeoff accepted:** Stale rows accumulate in the refresh-token table until a retention pass is added — acceptable at current data volume, explicitly listed below as a known limitation.

### ADR-05 — Geography column + GIST index over application-level distance math
- **Context:** The core discovery query is "sellers within radius R of this buyer" — the kind of query that becomes a full table scan if distance is computed in application code.
- **Decision:** PostGIS `geography` columns (not `geometry`, so distances are correct on the Earth's curved surface) indexed with GIST.
- **Alternatives considered:** Storing lat/lng as floats and computing Haversine distance per request — rejected; not indexable, doesn't survive catalog growth.
- **Tradeoff accepted:** Geography columns are strict about SRID handling. A seed-data bug surfaced exactly here — a `GENERATED ALWAYS` geography column rejected inserts from the ORM's default path; fixed with a raw SQL insert using `ST_SetSRID(ST_MakePoint(...))` against the direct (unpooled) connection.

### ADR-06 — Order → SubOrder decomposition over a flat order with seller-tagged line items
- **Context:** A single cart can span multiple sellers, each with independent pickup timing, fulfillment status, and settlement.
- **Decision:** An `Order` represents the buyer's checkout transaction; each seller's portion becomes a `SubOrder` with its own state machine.
- **Alternatives considered:** One flat order with seller-tagged line items — rejected; "ready for pickup" and "cancelled" are seller-scoped states, and flattening them produces an order that's simultaneously correct and incorrect depending on which seller you ask about.
- **Tradeoff accepted:** Every payment and refund calculation now reconciles at both the Order and SubOrder level — more bookkeeping, but it matches the actual business semantics instead of hiding the complexity.

### ADR-07 — Redis for caching and rate-limit state over in-process memory
- **Context:** Needed sub-millisecond reads for hot catalog data and a shared counter for rate limiting across instances.
- **Decision:** Redis as a cache-aside store and as the rate-limiter's backing store.
- **Alternatives considered:** In-process memory caching — rejected; doesn't survive a restart and doesn't work once the app runs as more than one instance.
- **Tradeoff accepted:** A second stateful dependency the app now depends on for correct behavior — see the rate-limiter failure mode under Performance Validation.

---

## Reliability & Failure Handling

| Failure mode | Mechanism that handles it |
|---|---|
| Database connection cold start (Neon scale-to-zero) | Retry wrapper with backoff around the connection client |
| Duplicate webhook delivery (Razorpay retries on timeout) | Unique constraint on `WebhookLog` event ID — second delivery is a no-op |
| Concurrent stock decrement on the same SKU | Row-level lock (`SELECT FOR UPDATE`) inside the order transaction |
| Stolen / replayed refresh token | Reuse of a rotated token invalidates its entire token family |
| Redis unavailable | Rate limiter fails **closed**, not open (see Performance Validation — this was not the original behavior) |
| Partial multi-table write | Entire write wrapped in a single DB transaction; no intermediate state is observable |

**Representative system invariants** (full set of 19 documented in `DESIGN.md`):

1. Stock quantity for a SKU can never go negative — enforced at the row-lock decrement, not by application-level checks alone.
2. A SubOrder cannot reach `fulfilled` before its payment capture is confirmed by webhook — a client-side success callback is never sufficient.
3. A given webhook event ID is processed at most once, regardless of delivery retries.
4. An access token cannot authenticate once its parent refresh-token family has been marked compromised.
5. An Order's total must equal the sum of its SubOrder totals at every state transition.
6. Rate-limit state failing to load fails closed, never open.

---

## Security Architecture

- **Authentication:** HttpOnly, Secure cookies carrying short-lived access tokens.
- **Token rotation:** Refresh tokens issued in rotating families; reuse of a stale token in a family invalidates the whole family, not just that token (theft detection, not just expiry).
- **Authorization:** Role-based access control (RBAC) enforced at the service layer, scoped per resource (a seller cannot act on another seller's SubOrder).
- **CSRF:** Mitigated via SameSite cookie policy combined with header-based verification on state-changing requests.
- **Rate limiting:** Redis-backed, scoped per identity/IP; fails closed if Redis is unreachable.
- **Webhook verification:** HMAC signature check on every incoming Razorpay webhook before the payload is trusted or processed.
- **Threat model addressed directly:** XSS-based token theft (cookie isolation), token replay (family rotation), webhook spoofing (signature verification), inventory races under concurrent abuse (row locks), and rate-limiter bypass under partial infrastructure failure (fail-closed default).

---

## Data Layer

- **Schema:** 22 Prisma models backing 61 REST endpoints.
- **Transactions:** Every multi-row write (checkout, stock decrement, order/sub-order transition) executes inside one database transaction.
- **Concurrency:** Pessimistic row locking (`SELECT FOR UPDATE`) for inventory; no optimistic-locking retry path on the hot checkout path.
- **PostGIS:** `geography` columns with GIST indexes for radius and nearest-pickup-point queries.
- **Caching:** Redis cache-aside for catalog and session-validation hot paths; Postgres remains the source of truth on a miss.
- **Connection handling:** Pooled connection string for normal application traffic; direct (unpooled) connection string for operations — seeding, and any raw geography insert — that are incompatible with transaction-mode pooling.

---

## Performance Validation

**Methodology.** Load testing with k6 against checkout and catalog read paths, run against a production build (not the Next.js dev server — see below).

**Results — four distinct issues surfaced, not zero:**

1. **Dev-server connection collapse.** Early runs against the local `next dev` server collapsed under concurrency. This wasn't a production bug — it was a testing-methodology lesson: a dev-mode server isn't representative of production capacity. Testing was redirected to a production build.
2. **Cart-clearing gap under stock-drain.** A scenario where stock hit zero mid-checkout exposed a gap in cart-clearing logic. Identified and corrected.
3. **Rate limiter failing open.** Stopping Redis mid-test caused the rate limiter to fail open — allowing unlimited traffic instead of blocking it. Fixed to fail closed.
4. **A false positive, caught correctly.** A test scenario using quantity-5 line items looked like an anomaly until it was traced to the platform's own ₹1000 minimum order value — the test design was reproducing real business logic, not a bug. Distinguishing this from an actual defect was itself part of the validation.

**Known limitations:** no chaos/multi-AZ failover testing yet; no automated load-test regression suite wired into CI.

---

## Monitoring & Observability

- **Logging:** Structured JSON logs via Pino, with request-scoped context for tracing a single request through the service layer.
- **Error tracking:** Currently log-based; no dedicated APM is wired in yet.
- **Alerting:** None automated yet — log review is manual.
- **Future improvements:** distributed tracing, automated alert thresholds on error rate and webhook-processing lag, and a dashboard over the existing structured logs rather than raw log search.

---

## Tradeoffs & Known Limitations

- **Single region, single primary database.** No read replica, no cross-region failover.
- **Refresh-token table has no cleanup job.** A deliberate v1 tradeoff (see ADR-04) — correctness doesn't depend on it, but storage growth eventually will.
- **No native mobile client.** Cookie-based auth assumes a browser cookie jar; a future mobile app would need a parallel auth strategy.
- **No automated load-test regression suite.** k6 runs have been manual, not CI-gated.
- **No dedicated APM/tracing.** Observability is log-based today.

These are intentional sequencing decisions for a single-engineer build, not oversights discovered after the fact.

---

## What I Would Improve Next

1. Add distributed tracing and an APM layer on top of the existing structured logs.
2. Move k6 load tests into CI as a regression gate, not a manual exercise.
3. Add a retention/cleanup job for the refresh-token table.
4. Introduce a read replica for reporting and catalog-heavy read traffic.
5. Build a basic incident runbook — current failure handling is encoded in code, not yet in an operational playbook.
6. Evaluate multi-AZ deployment for the database layer specifically, since that's the single largest remaining availability gap.

---

## Documentation Index

| Topic | Location |
|---|---|
| Architecture, system invariants, ADRs | `DESIGN.md` |
| API reference (61 endpoints) | `API.md` |
| Engineering narrative & background | `CASE_STUDY.md` |
| Load testing methodology & results | `CASE_STUDY.md` |

---

## Local Setup

```bash
git clone <repo-url>
cd kridha
npm install

cp .env.example .env
# set DATABASE_URL (pooled), DIRECT_URL (unpooled), REDIS_URL, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

npx prisma migrate deploy
npx prisma db seed

npm run dev
```

---

## Technology Choices

| Technology | Reason chosen | Tradeoff accepted |
|---|---|---|
| Next.js (App Router) | Unified frontend + API surface; fewer moving parts for a single-engineer build | Frontend and API scale together, not independently |
| PostgreSQL + PostGIS (Neon) | ACID transactions and native geospatial indexing in one engine | Serverless cold starts require explicit handling |
| Prisma | Type-safe queries, fast schema iteration | Occasionally needs a raw-SQL escape hatch (e.g. geography inserts) |
| Redis | Sub-millisecond cache + shared rate-limit state | A second stateful dependency the app must degrade around |
| Razorpay | Mature webhook ecosystem for India-first payments | At-least-once webhook delivery requires explicit idempotency handling |
| Pino | Low-overhead structured JSON logging | No built-in tracing — pairs with, doesn't replace, a future APM |

---

## Lessons Learned

Concurrency correctness is a database problem before it's an application problem — `SELECT FOR UPDATE` closed an inventory race that no amount of application-level retry logic would have. The most expensive bugs aren't the ones that crash the app; they're the ones that succeed quietly with the wrong result — the cart-clearing gap and the fail-open rate limiter were both this category, and load testing earns its place specifically by surfacing that category of bug. And infrastructure choices have application-level consequences that don't show up in documentation until you actually hit them — Neon's cold starts being the clearest example here.

---

## About The Engineer

Abhishek Kumar — B.Tech in Mechanical Engineering, NIT Allahabad (2024, 8.59 CPI). Previously worked in capex procurement at Vedanta Aluminium before transitioning into backend engineering through self-directed, project-based learning. Kridha was built with AI-assisted implementation throughout; the architecture, API contracts, security model, and correctness guarantees described above were designed and owned directly.