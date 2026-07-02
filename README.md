# Kridha

<p align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![PostGIS](https://img.shields.io/badge/PostGIS-Spatial_DB-4169E1)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)
![Razorpay](https://img.shields.io/badge/Razorpay-Payments-0C2451)
![CI](https://github.com/DevWithAbhishek/kridha/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/github/license/DevWithAbhishek/kridha)
![Status](https://img.shields.io/badge/Status-Active-success)

</p>

A hyperlocal B2B + B2C self-pickup marketplace — multi-vendor checkout, geospatial seller discovery, and payment reconciliation.

**[Live Demo](https://youtu.be/RqErC6yHFok) · [Architecture](./docs/DESIGN.md) · [API Reference](./docs/API.md)**

Available for backend & full-stack engineering roles.

---

## Executive Summary

Self-pickup commerce breaks the assumptions most e-commerce backends are built on: a single cart can span multiple independent sellers, each with their own pickup point, fulfillment timeline, and settlement, and "nearby" has to mean a real geographic radius query, not a city-level filter. Built and run by one engineer with no dedicated ops team and no margin for silent data corruption — inventory races or payment/state mismatches aren't tolerable bugs to discover later, they're the thing the architecture has to rule out by construction. The result is a Next.js + PostgreSQL/PostGIS + Redis + Razorpay system where multi-vendor orders are decomposed into independently-tracked sub-orders, inventory writes are serialized at the database layer, and payment state is only ever trusted from a verified webhook — never from a client callback.

---

## Hard Problems Solved

| Problem | Solution |
|---|---|
| Refresh token replay attacks | Token family rotation with theft detection |
| Duplicate Razorpay webhook deliveries | Idempotent webhook processing using unique event IDs |
| Concurrent inventory overselling | `SELECT FOR UPDATE` row locking |
| Multi-vendor order state complexity | Order → SubOrder decomposition |
| Slow proximity-based seller discovery | PostGIS geography + GiST indexes |
| Rate limiter behavior on Redis failure | Fails closed, not open — corrected after load testing exposed the original fail-open default |

---

## Architecture
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

Authenticated requests flow from the Next.js App Router through the service layer before reaching PostgreSQL, with Redis accelerating cacheable reads and rate-limiting state. Payment processing is intentionally isolated from the request path: Razorpay webhooks are verified, deduplicated, and become the only authority allowed to transition payment state.

---

## Key Engineering Decisions

### ADR-01 — Pessimistic locking over optimistic concurrency for inventory
**Context:** Hot SKUs face concurrent decrement attempts at checkout; overselling is a direct financial and trust cost in a multi-vendor marketplace. **Decision:** `SELECT FOR UPDATE` row-locks the stock row inside the same transaction as the decrement. **Rejected alternative:** Optimistic locking via a version column — under real contention it produces client-facing retries at exactly the moment (checkout) where a retry is least acceptable.

### ADR-02 — HttpOnly cookie auth with token-family rotation over localStorage bearer tokens
**Context:** A client-rendered Next.js app has real XSS exposure; a token readable by JavaScript is a token stealable by JavaScript. **Decision:** Short-lived access tokens in `HttpOnly`, `Secure` cookies; refresh tokens grouped into rotating families. **Rejected alternative:** localStorage bearer tokens — directly exfiltratable via XSS. Refresh rotation without family tracking — doesn't detect reuse of an already-rotated, stolen token.

### ADR-03 — Lazy expiry over scheduled token sweeps
**Context:** A cron-based sweep to expire stale refresh tokens is an extra operational job with its own failure mode — a missed run silently extends how long a stale token stays valid. **Decision:** Expired or already-rotated tokens are rejected at the point of use; no background cleanup job exists. **Rejected alternative:** Scheduled cleanup job — deferred, since the security property ("an expired token never authenticates") holds without it.

### ADR-04 — Geography column + GIST index over application-level distance math
**Context:** The core discovery query is "sellers within radius R of this buyer" — the kind of query that becomes a full table scan if distance is computed in application code. **Decision:** PostGIS `geography` columns (not `geometry`, so distances are correct on the Earth's curved surface) indexed with GIST. **Rejected alternative:** Storing lat/lng as floats and computing Haversine distance per request — not indexable, doesn't survive catalog growth.

### ADR-05 — Order → SubOrder decomposition over a flat order with seller-tagged line items
**Context:** A single cart can span multiple sellers, each with independent pickup timing, fulfillment status, and settlement. **Decision:** An `Order` represents the buyer's checkout transaction; each seller's portion becomes a `SubOrder` with its own state machine. **Rejected alternative:** One flat order with seller-tagged line items — "ready for pickup" and "cancelled" are seller-scoped states, and flattening them produces an order that's simultaneously correct and incorrect depending on which seller you ask about.

→ Full ADRs with consequences and tradeoffs accepted: [DESIGN.md](./docs/DESIGN.md)

---

## Performance Validation

Load testing with k6 against checkout and catalog read paths, run against a production build (not the Next.js dev server). Four distinct issues surfaced, not zero:

1. **Dev-server connection collapse** — early runs against `next dev` collapsed under concurrency; not a production bug, a testing-methodology lesson. Testing was redirected to a production build.
2. **Cart-clearing gap under stock-drain** — a scenario where stock hit zero mid-checkout exposed a gap in cart-clearing logic. Identified and corrected.
3. **Rate limiter failing open** — stopping Redis mid-test caused the rate limiter to fail open instead of blocking traffic. Fixed to fail closed.
4. **A false positive, caught correctly** — a quantity-5 line item test looked like an anomaly until traced to the platform's own ₹1000 minimum order value. Distinguishing this from an actual defect was itself part of the validation.

**Known limitations:** no chaos/multi-AZ failover testing yet; no automated load-test regression suite wired into CI.

---

## Backend Patterns Implemented

- **Idempotent webhook processing** — unique constraint on `WebhookLog` event ID; a duplicate Razorpay delivery (retried on timeout) is a no-op, not a double-write.
- **Row-level pessimistic locking** — `SELECT FOR UPDATE` inside the order transaction serializes concurrent stock decrements on the same SKU.
- **Token family rotation** — reuse of an already-rotated refresh token invalidates its entire token family, detecting theft rather than just expiring sessions.
- **Fail-closed rate limiting** — if Redis is unavailable, requests are blocked, not waved through; this was load-tested and corrected from an original fail-open default.
- **Single-transaction multi-table writes** — partial write states are never observable; an order and its sub-orders commit together or not at all.
- **Geography-indexed proximity search** — PostGIS `geography` columns with GIST indexing for radius queries that scale with catalog growth.
- **Order → SubOrder decomposition** — seller-scoped state machines (`fulfilled`, `cancelled`) instead of one flattened order status across multiple sellers.
- **Webhook-only payment state authority** — client-side success callbacks are never trusted to transition payment or order state.

---

## Engineering Documentation

| Document | Audience | Contents |
|---|---|---|
| [DESIGN.md](./docs/DESIGN.md) | CTO, Senior Engineer | Architecture, system invariants, full ADRs |
| [API.md](./docs/API.md) | Engineers | API reference — 61 endpoints |
| [CASE_STUDY.md](./docs/CASE_STUDY.md) | Founder, EM | Engineering narrative & background |

---

## Local Setup

PostgreSQL and Redis run via Docker Compose; the Next.js application itself runs directly on the host, not in a container. This split is deliberate — it gives Fast Refresh, faster TypeScript recompilation, and easier debugging than containerizing the app would, while still keeping infrastructure dependencies one command away. This mirrors a common startup development workflow: containerized infra, native app process.

**Prerequisites:** Docker Desktop, Node.js, npm.

```bash
git clone https://github.com/DevWithAbhishek/kridha
cd kridha
cp .env.example .env          # copy environment template
docker compose up -d          # start PostgreSQL + Redis
npm install                   # install dependencies
npx prisma migrate dev        # apply schema, generate client
npm run seed                  # seed local data
npm run dev                   # start the app on the host
```

### Daily Development

```bash
# Start infrastructure
docker compose up -d

# Run app
npm run dev

# Stop infrastructure
docker compose down

# Reset local database
docker compose down -v
docker compose up -d
npx prisma migrate reset
```

### Docker Services

| Service | Purpose | Port |
|---|---|---|
| PostgreSQL | Primary database | 5432 |
| Redis | Cache + Rate Limiter | 6379 |

`DATABASE_URL`, `DIRECT_URL`, and `REDIS_URL` should point to these Docker services as defined in `docker-compose.yml`. See `.env.example` for the complete variable list.

### Troubleshooting

- Docker Desktop not running — start it before `docker compose up -d`
- Check container status: `docker compose ps`
- Prisma cannot connect — confirm `DATABASE_URL` matches the Compose service
- Redis unavailable — confirm `REDIS_URL` and that the container is healthy
- Restart containers: `docker compose down && docker compose up -d`
- Port conflict on 5432/6379 — stop any local Postgres/Redis instance first

---

## System Invariants

Full set of 19 documented in [DESIGN.md](./docs/DESIGN.md):

| # | Invariant |
|---|---|
| 1 | Stock quantity for a SKU can never go negative — enforced at the row-lock decrement, not by application-level checks alone |
| 2 | A SubOrder cannot reach `fulfilled` before its payment capture is confirmed by webhook — a client-side success callback is never sufficient |
| 3 | A given webhook event ID is processed at most once, regardless of delivery retries |
| 4 | An access token cannot authenticate once its parent refresh-token family has been marked compromised |
| 5 | An Order's total must equal the sum of its SubOrder totals at every state transition |
| 6 | Rate-limit state failing to load fails closed, never open |

---

## API Surface

61 REST endpoints across Authentication, Products, Cart, Orders, Payments, Admin and Health. Full request/response contract in [API.md](./docs/API.md).

---

## Database Schema

22 Prisma models. Full schema in [DESIGN.md](./docs/DESIGN.md).

---

## Stack

| Technology | Reason chosen | Tradeoff accepted |
|---|---|---|
| Next.js (App Router) | Unified frontend + API surface; fewer moving parts for a single-engineer build | Frontend and API scale together, not independently |
| PostgreSQL + PostGIS (Supabase) | ACID transactions and native geospatial indexing in one engine | Serverless cold starts require explicit handling |
| Redis | Sub-millisecond cache + shared rate-limit state | A second stateful dependency the app must degrade around |
| Prisma | Type-safe queries, fast schema iteration | Occasionally needs a raw-SQL escape hatch (e.g. geography inserts) |
| Razorpay | Mature webhook ecosystem for India-first payments | At-least-once webhook delivery requires explicit idempotency handling |
| Pino | Low-overhead structured JSON logging | No built-in tracing — pairs with, doesn't replace, a future APM |

---

## Project Status

**Complete:** 61 REST endpoints · 22 Prisma models · 39 typed error codes · 19 documented system invariants · multi-vendor checkout · geospatial seller discovery · k6-validated checkout and catalog paths.

**Planned:** chaos/multi-AZ failover testing · automated load-test regression suite in CI.

---

## Built By

**Abhishek Kumar** · NIT Allahabad '24 · Backend Engineer

Open to Backend Engineer and Backend-heavy Full Stack Engineer opportunities.

[LinkedIn](https://www.linkedin.com/in/abhishekkumar878/) · [Portfolio](https://www.codewithabhishek.in/) · [GitHub](https://github.com/DevWithAbhishek) · [abhishek@codewithabhishek.in](mailto:abhishek@codewithabhishek.in)