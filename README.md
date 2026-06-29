# Kridha

A hyperlocal B2B + B2C self-pickup marketplace — multi-vendor checkout, geospatial seller discovery, and payment reconciliation, built and operated end to end: architecture, security model, and correctness guarantees owned start to finish.

---

## Executive Summary

**Problem.** Self-pickup commerce breaks the assumptions most e-commerce backends are built on: a single cart can span multiple independent sellers, each with their own pickup point, fulfillment timeline, and settlement, and "nearby" has to mean a real geographic radius query, not a city-level filter.

**Constraint.** Built and run by one engineer, with no dedicated ops team and no margin for silent data corruption — inventory races or payment/state mismatches aren't tolerable bugs to discover later, they're the thing the architecture has to rule out by construction.

**Solution.** A Next.js + PostgreSQL/PostGIS + Redis + Razorpay system where multi-vendor orders are decomposed into independently-tracked sub-orders, inventory writes are serialized at the database layer, and payment state is only ever trusted from a verified webhook — never from a client callback.

---

## Engineering Highlights

| Problem                               | Solution                                             |
| ------------------------------------- | ---------------------------------------------------- |
| Refresh token replay attacks          | Token family rotation with theft detection           |
| Duplicate Razorpay webhook deliveries | Idempotent webhook processing using unique event IDs |
| Concurrent inventory overselling      | `SELECT FOR UPDATE` row locking                      |
| Multi-vendor order state complexity   | Order → SubOrder decomposition                       |
| Slow proximity-based seller discovery | PostGIS geography + GiST indexes                     |
| Hidden production defects             | k6 load testing before deployment                    |

---

## Architecture Overview

```
                         Client (Buyer / Seller)
                                 │
                                 │ HTTPS
                                 ▼
                    Next.js App Router (Frontend)
                                 │
                                 ▼
                  Auth Middleware (JWT Cookies)
                                 │
                                 ▼
                        Service / API Layer
                       ┌─────────┴─────────┐
                       ▼                   ▼
               Redis (Cache)      PostgreSQL + PostGIS
                       │
                       ▼
                 HTTP Response


               Razorpay Checkout
                      │
             Signed Webhook Event
                      ▼
            Webhook Verification
                      ▼
          WebhookLog (Unique Event ID)
                      ▼
         Order / SubOrder State Update
```

The application follows a layered architecture where authenticated requests flow from the Next.js App Router through the service layer before reaching PostgreSQL, with Redis accelerating cacheable reads and rate-limiting state. Payment processing is intentionally isolated from the request path: Razorpay webhooks are verified, deduplicated, and become the only authority allowed to transition payment state.

**Scale indicators:** 61 REST endpoints · 22 Prisma models · 39 typed error codes · 19 documented system invariants.

---

## Key Engineering Decisions

### ADR-01 — Pessimistic locking over optimistic concurrency for inventory
- **Context:** Hot SKUs face concurrent decrement attempts at checkout; overselling is a direct financial and trust cost in a multi-vendor marketplace.
- **Decision:** `SELECT FOR UPDATE` row-locks the stock row inside the same transaction as the decrement.
- **Alternatives considered:** Optimistic locking via a version column — rejected for hot paths; under real contention it produces client-facing retries at exactly the moment (checkout) where a retry is least acceptable.
- **Tradeoff accepted:** Writes to the same row serialize, capping per-SKU throughput. Acceptable because checkout volume per SKU is bounded by real-world pickup capacity, not unbounded online demand.

### ADR-02 — HttpOnly cookie auth with token-family rotation over localStorage bearer tokens
- **Context:** A client-rendered Next.js app has real XSS exposure; a token readable by JavaScript is a token stealable by JavaScript.
- **Decision:** Short-lived access tokens in `HttpOnly`, `Secure` cookies; refresh tokens grouped into rotating families.
- **Alternatives considered:** localStorage bearer tokens — rejected; directly exfiltratable via XSS, no isolation from page JS. Refresh rotation without family tracking — rejected; doesn't detect reuse of an already-rotated, stolen token.
- **Tradeoff accepted:** Cookie auth requires explicit CSRF mitigation (SameSite policy plus header-based verification on state-changing requests) and complicates a future native mobile client, which can't rely on browser cookie jars the same way.

