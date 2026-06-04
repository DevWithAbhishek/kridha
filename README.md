# Kridha

B2B self-pickup marketplace for Tier-2 India — kirana owners order from local suppliers within 10 km, no delivery required.

**[Live](https://kridha-marketplace.vercel.app) · [Demo Video](#) · [Case Study](./CASE_STUDY.md) · [Architecture](./ARCHITECTURE.md)**

> Available for backend engineering roles — [LinkedIn](https://www.linkedin.com/in/abhishekkumar878/) · [GitHub](https://github.com/DevWithAbhishek)

---

## Executive Summary

Udaan requires 50 kg+ minimum orders because delivery economics demand it. A kirana owner needing 8 kg of mustard oil from a mill 3 km away has no platform — he calls, negotiates, and pays cash on pickup with zero protection.

Kridha removes the minimum order constraint by removing delivery entirely. Buyers self-pickup. The backend handles discovery via PostGIS radius search, two-phase Razorpay payments (advance at booking + remaining at pickup), atomic stock locking under concurrent checkout, and idempotent webhook processing — verified under 100 concurrent requests.

Built in 45 days, solo. Live on Vercel. ₹0/month infrastructure.

---

## Hard Problems Solved

| Problem                                                            | Solution                                                                                                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two buyers race for the last unit simultaneously                   | `SELECT FOR UPDATE` inside `prisma.$transaction()` — exactly one `201`, one `409`. DB row-level lock, no application retry.                          |
| Same Razorpay webhook delivered 100 times concurrently             | `WebhookLog.razorpayPaymentId @unique` + handler inside `$transaction` — exactly one DB write regardless of concurrent delivery count. k6 verified.  |
| Razorpay order creation fails after Postgres transaction commits   | Compensating transaction immediately restores stock and marks SubOrder `CANCELLED`. No orphaned stock locks.                                         |
| Stock stays locked if buyer never pays (Vercel Hobby = 1 cron/day) | Lazy expiry: `releaseAllExpiredPendingOrders()` called fire-and-forget on next product request. Stock released within seconds, not 24 hours.         |
| Stolen refresh token used after legitimate rotation                | Token family tracking. Reuse of a rotated token immediately revokes all sessions for that user and fires a GlitchTip fatal alert.                    |
| Radius search on 500+ products without spatial index               | Raw `$queryRaw` with `ST_DWithin` + GIST index on `geography(Point, 4326)`. O(log n) vs table scan. ~55ms avg vs ~180ms avg pre-index.               |
| Deal price removed between cart add and checkout                   | `CartItem.unitPrice` locked at add-time. Order creation uses `ci.unitPrice`, not recalculated current price. Buyer protected from deal removal.      |
| Multi-seller checkout — one seller's failure affects others        | `Order` = one atomic Razorpay advance. `SubOrder` = independent per-seller contract. Seller A cancelling does not affect Seller B's state or payout. |

---

## Architecture

```
Browser / Mobile PWA
        │
        ▼
┌─────────────────────────────────┐
│         proxy.ts (Next.js)      │
│  Rate limiting (3 layers)       │
│  CSRF validation                │
│  JWT auth (HttpOnly cookie)     │
│  Role enforcement               │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│       Route Handlers            │
│  /api/products  /api/cart       │
│  /api/orders    /api/auth       │
│  /api/webhooks  /api/admin      │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│       Service Layer             │
│  orderService  cartService      │
│  authService   paymentService   │
│  notificationService            │
└──────┬──────────────┬───────────┘
       │              │
       ▼              ▼
┌────────────┐  ┌─────────────────┐
│ Repository │  │   External APIs  │
│   Layer    │  │                  │
│ productRepo│  │ Razorpay         │
│ orderRepo  │  │ Cloudinary       │
│ sellerRepo │  │ GlitchTip        │
└─────┬──────┘  └─────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│   PostgreSQL 16 + PostGIS       │  ← GIST index, pg_trgm GIN
│   Upstash Redis                 │  ← Cache-aside, rate limiting
└─────────────────────────────────┘
```

**Webhook flow (separate entry point):**

```
Razorpay → POST /api/webhooks/razorpay
         → HMAC-SHA256 verify (timingSafeEqual)
         → idempotency check (WebhookLog @unique)
         → $transaction: WebhookLog insert + Payment update + SubOrder transition
         → always returns 200 (prevents retry storm on non-2xx)
```

→ [Full architecture with scaling constraints](./ARCHITECTURE.md)

---

## Key Engineering Decisions

### 1. Pessimistic over optimistic locking for stock

Hot SKUs in a small-town marketplace are highly contested — a mill selling 50 kg of Mustard Oil may have 15 kirana owners checking the same listing simultaneously. Optimistic locking produces a retry storm: 14 of 15 transactions fail their version check, retry, fail again, tail latency explodes. Pessimistic locking (`SELECT FOR UPDATE`) serializes all 15 at the DB layer. The first N (where N ≤ available) succeed deterministically. The rest receive `409 INSUFFICIENT_STOCK` immediately. First come, first served — no ambiguity, no retries, no partial failures.

### 2. Order → SubOrder decomposition

A buyer ordering from three sellers in one checkout needs one atomic Razorpay advance (one payment, one receipt) but three independent operational tracks (independent pickup windows, OTPs, payment links, payout records, status histories). Collapsing to a single `Order` table would mean Seller A cancelling affects Seller B's payout calculation — structurally wrong. `Order` is the financial unit. `SubOrder` is the per-seller contract. Stock decrement is per-seller group inside the transaction — Seller A's `SELECT FOR UPDATE` does not block Seller B's concurrent checkout on different rows.

### 3. HttpOnly cookies over localStorage

UP Tier-2 users access Kridha on shared Android devices. `localStorage` is readable by any JavaScript on the page — one XSS vulnerability in any dependency exposes the token. HttpOnly cookies are inaccessible to JavaScript by definition. `kridha_refresh` is scoped to `path=/api/auth` — the browser never sends it to product or order endpoints, limiting blast radius if a token is intercepted. The trade-off (CSRF risk) is mitigated by double-submit CSRF tokens on all mutation endpoints.

### 4. Lazy expiry over cron for stock release

Vercel Hobby allows one cron execution per day. A 15-minute payment window cannot be enforced by a daily cron — worst case, stock is locked for 24 hours. Lazy expiry: `releaseAllExpiredPendingOrders()` is called fire-and-forget at the top of `productRepo.findNearby` on every product feed request. Stock releases the moment the next buyer browses — correct behavior without cron dependency. The daily cron at 2 AM sweeps anything the lazy release missed.

### 5. PostGIS raw query over Prisma ORM

Prisma cannot construct `ST_DWithin` predicates on `geography(Point, 4326)` columns — it treats them as `Unsupported`. The GIST index on `Product.location` makes radius queries O(log n); a Prisma `findMany` with lat/lng arithmetic would table-scan every product on every request. `buildWhereClause()` and `buildOrderClause()` in `src/lib/postgis.ts` compose `Prisma.sql` tagged templates with parameterized inputs. All user inputs are parameterized — no string interpolation.

### 6. Hindi-first i18n at creation time

Notification strings are resolved at creation using `user.preferredLang` from DB, not at render time. If the user changes `preferredLang` after the order is placed, the historical notification correctly reflects the language at the time of the event. A Hindi notification for a Hindi-preferring user at order time remains Hindi even if the user later switches to English. Resolution at creation eliminates a template system, a runtime translation service, and translation cache invalidation.

<details>
<summary>What I'd do differently</summary>

- **Race condition test design**: The initial k6 test used a single JWT for all 50 VUs, creating cart-layer concurrency rather than stock-layer concurrency. The correct test calls `POST /api/orders` directly with isolated buyer accounts — bypassing the cart to test `SELECT FOR UPDATE` cleanly.
- **Unit tests on service layer**: The k6 suite validates integration behavior but `orderService.create` has zero unit tests. The compensating transaction path (Razorpay failure after commit) has never been triggered in a controlled test environment.
- **PrismaPg pool configuration**: The default `pg.Pool` max=10 causes connection queuing under concurrent load. Should have been explicitly configured at max=15 (prod) / max=50 (dev) from day one. Discovered only when load tests showed 2000ms+ latency before diagnosis.
- **`console.log(input)` in cart.service.ts**: A debug log left in production code. Should have been caught before the repository was made public.
- **Outbox pattern for Razorpay**: The current compensating transaction approach is correct but brittle. The right solution is an outbox table written inside the Postgres transaction, processed asynchronously — eliminates the distributed transaction problem entirely.

</details>

---

## Performance Validation

All tests run against local Docker (PostgreSQL + Redis) with explicit pg.Pool config. No Supabase cold starts. No Vercel function overhead.

| Test                   | Tool                 | VUs | Result                                                       |
| ---------------------- | -------------------- | --- | ------------------------------------------------------------ |
| Webhook idempotency    | k6 shared-iterations | 100 | ✅ 100 × 200 OK · `WebhookLog COUNT = 1` (DB verified)       |
| Product feed reads     | k6 constant-vus      | 200 | ✅ 0 HTTP errors across 4,353 requests                       |
| Response time baseline | k6 ramping-vus       | 100 | ✅ 9,702 requests · 0 HTTP 5xx · 32 req/s                    |
| Auth rate limiter      | k6 shared-iterations | 20  | ✅ Layer 2 (per-account) confirmed firing on concurrent auth |
| Race condition (stock) | k6 shared-iterations | 50  | ⚠ Test design flaw documented — see below                    |

**Race condition test note:** The initial test used a single JWT for all 50 VUs, producing cart-session chaos rather than stock-layer contention. `SELECT FOR UPDATE` is in place and correct — the verification test using 50 isolated buyer accounts is the next item on the testing backlog. See [TESTING.md](./TESTING.md) for methodology and known gaps.

**Latency (Docker + Redis cache active):**

| Endpoint                                  | P50   | P95    | P99    |
| ----------------------------------------- | ----- | ------ | ------ |
| `GET /api/health`                         | ~8ms  | ~42ms  | ~78ms  |
| `GET /api/products` (cache hit)           | ~14ms | ~80ms  | ~180ms |
| `GET /api/products` (cache miss, PostGIS) | ~52ms | ~200ms | ~390ms |
| `POST /api/cart/checkout`                 | ~95ms | ~280ms | ~490ms |
| `POST /api/webhooks/razorpay`             | ~18ms | ~65ms  | ~120ms |

_Supabase cold-start numbers (pre-pool-fix) were 2000ms+ P95 — caused by pg.Pool default max=10 queuing under load. Fixed by passing explicit `pg.Pool` instance to `PrismaPg` adapter._

→ [Full load test methodology and results](./LOAD_TESTING.md)

---

## Backend Patterns Implemented

- **`SELECT FOR UPDATE` pessimistic locking** — stock decrement inside `prisma.$transaction()`. Concurrent checkout serialized at Postgres row level, not application level.
- **Idempotent webhook handler** — `WebhookLog.razorpayPaymentId @unique` + `$transaction`. Exactly-once processing regardless of concurrent duplicate delivery count.
- **Token family rotation** — refresh token reuse triggers immediate full session revocation + GlitchTip fatal alert. Detects token theft without user action.
- **Compensating transaction** — Razorpay init failure after DB commit triggers stock restoration in a second transaction. No orphaned locks on external API failure.
- **State machine with terminal states** — `validateTransition(from, to)` throws before any DB write. `COMPLETED` and `CANCELLED` have empty edge arrays — no if-chains, no invalid state possible.
- **Cache-aside with fail-open** — product feed cached in Redis. Cache error = cache miss = DB query. Redis is never source of truth. Invalidated on every write.
- **Three-layer rate limiting** — per-IP (5/min) → per-account phone suffix (10/15 min, defeats IP rotation) → global platform ceiling (500/min). All layers fail-open on Redis error.
- **Lazy stock expiry** — expired PENDING orders released on next product request. No cron dependency for correctness.
- **Structured logging with redaction** — Pino JSON with `requestId` correlation. 14 sensitive fields (`pin`, `otp`, `accountNumber`, etc.) redacted before write. Never in log storage.
- **Repository pattern** — all Prisma access isolated per domain. Services import repos, never `prisma` directly.
- **Silent signup** — duplicate phone returns identical `201`. No enumeration of registered users.
- **Server-side price enforcement** — no endpoint accepts `unitPrice` from client. Locked at cart-add time, carried to order creation.

---

## Documentation Index

| Document                             | Audience                      | Contents                                                                              |
| ------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | CTO, Senior Engineer          | Layer decisions, connection pool config, scaling constraints, 1000-user failure modes |
| [DECISIONS.md](./DECISIONS.md)       | CTO, Hiring Manager           | 8 ADRs with context, decision, alternatives considered, consequences                  |
| [CASE_STUDY.md](./CASE_STUDY.md)     | Founder, EM, Recruiter        | Vedanta → Kridha engineering narrative, domain constraints, FixMitraa preview         |
| [SECURITY.md](./SECURITY.md)         | CTO, Security-conscious teams | Full auth architecture, OWASP controls, threat model per control                      |
| [TESTING.md](./TESTING.md)           | EM, Senior Engineer           | Coverage map, k6 methodology, known gaps, what would be tested next                   |
| [LOAD_TESTING.md](./LOAD_TESTING.md) | CTO, Performance engineers    | Full k6 results, infrastructure conditions, interpretation                            |
| [API.md](./API.md)                   | Engineers                     | 61 endpoints, full request/response contract, error codes                             |

---

## Local Setup

**Prerequisites:** Docker Desktop · Node.js 20+

```bash
git clone https://github.com/DevWithAbhishek/kridha.git && cd kridha
npm install
cp .env.example .env.local          # fill required variables (see below)
docker-compose up -d                 # PostgreSQL + PostGIS on :5432, Redis on :6379
npx prisma migrate deploy            # enables PostGIS, pg_trgm, GIST + GIN indexes
npx prisma db seed                   # 10 verified sellers, 540 products, 108 deals, 1 buyer
npm run dev
```

Seed credentials: all accounts use PIN `1234`. Seller phones and test buyer phone printed to console after seed completes.

**Required environment variables:**

```
DATABASE_URL                          # Supabase pooled (prod) / Docker (dev)
DIRECT_URL                            # Supabase direct (prod) / Docker (dev)
JWT_SECRET                            # ≥32 char random string
ADMIN_JWT_SECRET                      # separate secret — admin surface
ENCRYPTION_KEY                        # 64-char hex — AES-256-GCM for bank details
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
NEXT_PUBLIC_RAZORPAY_KEY_ID
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
UPSTASH_REDIS_REST_URL                # production only
UPSTASH_REDIS_REST_TOKEN              # production only
REDIS_URL                             # development only (redis://localhost:6379)
GLITCHTIP_DSN
CRON_SECRET
```

Redis auto-detects environment: Upstash when `UPSTASH_REDIS_REST_URL` is set, local Docker Redis when `REDIS_URL` is set, cache silently disabled when neither is set.

---

## System Invariants

19 correctness guarantees enforced at DB and application layer. Violating any is a bug, not a missing feature.

| #      | Invariant                                          | Enforcement                                                                                              |
| ------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| INV-01 | `product.available` never goes negative            | DB `CHECK (available >= 0)` + `SELECT FOR UPDATE` inside `prisma.$transaction()`                         |
| INV-02 | `COMPLETED` or `CANCELLED` status cannot change    | State machine — terminal states have empty edge sets. `validateTransition()` throws before any DB write. |
| INV-03 | Payment webhook processed exactly once             | `WebhookLog.razorpayPaymentId @unique` + idempotency check before processing                             |
| INV-04 | BUYER cannot access seller-only routes             | `requireRole(req, Role.SELLER)` reads JWT from HttpOnly cookie                                           |
| INV-05 | User sees only their own orders                    | `userId` from cookie; all order queries filter by `buyerId` or `sellerId`                                |
| INV-06 | Delivery OTP cleared after verification            | `deliveryOtp` set to `null` on `COMPLETED` in same transaction as status update                          |
| INV-07 | Phone is the unique user identifier                | `phone @unique` at DB level; silent signup prevents enumeration                                          |
| INV-08 | Seller store name + address must be unique         | `@@unique([storeName, street])` at DB level                                                              |
| INV-09 | Deal price reverts after expiry                    | Query JOINs only `status = ACTIVE AND expiresAt > NOW()`                                                 |
| INV-10 | Order total must meet minimum                      | `sellerTotal >= PlatformConfig.minOrderAmountPerSeller` before Razorpay creation                         |
| INV-11 | Order cannot confirm without captured advance      | Only `payment.captured` webhook triggers `PENDING → CONFIRMED`                                           |
| INV-12 | Order cannot complete without full payment AND OTP | State machine requires `READY_FOR_OTP_VERIFICATION` before `verifyOtp()`                                 |
| INV-13 | Refund calculated server-side only                 | `calcRefundAmount(advance, pickupDeadline, cancelledBy)` — client never sends refund amount              |
| INV-14 | Seller cannot see own products in buyer feed       | `AND p."sellerId" != $userId` in PostGIS raw query when `userId` present                                 |
| INV-15 | Review only allowed after COMPLETED SubOrder       | `reviewService` verifies `subOrder.status === COMPLETED` and buyer ownership                             |
| INV-16 | One review per order per product                   | `Review.@@unique([subOrderId, productId])` at DB level                                                   |
| INV-17 | Bank details masked in non-admin responses         | `accountNumber` truncated to last 4 digits in all non-admin handlers                                     |
| INV-18 | Client never sends status transitions or prices    | Zod schemas omit `status` and `unitPrice` from all request bodies                                        |
| INV-19 | Cart checkout reads from server state only         | `POST /api/cart/checkout` takes no body — server reads `CartSession` from DB                             |

---

## API Surface

61 endpoints across 14 resource groups. Full contract in [API.md](./API.md).

| Group             | Endpoints | Auth                      |
| ----------------- | --------- | ------------------------- |
| Auth              | 8         | Public + Cookie           |
| Users             | 5         | Cookie (BUYER/SELLER)     |
| Sellers           | 6         | Cookie (SELLER)           |
| Pickup Windows    | 4         | Cookie (SELLER)           |
| Products — Buyer  | 3         | Public (optional auth)    |
| Products — Seller | 7         | Cookie (SELLER)           |
| Cart              | 6         | Cookie (BUYER)            |
| Orders            | 7         | Cookie (BUYER/SELLER)     |
| Reviews           | 4         | Public GET / Cookie write |
| Saved Products    | 3         | Cookie (BUYER)            |
| Notifications     | 6         | Cookie (BUYER/SELLER)     |
| Webhooks          | 1         | HMAC (Razorpay)           |
| Admin             | 8         | Cookie (ADMIN JWT)        |
| Cron              | 3         | Bearer `CRON_SECRET`      |

Response envelope — every endpoint, success or error:

```json
{ "success": true,  "data": { } }
{ "success": false, "code": "MACHINE_READABLE", "message": "Human readable.", "meta": { } }
```

---

## Database Schema

22 Prisma models. Key relationships:

```
User ──< userSession (token family rotation, IP tracking)
     ──< SellerProfile ──< Product ──< PriceTier
                                   ──< Deal
                      ──< PickupWindow
                      ──< SubOrder (as seller)
                      ──< Payout
     ──< Order ──< SubOrder ──< OrderItem
                           ──< OrderStatusHistory
                           ──< Payment
                           ──< Refund
                           ──< Review
     ──< CartSession ──< CartItem
     ──< SavedProduct
     ──< Notification
AdminUser ──< AdminAuditLog
PlatformConfig (singleton: id = "singleton")
WebhookLog
```

---

## Stack

| Layer      | Technology                                | Why                                                                                                            |
| ---------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router)                   | Single deployment: frontend + API routes + cron                                                                |
| Language   | TypeScript strict                         | Schema/type mismatches caught at compile time                                                                  |
| Database   | PostgreSQL 16 + PostGIS via Supabase      | GIST index on `geography` column for O(log n) radius search; `pg_trgm` GIN for product search                  |
| ORM        | Prisma 7 + `@prisma/adapter-pg`           | Type-safe queries; `$transaction()` for atomic stock decrement; configured `pg.Pool` for connection management |
| Cache      | Upstash Redis (prod) / Docker Redis (dev) | HTTP-based serverless-compatible; sliding window rate limiting + product feed TTL                              |
| Auth       | Phone + PIN · Argon2 · HttpOnly Cookies   | XSS-proof; no localStorage; token family theft detection; userSession IP tracking                              |
| Payments   | Razorpay                                  | Two-phase: advance (booking confirmation) + payment link (remaining at pickup)                                 |
| Images     | Cloudinary                                | Signed direct uploads; `f_auto/q_auto/w_1200`; blurHash placeholders                                           |
| i18n       | next-intl + `i18n-strings.ts`             | Hindi-first; notifications resolved at creation time, not at render                                            |
| Validation | Zod v4                                    | Schema-first; `safeString` transform strips HTML from all user string inputs                                   |
| Logging    | Pino + GlitchTip + Upptime                | Structured JSON with `requestId` correlation; 14 fields redacted; error tracking; uptime monitoring            |
| Deploy     | Vercel (Hobby) + Supabase                 | ₹0/month                                                                                                       |

---

## Order Lifecycle

```
PENDING → CONFIRMED → AWAITING_PAYMENT → READY_FOR_OTP_VERIFICATION → COMPLETED
        ↘ CANCELLED                                                   ↘ DISPUTED
```

Every transition recorded in `OrderStatusHistory` with timestamp. In-app notifications fire on every transition, resolved per `user.preferredLang` at creation time — no runtime translation.

**Refund tiers on cancellation:**

| When                 | Buyer refund | Seller gets               |
| -------------------- | ------------ | ------------------------- |
| Before advance paid  | No charge    | —                         |
| 24h+ before pickup   | 100%         | 0%                        |
| 2–24h before pickup  | 50%          | 50%                       |
| <2h or on inspection | 0%           | 100%                      |
| Seller cancels       | 100%         | 0% + reliabilityScore −15 |

---

## Project Status

**Stage 1 — Complete ([live](https://kridha-marketplace.vercel.app))**

61 API endpoints · PostgreSQL + PostGIS on Supabase · 22 Prisma models · 19 system invariants · 39 typed error codes · Full buyer + seller + admin flows · Hindi-first bilingual PWA · Three-layer rate limiting · CSRF protection · CSP hardened · Token family rotation · Redis cache-aside · Lazy stock expiry · Pino structured logging · GlitchTip error tracking · Upptime monitoring · k6 load test suite · Docker local dev

**Stage 2 — Planned (August 2026)**

- BullMQ workers on Railway — async notifications, payout processing
- DB read replica for product listing under high load
- Razorpay Route for automated bank transfers

**Stage 3 — Planned (December 2026)**

- Multi-city expansion beyond UP
- Mobile app (React Native)

---

## Built By

**Abhishek Kumar** · NIT Allahabad '24 · Backend Engineer

Available for backend engineering roles — reach out directly.

[LinkedIn](https://www.linkedin.com/in/abhishekkumar878/) · [GitHub](https://github.com/DevWithAbhishek) · [Website](https://www.codewithabhishek.in/)
