# ARCHITECTURE.md — Kridha

This document explains *why* Kridha is built the way it is. It is not implementation documentation — for that, read [DESIGN.md](./DESIGN.md). It is not a decision log — for full ADRs with rejected alternatives, read [DECISIONS.md](./DECISIONS.md). This document sits between those two: the reasoning that connects principle to decision.

**Audience:** CTO, Principal Engineer, Staff Engineer, Backend Architect.

---

## Table of Contents

1. [Engineering Principles](#1-engineering-principles)
2. [Full System Architecture](#2-full-system-architecture)
3. [Deployment Architecture](#3-deployment-architecture)
4. [Request Lifecycle](#4-request-lifecycle)
5. [Layer Responsibilities](#5-layer-responsibilities)
6. [Why a Monolith](#6-why-a-monolith)
7. [Authentication Architecture](#7-authentication-architecture)
8. [Payment Architecture](#8-payment-architecture)
9. [Order Architecture](#9-order-architecture)
10. [Inventory Reservation](#10-inventory-reservation)
11. [Webhook Architecture](#11-webhook-architecture)
12. [Database Architecture](#12-database-architecture)
13. [Caching Architecture](#13-caching-architecture)
14. [Rate Limiting Architecture](#14-rate-limiting-architecture)
15. [Observability Architecture](#15-observability-architecture)
16. [Security Architecture](#16-security-architecture)
17. [Failure Modes](#17-failure-modes)
18. [Scaling Constraints](#18-scaling-constraints)
19. [Known Constraints & Accepted Tradeoffs](#19-known-constraints--accepted-tradeoffs)
20. [Architecture Decision Summary](#20-architecture-decision-summary)
21. [Future Evolution](#21-future-evolution)

---

## 1. Engineering Principles

Four principles recur throughout this document. Every section is an application of one or more of these, not an isolated choice.

**Correctness enforced at the database layer, not just the application layer.**
Stock locking, webhook idempotency, and financial calculations all have their hard guarantee at the Postgres level — constraints, row locks — rather than relying solely on application code to behave correctly under concurrency. Application code is the first line of defence; the database is the last.

**Fail open on availability, fail closed on money.**
Rate limiting and caching degrade gracefully when Redis disappears — legitimate users are never blocked by infrastructure failure. Payment and refund calculations never trust client input and never degrade silently. A cache miss is acceptable; a double-charge is not.

**Constraints drive design, not defaults.**
Every non-obvious decision — lazy expiry, the Order/SubOrder split, two-phase payment, cookie-only auth — traces back to a real, named constraint (Vercel's cron limits, multi-seller fulfillment semantics, shared-device UX, unfamiliar-counterparty trust), not a tutorial pattern applied by default.

**A monolith is a decision, not a limitation.**
Kridha runs as a single deployment deliberately. Section 6 explains why. Section 21 explains exactly what trigger would change it.

---

## 2. Full System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│   Browser (Next.js PWA) · Mobile browser · Admin dashboard          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS (TLS 1.3)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     VERCEL EDGE / CDN                                │
│   Static assets · Image optimization · Edge caching                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              NEXT.JS APP ROUTER (Vercel Serverless)                  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  MIDDLEWARE (proxy.ts)  — runs before every handler            │  │
│  │  Rate limiting (3 layers) → CSRF → JWT → Role check            │  │
│  └───────────────────────────────┬────────────────────────────────┘  │
│                                   │                                   │
│  ┌────────────────────────────────▼────────────────────────────────┐  │
│  │  ROUTE HANDLERS  (thin — parse, delegate, respond)              │  │
│  │  /api/products · /api/cart · /api/orders · /api/auth            │  │
│  │  /api/seller/* · /api/admin/* · /api/notifications              │  │
│  └───────────────────────────────┬────────────────────────────────┘  │
│                                   │                                   │
│  ┌────────────────────────────────▼────────────────────────────────┐  │
│  │  SERVICE LAYER  (business rules, orchestration, validation)      │  │
│  │  orderService · cartService · authService · paymentService       │  │
│  │  productService · notificationService · sellerService            │  │
│  └───────┬───────────────────────────────────────┬─────────────────┘  │
│          │ Repository calls                       │ External API calls │
│  ┌───────▼────────────────────────┐   ┌──────────▼──────────────────┐  │
│  │  REPOSITORY LAYER               │   │  EXTERNAL APIS               │  │
│  │  auth.repo · product.repo       │   │  Razorpay (payments)         │  │
│  │  order.repo · seller.repo       │   │  Cloudinary (images)         │  │
│  │  user.repo · admin.repo         │   │  GlitchTip (errors)          │  │
│  └───────┬────────────────────────┘   └─────────────────────────────┘  │
│          │                                                               │
│  ┌───────▼─────────────────────────────────────────────┐               │
│  │  INFRASTRUCTURE LAYER                                │               │
│  │  Prisma ORM · withRetry · withCache · logger         │               │
│  └───────┬────────────────────────┬────────────────────┘               │
│          │                        │                                     │
└──────────┼────────────────────────┼─────────────────────────────────────┘
           │                        │
           ▼                        ▼
┌──────────────────┐    ┌───────────────────────┐
│  Supabase Postgres│    │  Upstash Redis (HTTP)  │
│  PostgreSQL 17    │    │  Cache + Rate limiting │
│  PostGIS spatial  │    └───────────────────────┘
│  pgBouncer pool   │
└──────────────────┘

                         SEPARATE ENTRY POINT
┌─────────────────────────────────────────────────────────────────────┐
│              RAZORPAY WEBHOOK PATH                                   │
│                                                                       │
│  Razorpay servers                                                    │
│      │                                                                │
│      ▼ POST /api/webhooks/razorpay                                   │
│  HMAC-SHA256 verify (timingSafeEqual, not middleware JWT)            │
│      │                                                                │
│      ▼                                                                │
│  Idempotency check (WebhookLog @unique constraint)                   │
│      │                                                                │
│      ▼                                                                │
│  prisma.$transaction [WebhookLog + SubOrder + StatusHistory]         │
│      │                                                                │
│      ▼                                                                │
│  Always return 200                                                   │
└─────────────────────────────────────────────────────────────────────┘

                         CRON PATHS (Vercel Hobby — 1/day)
┌─────────────────────────────────────────────────────────────────────┐
│  /api/cron/expire-orders   → release expired PENDING stock           │
│  /api/cron/expire-deals    → mark expired deals INACTIVE             │
│  /api/cron/transfer-payouts → initiate seller payouts                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Deployment Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    PRODUCTION TOPOLOGY                    │
│                                                           │
│  DNS (codewithabhishek.in / kridha.in)                   │
│       │                                                   │
│       ▼                                                   │
│  Vercel CDN Edge (static, immutable assets)               │
│       │                                                   │
│       ▼                                                   │
│  Vercel Serverless Functions (Next.js App Router)         │
│  Region: Mumbai (ap-south-1) — closest to UP users       │
│       │                                          │        │
│       ▼                                          ▼        │
│  Supabase Postgres (Mumbai)             Upstash Redis    │
│  DATABASE_URL: port 6543 (pgBouncer)    (HTTP-based,     │
│  DIRECT_URL:   port 5432 (direct)       serverless-safe) │
│                                                           │
│  Cloudinary (global CDN, Cloudinary Mumbai POP)          │
│  GlitchTip (EU, error tracking)                          │
│  Upptime (GitHub Actions, uptime monitoring)             │
└──────────────────────────────────────────────────────────┘
```

### Why Vercel

The entire backend runs in Vercel Serverless Functions. No separate API server. No persistent process to manage. The tradeoffs are real and accepted:
- **10-second function timeout** — constrains any single operation to under 10s; seed/migrations use `DIRECT_URL` to bypass this
- **Cold starts** — first request after inactivity may add 200–800ms; `withRetry` handles Supabase's cold-start equivalent
- **No persistent connections** — Upstash Redis is HTTP-based specifically because a persistent TCP Redis connection cannot be maintained across serverless invocations; pgBouncer handles Postgres connection multiplexing

At current traffic, none of these constraints are binding. The migration trigger is documented in Section 21.

### Why Supabase

Supabase provides PostgreSQL 17 + PostGIS + pgBouncer in one managed service. The alternative — self-managed Postgres on a VPS — would require operating a database, managing backups, and configuring pgBouncer manually. At current scale this is an operational cost with no technical benefit.

`DATABASE_URL` (port 6543, pgBouncer, transaction mode) is used by the application at request time. `DIRECT_URL` (port 5432, direct) is used by Prisma CLI for migrations and by the seed script for large batched inserts — pgBouncer in transaction mode does not support multi-statement sessions.

### Why Upstash Redis

Standard Redis requires a persistent TCP connection. Serverless functions cannot maintain persistent connections. Upstash's HTTP-based client (`@upstash/redis`) issues one HTTPS request per operation — compatible with Vercel's ephemeral execution model. The operational tradeoff is slightly higher per-operation latency (~20–50ms) versus a persistent connection (~1ms). Acceptable for rate limiting and cache use cases; not acceptable for anything on the critical-latency path.

### Environment Variables

```
DATABASE_URL         — Supabase pgBouncer (port 6543) — application reads
DIRECT_URL           — Supabase direct (port 5432)   — migrations + seed
JWT_SECRET           — ≥32 chars, user token signing
ADMIN_JWT_SECRET     — separate secret, admin token signing (isolated blast radius)
ENCRYPTION_KEY       — 64-char hex, AES-256-GCM for bank details at rest
RAZORPAY_KEY_ID / KEY_SECRET / WEBHOOK_SECRET
CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET
UPSTASH_REDIS_REST_URL / REST_TOKEN
GLITCHTIP_DSN        — error tracking endpoint
CRON_SECRET          — bearer token for cron endpoint authentication
```

No secret is logged. The 14-field Pino redaction list covers all credential-adjacent fields before serialization.

---

## 4. Request Lifecycle

```
Browser
  │
  │  HTTPS POST /api/cart  { productId, quantity, ... }
  ▼
Vercel Function starts (cold start if first request)
  │
  ▼
proxy.ts — Middleware
  │
  ├── 1. Layer 1 rate limit: per-IP sliding window
  │          Redis ZADD / ZRANGEBYSCORE / ZCARD
  │          fail: 429 immediately
  │
  ├── 2. Layer 2 rate limit: per-account (phone suffix)
  │          defeats IP rotation
  │          fail: 429 immediately
  │
  ├── 3. Layer 3 rate limit: global platform ceiling
  │          fail: 429 immediately
  │
  ├── 4. CSRF double-submit check (mutation routes)
  │          X-CSRF-Token header === kridha_csrf cookie
  │          fail: 403 immediately
  │
  ├── 5. JWT extraction from kridha_access HttpOnly cookie
  │          missing: 401 immediately
  │
  ├── 6. JWT verification: HS256 algorithm whitelist
  │          invalid / expired: 401 immediately
  │
  └── 7. Role check: BUYER / SELLER / ADMIN route boundary
             wrong role: 403 immediately
  │
  ▼
Route Handler: POST /api/cart
  │
  ├── Zod schema validation (request body, query params)
  │          fail: 400 { code: "VALIDATION_ERROR", errors: [...] }
  │
  ├── getUser(req) — userId from verified JWT
  │
  └── cartService.addItem(userId, input)
  │
  ▼
Service Layer: cartService.addItem
  │
  ├── productRepo.findById(productId)
  │     → withRetry → Prisma → Supabase Postgres
  │
  ├── Advisory stock check (not a lock, performance filter only)
  │          fail: throw ERR.INSUFFICIENT_STOCK()
  │
  ├── releaseExpiredHoldsForProduct(productId)  ← lazy expiry
  │
  └── cartRepo.upsertItem(userId, productId, quantity, ...)
  │
  ▼
Repository Layer: cartRepo.upsertItem
  │
  └── prisma.cartItem.upsert({ ... })
  │
  ▼
Supabase Postgres
  │
  ▼
Prisma returns CartItem
  │
  ▼
Service returns CartItem
  │
  ▼
Route Handler: return jsonResponse({ success: true, data: cartItem }, 201)
  │
  ▼
withLogger records: requestId, action, method, path, status, ms
  │
  ▼
Browser receives { success: true, data: { ... } }
```

Every exit point from this flow returns the same JSON envelope: `{ success: true, data }` or `{ success: false, code, message, meta }`. The client checks `success` first, then `code`. Status codes are semantically correct but `code` is the machine-readable discriminant.

---

## 5. Layer Responsibilities

### Middleware (`proxy.ts`)
**Responsibility:** security boundary. All cross-cutting concerns execute here before any handler runs.
- Rate limiting (three layers, Redis-backed)
- CSRF token validation
- JWT extraction, verification, algorithm enforcement
- Role enforcement
- Request ID injection

Nothing in this layer makes business decisions. It admits or rejects. A route handler cannot accidentally skip a security check — the check runs unconditionally before the handler is invoked.

### Route Handlers
**Responsibility:** HTTP boundary. Parse, delegate, respond.
- Parse path parameters, query strings, request body
- Validate input shape via Zod (types only — business rules belong in services)
- Extract user identity from verified JWT headers injected by middleware
- Call one service function
- Return JSON response

A route handler that contains business logic is a handler that duplicates logic when a second caller (cron, webhook, another endpoint) needs the same behavior.

### Service Layer
**Responsibility:** business rules, orchestration, transactions.
- Enforce domain invariants (`minOrderValue`, state machine transitions, stock availability)
- Orchestrate multi-repository operations inside a single Postgres transaction
- Resolve pricing (`calcUnitPrice`, `calcAdvance`, `calcRefundAmount`)
- Handle external API calls (Razorpay, Cloudinary)
- Execute compensating transactions on partial failure

Services do not know about HTTP. They receive typed inputs and return typed results or throw typed `AppError` instances.

### Repository Layer
**Responsibility:** data access. One file per domain. The only layer that touches Prisma.
- Single domain per file (no cross-domain queries)
- Accept an optional `tx` parameter for transactional callers
- Wrap calls in `withRetry` for transient Supabase pooler errors
- Expose typed query functions — no raw SQL except for PostGIS predicates

A repository function answers one data question. Query composition (joining multiple domains) is done via Prisma's `include` in the repository function for the primary entity.

### Infrastructure Layer
- `withRetry` — transient Supabase connection error handling
- `withCache` — Redis cache-aside with fail-open
- `logger` — Pino with request correlation and field redaction
- `handleError` — converts `AppError`, `ZodError`, and unknown errors to response envelopes

### External APIs
- **Razorpay** — called by `paymentService`; webhooks enter through a separate route, not middleware
- **Cloudinary** — called by `productService` for signed upload URLs; images are stored there, referenced by URL in Postgres
- **GlitchTip** — receives error events via `@sentry/nextjs` SDK; exceptions and security events at `fatal`/`error` severity

---

## 6. Why a Monolith

### The Problem This Solves

A solo engineer with a 45-day build window, zero dedicated ops, and a correctness-critical financial system has a specific set of tradeoffs to optimize for:
- Deployment confidence (one thing to deploy, one thing to roll back)
- Zero cross-service network failure surface (every call is in-process)
- One log stream, one stack trace, one debug context
- Cross-domain transactions (stock decrement + order creation + payment initiation in one Postgres transaction)

Microservices make cross-service transactions nearly impossible without sagas or two-phase commit — both of which introduce complexity that is an order of magnitude greater than the problem they solve at current scale.

### Why Not Express on a Separate Server

Next.js App Router provides API routes with zero additional infrastructure. A separate Express server would require a second deployment, CORS configuration, DNS, reverse proxy setup, and separate environment management. The capability gain is negligible at current scale; the operational cost is real.

### Why Not a Modular Monolith (With Enforced Boundaries)

Kridha has the folder structure of a modular monolith — domains in separate directories, services not importing other services' repositories. But boundary enforcement (lint rules, import restrictions) is not yet applied mechanically.

This is a deliberate deferral, not an oversight. The trigger for enforcing boundaries is a second engineer joining the codebase, at which point accidental coupling begins to accumulate. Before that point, the enforcement mechanism costs more than the problem it solves.

### Why Not Microservices

Microservices are justified when:
1. Multiple teams need to deploy independently
2. A specific service has a scaling profile radically different from the rest of the system
3. A compliance or isolation requirement demands a hard service boundary

None of these conditions apply at current scale. The extraction roadmap in Section 21 identifies exactly which services would be extracted and on which measurable triggers.

### Scaling Boundary

The monolith starts creating real problems when:
- A second engineer's PRs regularly conflict with the first (team size trigger)
- The Postgres write path for one domain is starving another (performance trigger — not present)
- A compliance requirement demands payment isolation (regulatory trigger)

None of these have been hit. The architecture will change in response to evidence, not in anticipation of scale that may not materialize.

---

## 7. Authentication Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 TRUST BOUNDARIES                         │
│                                                          │
│  PUBLIC            AUTHENTICATED         ADMIN           │
│  (no cookie)       (kridha_access)       (kridha_admin)  │
│                                                          │
│  GET /products     POST /cart            GET /api/admin  │
│  GET /reviews      POST /orders          POST /admin/*   │
│  POST /auth/login  GET /orders           (ADMIN_JWT)     │
│                    GET /notifications                    │
│                                                          │
│  No JWT check      JWT_SECRET            ADMIN_JWT_SECRET│
│  required          HS256 verify          type:"admin"    │
└─────────────────────────────────────────────────────────┘
```

### Cookie Architecture

```
Cookie              HttpOnly  Path          MaxAge  Purpose
──────────────────  ────────  ────────────  ──────  ──────────────────────────
kridha_access       YES       /             15 min  JWT access token
kridha_refresh      YES       /api/auth     7 days  Rotation chain; hash in DB
kridha_lang         NO        /             1 year  Language preference (hi/en)
kridha_access_exp   NO        /             15 min  Unix expiry for client-side
                                                    proactive refresh scheduling
kridha_csrf         NO        /             session CSRF double-submit value
kridha_admin        YES       /api/admin    4 hours Admin JWT (separate surface)
```

`kridha_refresh` is path-scoped to `/api/auth`. The browser never sends it to `/api/products` or `/api/orders`. A vulnerability in the product search path cannot expose the refresh token.

`kridha_admin` is path-scoped to `/api/admin`. A user-level JWT cannot be replayed against admin routes even if the routing were misconfigured.

### Token Family Rotation

```
Login
  │
  ▼
Issue: AccessToken + RefreshToken
Create: UserSession { familyId: uuid, tokenHash: sha256(refreshToken) }
  │
  ▼
Client uses AccessToken (15 min)
  │ expires
  ▼
Silent refresh: POST /api/auth/refresh
  │
  ├── Find UserSession WHERE tokenHash = sha256(incomingToken)
  │
  ├── ✅ Found (legitimate use):
  │     Issue new pair
  │     Update: tokenHash = sha256(newToken), parentHash = sha256(oldToken)
  │     Return 200
  │
  └── ❌ Not found:
        Check: any session WHERE parentHash = sha256(incomingToken)
        │
        ├── Found → TOKEN REUSE DETECTED
        │     Revoke ALL sessions WHERE familyId = session.familyId
        │     logger.fatal("TOKEN_THEFT_DETECTED")
        │     Return 401
        │
        └── Not found → unknown/expired token → 401
```

**Why family rotation over simple rotation:** Simple rotation rejects the reused token but doesn't detect theft. If an attacker steals a refresh token and uses it before the legitimate user, the legitimate user gets a 401 and assumes session expiry — the attacker's session continues. Family rotation ensures: once the legitimate user next attempts a refresh, the theft is detected and the attacker is logged out simultaneously.

### Admin Authentication

Admin tokens are signed with `ADMIN_JWT_SECRET`, a completely separate key from `JWT_SECRET`. The admin middleware verifies `payload.type === "admin"` — a user-issued JWT cannot satisfy this claim even if the signing key were accidentally exposed. Admin audit actions are logged to `AdminAuditLog` with full context.

---

## 8. Payment Architecture

```
CHECKOUT FLOW
─────────────

Buyer → POST /api/cart/checkout
  │
  ▼
Service: validate cart, calc advance, enforce minOrderValue
  │
  ▼
prisma.$transaction [
  SELECT FOR UPDATE (lock stock rows)
  decrement available
  create Order + SubOrders + OrderItems + StatusHistory
]
  │
  ▼ (transaction committed)
Razorpay: rz.orders.create({ amount: advanceAmount })
  │
  ├── ✅ Success:
  │     return { razorpayOrderId, advanceAmount }
  │     Client renders Razorpay checkout UI
  │
  └── ❌ Failure (network error, rate limit, timeout):
        COMPENSATING TRANSACTION:
        SubOrder.status = CANCELLED
        Product.available += quantity (restore stock)
        OrderStatusHistory entry
        │
        └── If compensation also fails:
              logger.fatal("COMPENSATION_FAILED", { subOrderId, items })
              Manual intervention required

PAYMENT CAPTURE (webhook)
──────────────────────────

Razorpay → POST /api/webhooks/razorpay { event: "payment.captured" }
  │
  ▼
HMAC verify (timingSafeEqual)
  │
  ▼
prisma.$transaction [
  WebhookLog.create (razorpayPaymentId @unique — idempotency guard)
  SubOrder.status → CONFIRMED
  Payment.create (type: ADVANCE, status: PAID)
  OrderStatusHistory.create
  Notification.create (buyer: order confirmed)
]
  │
  ▼
Always return 200

PICKUP PAYMENT FLOW
────────────────────

Seller → POST /api/seller/suborders/:id/payment-link
  │
  ▼
Razorpay: rz.paymentLink.create({ amount: remainingAmount })
  │
  ▼
Store paymentLinkId + paymentLinkUrl on SubOrder
Share link with buyer (in-app or direct)

Buyer pays via link → Razorpay fires payment_link.paid webhook
  │
  ▼
SubOrder.status → READY_FOR_OTP_VERIFICATION
Buyer presents OTP → Seller verifies → COMPLETED
Payment.create (type: REMAINING, status: PAID)
Payout queued (next cron run)
```

### Two-Phase Rationale

Buyers are purchasing from suppliers they've often never dealt with. Full upfront payment removes buyer leverage if goods don't match the listing. The advance (₹100–500, server-calculated, never client-supplied) creates commitment — a buyer who has paid ₹120 shows up; a buyer with a zero-cost confirmation often doesn't.

### Advance Calculation

`MIN(₹500, MAX(₹100, 5% × orderTotal))` computed in `src/lib/pricing.ts`. The client never sends an advance amount. If the client could, a buyer could set it to ₹1 and satisfy the "advance paid" guard with negligible commitment.

### Orphaned Razorpay Order Edge Case

If a Razorpay order is created but the success response is lost in transit, the compensating transaction runs while Razorpay's order still exists. A buyer paying the orphaned order would produce a webhook for a CANCELLED SubOrder — the handler logs a warning and returns 200 without processing. Manual reconciliation is required. This is rare, documented, and accepted at current volume.

---

## 9. Order Architecture

A multi-seller checkout needs two conflicting things: **one atomic payment** (buyer pays once) and **independent per-seller fulfillment** (Seller A cancelling must not affect Seller B).

```
Order (financial unit)
  id
  buyerId
  totalAmount
  advanceAmount
  razorpayOrderId       ← one Razorpay payment intent
  cartSessionId
  (no status — derived from SubOrders)
      │
      ├── SubOrder (per-seller contract)
      │     id, orderId, sellerId
      │     status (own state machine)
      │     pickupWindowId, pickupDate, pickupDeadline (stored, not computed)
      │     deliveryOtp, paymentLinkUrl
      │     ├── OrderItems
      │     ├── OrderStatusHistory
      │     ├── Payment (ADVANCE + REMAINING)
      │     ├── Refund
      │     └── Payout
      │
      └── SubOrder (second seller, fully independent)
            id, orderId, sellerId
            status (independent state machine)
            ...
```

`Order` has no `status` column — its state is derived from its SubOrders. `SubOrder` is the per-seller contract with its own state machine, pickup logistics, OTP, payment link, and payout record.

### State Machine

```
PENDING ──────────────────────────────────────────► CANCELLED
  │                                                      ▲
  │ payment.captured webhook                             │
  ▼                                                      │
CONFIRMED ────────────────────────────────────────► CANCELLED
  │                                                      ▲
  │ seller generates payment link                        │
  ▼                                                      │
AWAITING_PAYMENT                                         │
  │                                                      │
  │ payment_link.paid webhook                            │
  ▼                                                      │
READY_FOR_OTP_VERIFICATION                               │
  │                    │                                 │
  │ OTP verified       │ dispute raised                  │
  ▼                    ▼                                 │
COMPLETED          DISPUTED ◄───── (terminal)            │
(terminal)                                               │
```

Terminal states have empty edge arrays in the TRANSITIONS object. `validateTransition` throws before any DB write — the state machine is the single choke-point for all status changes regardless of which caller (webhook, route handler, cron) invokes it.

---

## 10. Inventory Reservation

```
CONCURRENT CHECKOUT — PESSIMISTIC LOCKING
──────────────────────────────────────────

Buyer A checkout                    Buyer B checkout
      │                                   │
      ▼                                   ▼
BEGIN TRANSACTION               BEGIN TRANSACTION
SELECT available                SELECT available
FROM Product                    FROM Product
WHERE id = $id                  WHERE id = $id
FOR UPDATE  ◄────────── BLOCKS ──────────────────────┐
      │                                               │
      │  (Buyer B waits here while A holds the lock) │
      ▼                                               │
available = 1 ≥ 1 ✅                                  │
UPDATE available -= 1                                 │
CREATE Order/SubOrder/Items                           │
COMMIT ──────────────────────── RELEASES LOCK ────────┘
                                         │
                                         ▼
                              SELECT available
                              FOR UPDATE
                                         │
                              available = 0 < 1 ❌
                              THROW ERR.INSUFFICIENT_STOCK
                              ROLLBACK
                                         │
                                         ▼
                              409 INSUFFICIENT_STOCK
```

The `CHECK (available >= 0)` constraint is a secondary safety net. It catches any bug that bypasses the application-level lock. It is not the primary guarantee.

---

## 11. Webhook Architecture

```
IDEMPOTENCY UNDER CONCURRENT DELIVERY
──────────────────────────────────────

Razorpay delivery 1                 Razorpay delivery 2
      │                                   │
      ▼                                   ▼
POST /api/webhooks/razorpay         POST /api/webhooks/razorpay
HMAC verify ✅                      HMAC verify ✅
      │                                   │
      ▼                                   ▼
BEGIN $transaction              BEGIN $transaction
INSERT WebhookLog               INSERT WebhookLog
  razorpayPaymentId ◄── @unique constraint ──► razorpayPaymentId
      │                                   │
      │  (one succeeds)        (other fails P2002 unique violation)
      ▼                                   │
UPDATE SubOrder                     ROLLBACK
  status → CONFIRMED                      │
CREATE Payment                      catch P2002
CREATE StatusHistory                → return 200 silently
COMMIT
      │
      ▼
return 200
```

The handler always returns 200 even on HMAC failure or duplicate detection. Razorpay retries on any non-200 — returning 4xx/5xx triggers exponential backoff retries that flood logs and can exhaust webhook quota.

---

## 12. Database Architecture

### Source of Truth

Postgres is the authoritative source for all business data. Redis holds derived state (cache, counters) that can be regenerated from Postgres. If Redis is lost entirely, the system degrades in performance but not in correctness.

### Connection Architecture

```
Vercel Function
    │
    ├── DATABASE_URL → pgBouncer (port 6543, transaction mode)
    │   Used by: all application requests
    │   Max backend connections: 60 (Supabase free tier)
    │   Prisma pool: max=15 (leaves headroom)
    │
    └── DIRECT_URL → Postgres direct (port 5432)
        Used by: prisma migrate, prisma db seed
        pgBouncer transaction mode doesn't support multi-statement sessions
```

### Schema Design Principles

**Stored over computed:** `SubOrder.pickupDeadline` is stored at order creation. The expiry cron queries `WHERE pickupDeadline < NOW()` — indexable, O(log n). A computed expression (`pickupDate + windowEndTime`) cannot be indexed.

**Append-only audit trail:** `OrderStatusHistory` is never updated or deleted. Every status transition creates a new row. Financial decisions trace to immutable history.

**DB constraints as the last line of defence:**
```sql
CHECK (available >= 0)                          -- inventory floor
UNIQUE (razorpayPaymentId) on WebhookLog        -- idempotency
UNIQUE (subOrderId, productId) on Review        -- one review per purchase
UNIQUE (storeName, street) on SellerProfile     -- store identity
```

### Spatial Data

```sql
-- Generated column: populated automatically from latitude/longitude
location geography(Point, 4326) GENERATED ALWAYS AS (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
) STORED

-- GIST index: enables O(log n) radius queries
CREATE INDEX Product_location_gist ON Product USING GIST (location)

-- GIN index: trigram text search without separate search service
CREATE INDEX Product_nameEn_gin ON Product USING GIN (nameEn gin_trgm_ops)
```

---

## 13. Caching Architecture

```
PRODUCT FEED — CACHE-ASIDE READ PATH
──────────────────────────────────────

GET /api/products?lat=26.713&lng=83.330&radius=10
  │
  ▼
Round lat/lng to 3dp (111m precision)
Build cache key: products:26.713:83.330:10:...:{page}
  │
  ▼
Redis GET(key)
  │
  ├── HIT → return JSON (5–20ms, Upstash HTTP)
  │
  └── MISS → PostGIS $queryRaw (40–200ms, Supabase)
                │
                ▼
              Redis SET(key, result, EX 60)  ← fire-and-forget
                │
                ▼
              return result

CACHE INVALIDATION
──────────────────
Product create / PATCH / DELETE
  │
  ▼
cacheDelete("product:{id}")
cacheDeletePattern("products:*")    ← O(n) SCAN + DEL, see Known Constraints
```

### Failure Modes

| Redis state | Cache behavior | Rate limit behavior |
|---|---|---|
| Healthy | Cache-aside works normally | Sliding window enforced |
| Slow | Higher latency, eventual hit | Increased response time |
| Down | **Fail open** — fall through to Postgres | **Fail closed** — block requests |
| Partially degraded | Some keys unreachable, partial bypass | Treated as Redis down |

Cache and rate limiting share the same Redis instance but have opposite failure semantics. This is the most important architectural distinction between the two Redis use cases.

---

## 14. Rate Limiting Architecture

```
LAYER ARCHITECTURE
──────────────────

Incoming auth request
  │
  ▼
Layer 1: per-IP
  key: ratelimit:ip:{sha256(ip)}
  window: 1 min, limit: 5
  defeats: single-source brute force
  bypass vector: IP rotation → Layer 2 catches this
  │
  ▼
Layer 2: per-account
  key: ratelimit:account:{last6digits(phone)}
  window: 15 min, limit: 10
  defeats: IP rotation — botnet with 1000 IPs still
           hits per-account ceiling
  requires: knowing the phone number to construct key
  │
  ▼
Layer 3: global platform ceiling
  key: ratelimit:global:auth
  window: 1 min, limit: 500
  defeats: DDoS against auth endpoints specifically
  │
  ▼
Proceed to JWT verification
```

Layer 2 uses last 6 digits of phone as the key — not the full phone number (which isn't available before authentication) and not the user ID (which requires a DB lookup). The last 6 digits are sufficient for per-account rate limiting while being available on any login attempt without a prior DB read.

---

## 15. Observability Architecture

```
REQUEST PATH OBSERVABILITY
──────────────────────────

Request arrives
  │
  ▼
withLogger wrapper generates requestId (UUID v4)
  │
  ▼
All log lines within the request carry requestId
  │
  ├── Normal completion:
  │   Pino INFO: { requestId, action, method, path, status, ms, userId }
  │
  └── Error:
      Pino ERROR: { requestId, err, ms }
      GlitchTip (via Sentry SDK): exception + request context
```

### Pino vs GlitchTip

```
Pino (structured JSON logs)
  Purpose: complete operational record
  Every request gets a log line
  Queryable by requestId, userId, action, status, ms
  14 fields redacted before serialization

GlitchTip (error tracking)
  Purpose: alerting and exception aggregation
  Captures: unhandled exceptions (5xx)
  Security events:
    - TOKEN_THEFT_DETECTED (fatal)
    - CREDENTIAL_STUFFING_SUSPECTED (warn)
    - IP_CHANGE_ON_REFRESH (info)
    - RATE_LIMITED_ACCOUNT (warn)
  Email alert on new error type
```

### Uptime Monitoring

`GET /api/health` → `{ status: "ok" }` — no database query. Upptime (GitHub Actions) checks every 5 minutes. A functional endpoint like `/api/products` would consume a Postgres connection for uptime monitoring, competing with real user traffic for the free-tier connection pool. The shallow endpoint avoids this.

### Tracing Readiness

No distributed tracing is currently implemented. `requestId` correlation across Pino log lines provides linear trace reconstruction for a monolith. The migration path to OpenTelemetry is: instrument `withLogger` to emit spans; add an OTLP exporter. No architectural change is required — the correlation ID infrastructure is already in place.

---

## 16. Security Architecture

```
TRUST BOUNDARY DIAGRAM
──────────────────────

INTERNET (untrusted)
  │
  ▼
Vercel Edge (TLS termination)
  │
  ▼
proxy.ts ── ALL requests pass through ──► rate limit, CSRF, JWT, role
  │
  ├── Public routes (no JWT required):
  │   GET /api/products, GET /api/reviews, POST /api/auth/*
  │   THREAT: enumeration → silent signup mitigates
  │
  ├── Authenticated routes (JWT required):
  │   All buyer and seller routes
  │   THREAT: XSS token theft → HttpOnly cookies mitigate
  │   THREAT: CSRF → double-submit token mitigates
  │   THREAT: token replay → family rotation revocation mitigates
  │
  ├── Admin routes (ADMIN_JWT required):
  │   /api/admin/* — separate signing key, separate cookie path
  │   THREAT: user token replay → type:"admin" claim mitigates
  │
  └── Webhook route (HMAC required):
      POST /api/webhooks/razorpay
      THREAT: spoofed webhook → HMAC-SHA256 + timingSafeEqual mitigates
      THREAT: replay → WebhookLog @unique constraint mitigates
```

### Threat Model Summary

| Threat | Mitigation | Layer |
|---|---|---|
| XSS token theft | HttpOnly cookies | Browser/cookie |
| CSRF | Double-submit token | Middleware |
| Token replay (stolen refresh) | Token family rotation + revocation | Application |
| JWT algorithm confusion (none attack) | `algorithms: ["HS256"]` whitelist | Application |
| Timing attack on HMAC | `crypto.timingSafeEqual` | Application |
| Timing attack on PIN | Argon2 DUMMY_HASH (always hash even if user not found) | Application |
| Credential stuffing | Per-account rate limiting (Layer 2) | Middleware |
| Webhook spoofing | HMAC-SHA256 signature verification | Route handler |
| Webhook replay / duplicate | `WebhookLog @unique` constraint + transaction | Database |
| User enumeration | Silent signup (identical 201 on duplicate phone) | Application |
| Stored XSS | `safeString` Zod transform on all user string inputs | Validation |
| Bank detail exposure | AES-256-GCM encryption at rest, last-4-digits masking on read | Application |
| Clickjacking | `frame-ancestors 'none'` CSP header | HTTP headers |
| PIN brute force | Progressive lockout (5→10min, 10→1h, 20→24h) | Application |
| Seller seeing own products | `excludeSellerId` clause in PostGIS query | Application |

---

## 17. Failure Modes

### Redis Unavailable

```
Rate limiting:  FAIL CLOSED — requests blocked (auth/write endpoints)
Caching:        FAIL OPEN  — fall through to Postgres (read endpoints)
Lazy expiry:    FAIL OPEN  — expiry sweep skipped, stock temporarily locked
Session lookup: N/A        — sessions are in Postgres, not Redis
```

Redis going down simultaneously removes rate limiting for auth endpoints (dangerous) and removes caching for reads (degraded, not broken). The rate-limiting failure mode was corrected from fail-open to fail-closed after load testing revealed the original behavior.

### Supabase Postgres Unavailable

All requests fail. No fallback — Postgres is the source of truth for everything. `withRetry` handles transient pooler errors (4 retries, 1.5s linear backoff) but cannot handle a sustained outage. Supabase's managed service SLA and automated failover are the operational mitigations.

### Razorpay Order Creation Failure (Post-Commit)

The compensating transaction runs: SubOrder → CANCELLED, stock restored. If the compensating transaction fails, `logger.fatal("COMPENSATION_FAILED")` fires with full context for manual intervention.

### Webhook Delivery Timeout

Razorpay retries. The `@unique` constraint on `WebhookLog.razorpayPaymentId` ensures exactly-once processing regardless of how many retries arrive. All retries return 200.

### Cloudinary Unavailable

Product image uploads fail. Existing product images (stored as Cloudinary CDN URLs in Postgres) continue to load — images are served by Cloudinary CDN, not by Kridha's servers. Seller product listings with images are unaffected; new image uploads are blocked until Cloudinary recovers.

### Connection Pool Exhausted

Requests queue waiting for a Postgres connection. `connectionTimeoutMillis: 5000` in the pgBouncer config means requests wait up to 5 seconds before failing with `P2024 Timed out fetching a new connection`. This surfaces as 500s under extreme concurrent load. Mitigation: Supabase Pro tier (higher connection limits), PgBouncer session-mode pooling.

### Rate Limiter Redis Key Corruption

A malformed sorted set key (data corruption, version mismatch) would cause `ZADD`/`ZRANGEBYSCORE` to return an error. The fail-closed behavior treats this as Redis unavailable — requests are blocked. Malformed keys self-expire (TTL is set on every key write).

### Cron Job Missing (Vercel Hobby — 1/day)

Kridha does not rely on cron correctness for inventory accuracy. Lazy expiry (triggered on every product feed request) releases expired PENDING orders independently of the cron. The cron at 2 AM is a sweep that catches anything lazy expiry missed. Maximum stock lock duration without the cron: until the next product feed request for any product in that seller's catalog.

---

## 18. Scaling Constraints

| Bottleneck | Current state | Trigger to act | Mitigation |
|---|---|---|---|
| Postgres connection pool | max=15, Supabase free 60 | Sustained `P2024` errors in logs | Supabase Pro, PgBouncer session mode |
| Vercel cold starts | 200–800ms first request | P99 latency spikes on burst traffic | Vercel Pro (reduced cold starts), persistent server |
| Lazy expiry concurrent sweeps | N sweeps per N product requests | Expiry sweep dominates slow-query log | Redis distributed lock `SET NX EX 30` |
| Synchronous notifications/payouts | Inside request handlers | Checkout P99 latency climbing | BullMQ workers on Railway |
| Cache stampede | No current protection | High cache miss rate on popular listings | `SET NX` lock before DB fetch |
| Single-region deployment | Mumbai only | Latency complaints outside Maharashtra/UP | Vercel multi-region routing |

**What does not bottleneck at current scale:**
- State machine: pure in-memory, no DB dependency
- JWT verification: stateless HMAC, no DB or Redis dependency
- Webhook idempotency: enforced at Postgres index level, not application concurrency
- PostGIS radius search: GIST index scales to millions of products without architectural change

---

## 19. Known Constraints & Accepted Tradeoffs

**Vercel 10-second function timeout.**
Accepted. No single operation in the normal path approaches this limit. Seed and migrations use `DIRECT_URL` and run outside the function environment.

**One cron execution per day (Vercel Hobby).**
Accepted. Lazy expiry makes correctness independent of the cron. The cron is a sweep, not a guarantee.

**Cache pattern-delete is O(n).**
Accepted. `SCAN + DEL products:*` scans all matching keys on product write. At current product catalog size, this is fast. At 100,000+ cached keys, this needs tag-based invalidation.

**No distributed tracing.**
Accepted. `requestId` in every Pino log line enables manual trace reconstruction in a monolith. The investment in OpenTelemetry is deferred until the system is multi-service.

**Shared Redis instance for cache and rate limiting.**
Accepted, with documented failure semantics difference. A dedicated Redis for rate limiting would eliminate the risk of a cache stampede affecting rate limit counter accuracy, but adds operational complexity for marginal benefit at current scale.

**Refresh token table grows without bound.**
Accepted. Expired and revoked sessions are rejected at point-of-use but not deleted. A weekly retention sweep is planned but not yet implemented. Not a correctness issue; an operational hygiene issue.

**Race condition test has a design flaw.**
The k6 test 03 used a single JWT for all VUs, testing cart-layer concurrency rather than the stock-layer `SELECT FOR UPDATE` path. The test is being corrected (see `tests/scripts/setup-race-test.ts`). The lock itself is correct; the test is not yet proving what it claims to prove.

---

## 20. Architecture Decision Summary

| Decision | Problem solved | Alternative rejected | Reconsideration trigger |
|---|---|---|---|
| HttpOnly cookies | XSS token theft on shared devices | localStorage + Authorization header | Native mobile client requirement |
| Token family rotation | Stolen token undetected until expiry | Simple rotation | — (no trigger — this is strictly better) |
| PIN over OTP | SMS unreliable on UP Tier-2 feature phones | SMS OTP | SMS infrastructure investment |
| Pessimistic locking | Retry storm on hot SKU under high concurrency | Optimistic locking (version counter) | Read-heavy workload with minimal write contention |
| Order/SubOrder decomposition | Multi-seller independent fulfillment | Flat order with seller-tagged items | — (domain requirement is permanent) |
| Lazy expiry over cron | Vercel Hobby 1-cron/day limitation | Frequent cron sweep | Move to persistent server with BullMQ |
| `@unique` webhook idempotency | TOCTOU race between check and insert | Application-level duplicate check | — (DB constraint is strictly better) |
| PostGIS geography + GIST | O(n) table scan for radius queries | Haversine in application code | Dedicated search service at product catalog scale |
| Redis fail-closed for rate limiting | Fail-open allows unbounded auth traffic during Redis outage | Fail-open (original behavior) | — (fail-closed is correct; no trigger to revert) |
| Monolith | No team, no scale trigger, cross-domain transactions required | Express + separate API server; microservices | Second engineer joining; service-specific scale pressure |
| Supabase over self-managed Postgres | Managed PostGIS, pgBouncer, backups, without ops burden | VPS + self-managed Postgres | Scale requiring custom Postgres configuration |
| Upstash Redis over persistent Redis | Vercel serverless cannot maintain persistent TCP connections | ElastiCache / persistent Redis | Move to persistent server infrastructure |

---

## 21. Future Evolution

Each step is gated by a specific, measurable trigger. Nothing here is planned on a timeline.

```
CURRENT
  │  Single Next.js deployment
  │  Single Postgres instance
  │  One Redis (cache + rate limit)
  │
  ▼ TRIGGER: second engineer joins
Enforce modular boundaries (lint rules)
  Import restrictions between domain modules
  CODEOWNERS per domain directory
  │
  ▼ TRIGGER: sync notification/payout measurably affecting checkout P99
Extract BullMQ workers (Railway persistent process)
  Notifications become async jobs
  Payout cron moves to worker
  Lazy expiry moves to scheduled job (Vercel 1/day freed)
  │
  ▼ TRIGGER: product read load measurably contending with write latency
Add Postgres read replica
  productRepo.findNearby → replica
  orderRepo reads → replica
  All writes → primary
  │
  ▼ TRIGGER: payment volume ≥5,000 events/day or compliance isolation required
Extract Payments Service
  Separate deployment, separate Postgres schema
  Cross-service communication via webhook events (not direct calls)
  Introduces: network failures, retry contracts, distributed tracing requirement
  │
  ▼ TRIGGER: OpenSearch adopted for product search (text relevance requirements)
Extract Search Service
  Independent indexing pipeline
  PostGIS query moves inside Search Service
  Product writes publish events; Search Service subscribes
  │
  ▼ TRIGGER: 15+ engineers, many independently-shipping teams
Platform Engineering layer
  Kubernetes (EKS) if service count justifies orchestration overhead
  Service mesh for observability
  Internal developer platform
```

The progression is evidence-driven. Each step introduces real distributed-systems complexity that is unjustified without the triggering condition. Extracting Notifications before checkout P99 degrades is paying microservice tax for no benefit.

---

*For implementation detail, read the code directly — `src/services/order.service.ts`, `src/lib/state-machine.ts`, `src/app/api/webhooks/razorpay/route.ts`.*
*For the full decision log, see [DECISIONS.md](./DECISIONS.md).*
*For the product narrative, see [CASE_STUDY.md](./CASE_STUDY.md).*