### ADR-03 — Lazy expiry over scheduled token sweeps
- **Context:** A cron-based sweep to expire stale refresh tokens is an extra operational job with its own failure mode — a missed run silently extends how long a stale token stays valid.
- **Decision:** Expired or already-rotated tokens are rejected at the point of use. No background cleanup job exists.
- **Alternatives considered:** Scheduled cleanup job — deferred; the security property ("an expired token never authenticates") holds without it, so the job buys cleanliness, not correctness.
- **Tradeoff accepted:** Stale rows accumulate in the refresh-token table until a retention pass is added — acceptable at current data volume, explicitly listed below as a known limitation.

### ADR-04 — Geography column + GIST index over application-level distance math
- **Context:** The core discovery query is "sellers within radius R of this buyer" — the kind of query that becomes a full table scan if distance is computed in application code.
- **Decision:** PostGIS `geography` columns (not `geometry`, so distances are correct on the Earth's curved surface) indexed with GIST.
- **Alternatives considered:** Storing lat/lng as floats and computing Haversine distance per request — rejected; not indexable, doesn't survive catalog growth.
- **Tradeoff accepted:** Geography columns are strict about SRID handling. A seed-data bug surfaced exactly here — a `GENERATED ALWAYS` geography column rejected inserts from the ORM's default path; fixed with a raw SQL insert using `ST_SetSRID(ST_MakePoint(...))` against the direct (unpooled) connection.

### ADR-05 — Order → SubOrder decomposition over a flat order with seller-tagged line items
- **Context:** A single cart can span multiple sellers, each with independent pickup timing, fulfillment status, and settlement.
- **Decision:** An `Order` represents the buyer's checkout transaction; each seller's portion becomes a `SubOrder` with its own state machine.
- **Alternatives considered:** One flat order with seller-tagged line items — rejected; "ready for pickup" and "cancelled" are seller-scoped states, and flattening them produces an order that's simultaneously correct and incorrect depending on which seller you ask about.
- **Tradeoff accepted:** Every payment and refund calculation now reconciles at both the Order and SubOrder level — more bookkeeping, but it matches the actual business semantics instead of hiding the complexity.

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

## Backend patterns implemented

| Failure mode | Mechanism that handles it |
|---|---|
| Duplicate webhook delivery (Razorpay retries on timeout) | Unique constraint on `WebhookLog` event ID — second delivery is a no-op |
| Concurrent stock decrement on the same SKU | Row-level lock (`SELECT FOR UPDATE`) inside the order transaction |
| Stolen / replayed refresh token | Reuse of a rotated token invalidates its entire token family |
| Redis unavailable | Rate limiter fails **closed**, not open (see Performance Validation — this was not the original behavior) |
| Partial multi-table write | Entire write wrapped in a single DB transaction; no intermediate state is observable |

---

## Documentation Index

| Topic | Location |
|---|---|
| Architecture, system invariants, ADRs | `DESIGN.md` |
| API reference (61 endpoints) | `API.md` |
| Engineering narrative & background | `CASE_STUDY.md` |

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

## System Invariants

(full set of 19 documented in `DESIGN.md`):

1. Stock quantity for a SKU can never go negative — enforced at the row-lock decrement, not by application-level checks alone.
2. A SubOrder cannot reach `fulfilled` before its payment capture is confirmed by webhook — a client-side success callback is never sufficient.
3. A given webhook event ID is processed at most once, regardless of delivery retries.
4. An access token cannot authenticate once its parent refresh-token family has been marked compromised.
5. An Order's total must equal the sum of its SubOrder totals at every state transition.
6. Rate-limit state failing to load fails closed, never open.

---

## Built By

Abhishek Kumar.