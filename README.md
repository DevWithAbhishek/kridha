# 🌿 Kridha

> B2B + B2C self-pickup marketplace connecting kirana owners with local suppliers in Tier-2/3 India — starting with Uttar Pradesh.

[![Live](https://img.shields.io/badge/status-building-yellow)](https://kridha-marketplace.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://typescriptlang.org)
[![Uptime](https://img.shields.io/badge/uptime-monitored-brightgreen)](https://DevWithAbhishek.github.io/kridha-status)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## The Problem

Udaan and B2B platforms require minimum orders of 50 kg+ to make delivery economics work. A kirana owner needing 8 kg of mustard oil from a local mill 3 km away has no platform — he calls, negotiates, and pays cash on pickup with zero protection.

**Kridha removes the minimum order constraint** by eliminating delivery entirely. Buyers self-pickup. Suppliers list what they have. The platform handles discovery, payment protection, and trust — nothing else.

---

## Who It's For

| Role       | Who                                                        | What they do                                                           |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Buyer**  | Kirana owners, small retailers                             | Browse nearby suppliers, place orders, pay advance, self-pickup        |
| **Seller** | Farmers, oil mills, local manufacturers, small wholesalers | List products, set price tiers, manage pickup windows, receive payouts |
| **Admin**  | Platform operators                                         | Verify seller KYC, manage disputes, audit all actions                  |

---

## How It Works

### 🛒 Buyer Flow

A kirana owner in Gorakhpur opens Kridha. He sees suppliers within 10 km selling Mustard Oil, Wheat, and Dairy — filtered by city and radius. He narrows results by price range, deal active, distance, brand, and category, with sorting by price or distance.

He selects Mustard Oil (10 kg at bulk tier price), adds Wheat Flour from a second supplier to cart, and checks out. Kridha locks stock atomically using `SELECT FOR UPDATE` and calculates the advance per seller — `MIN(₹500, MAX(₹100, 5% of order total))` — collecting the combined advance in one Razorpay flow.

Both orders confirm atomically when the advance webhook fires. He receives a delivery OTP and pickup window for each supplier independently. The pickup date must be valid for the selected pickup window's active days. Today is valid for same-day pickup if the window end time has not passed.

At the supplier's location he inspects the goods. Seller requests full payment via Kridha payment link. Buyer pays. Buyer shares OTP. Order is marked **COMPLETED**. Seller payout is queued for the next batch run.

### 🏪 Seller Flow

A mustard oil mill owner onboards Kridha. He creates his store (name + address combination is unique on the platform) and sets pickup windows — Morning 8–12, Afternoon 12–16, Evening 16–20 — all active 7 days a week by default.

He lists Mustard Oil with variable units (sold in KG, minimum 5 KG, increment 5 KG), price tiers (₹95/kg for 5–20 kg, ₹88/kg for 20 kg+), and marks it unbranded. He adds a deal — 10% off for 72 hours. After the deal expires, pricing reverts to the original tier automatically.

### 📦 Order Lifecycle

```
PENDING → CONFIRMED → AWAITING_PAYMENT → READY_FOR_OTP_VERIFICATION → COMPLETED
        ↘ CANCELLED                                                   ↘ DISPUTED
```

Every transition is recorded in `OrderStatusHistory` with a timestamp. In-app notifications fire on every transition, resolved per `user.preferredLang` at creation time — no runtime translation. Either party can cancel subject to refund tier rules.

If the buyer does not pay the advance within 15 minutes of order creation, the stock is automatically released. The release is lazy — triggered on the next product list or cart add request rather than a cron job (Vercel Hobby only allows one cron per day). A daily cleanup cron sweeps any remaining orphaned PENDING orders.

**Refund tiers on cancellation:**

| When                 | Buyer refund | Seller gets               |
| -------------------- | ------------ | ------------------------- |
| Before advance paid  | No charge    | —                         |
| 24h+ before pickup   | 100%         | 0%                        |
| 2–24h before pickup  | 50%          | 50%                       |
| <2h or on inspection | 0%           | 100%                      |
| Seller cancels       | 100%         | 0% + reliabilityScore −15 |

---

## Technical Architecture

### Order → SubOrder Decomposition

**The core design question:** why does a single checkout produce an `Order` with multiple `SubOrder` records?

**Atomic financial transaction vs. independent seller logistics.**

An `Order` is the buyer's single Razorpay advance — one payment, one receipt. It must be atomic: the advance covers all sellers simultaneously in one transaction. This is the financial unit.

A `SubOrder` is a per-seller operational contract. Each seller has independent pickup windows, pickup deadlines, payment links, OTPs, and payout records. A buyer ordering from three sellers in one checkout produces three completely independent fulfillment tracks. Seller A cancelling does not affect Seller B. Seller B's OTP verification does not complete Seller A's order. Payouts are calculated per-seller after platform fee deduction: `payout = SubOrder.totalAmount − SubOrder.platformFee`.

Stock decrement happens inside `prisma.$transaction()` with `SELECT FOR UPDATE` per-seller group — two buyers racing for the last item produce exactly one `201` and one `409 INSUFFICIENT_STOCK`. Validated under load: 50 simultaneous checkouts on stock=10 produce exactly 10 success, 40 conflict, 0 server errors.

If Razorpay order creation fails after the DB transaction commits, a compensating transaction immediately restores stock and marks the SubOrder CANCELLED. No orphaned stock locks.

### Authentication Architecture

Kridha uses **strictly HttpOnly cookies** — no `Authorization` headers, no `localStorage`, no JWTs in response bodies.

| Cookie              | Path        | Max-Age | HttpOnly | Purpose                                               |
| ------------------- | ----------- | ------- | -------- | ----------------------------------------------------- |
| `kridha_access`     | `/`         | 15 min  | ✅       | JWT access token — user identity                      |
| `kridha_refresh`    | `/api/auth` | 7 days  | ✅       | Rotation chain — SHA-256 hash stored in `userSession` |
| `kridha_lang`       | `/`         | 1 year  | ❌       | `"hi"` or `"en"` — next-intl client reads it          |
| `kridha_access_exp` | `/`         | 15 min  | ❌       | Unix timestamp — proactive refresh scheduler          |

**Three-layer rate limiting** (proxy.ts):

- Layer 1: Per-IP sliding window — 5 req/min on auth, 60 req/min general
- Layer 2: Per-account sliding window — 10 attempts per phone per 15 min (defeats distributed credential stuffing — IP rotation cannot bypass this)
- Layer 3: Global auth ceiling — 500 req/min platform-wide (DDoS protection)

All three layers fail-open — Redis down means request passes through, never blocks legitimate traffic.

**Session model:** `userSession` tracks `ipAddress`, `userAgent`, `lastSeenIp`, and `lastSeenAt` per token. IP change on refresh is logged and alerted. Token reuse (reusing a rotated token) immediately revokes all sessions for that user and fires a GlitchTip fatal alert.

**Admin auth** uses a completely separate surface: `kridha_admin` cookie, `ADMIN_JWT_SECRET`, `path=/api/admin` (browser never sends to buyer/seller routes). Admin tokens carry `type: "admin"` — a user JWT cannot be substituted even if the secrets were identical.

**Security mitigations applied:**

- Argon2 + DUMMY_HASH constant-time comparison (timing attack prevention)
- `algorithms: ["HS256"]` whitelist on all `jwt.verify()` calls (none-algorithm attack prevention)
- Progressive PIN lockout: 5 failures → 10min, 10 → 1hr, 20+ → 24hr
- Silent signup — duplicate phone returns identical 201 response (enumeration prevention)
- CSRF double-submit token on all mutation endpoints
- CSP: `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`

### PostGIS Spatial Queries

Product discovery uses a raw `$queryRaw` PostGIS query — not Prisma's ORM. Reasons:

1. **`Unsupported("geography(Point, 4326)")`** — Prisma cannot construct spatial predicates for this column type.
2. **`ST_DWithin` + GIST index** — the geography GIST index on `Product.location` makes radius queries O(log n). ORM `findMany` with lat/lng arithmetic would table-scan.
3. **`<->` KNN operator** — `ORDER BY location <-> target` uses the index for nearest-first sorting without computing distance for every row.
4. **`min_price` subquery** — `CASE WHEN deal THEN discounted_price ELSE tier_price` per product in the same query pass, avoiding N+1 on tier resolution.

`buildWhereClause()` and `buildOrderClause()` in `src/lib/postgis.ts` compose `Prisma.sql` tagged template fragments. All user inputs are parameterized — no string interpolation.

The `location` column is a Postgres generated column populated from `latitude`/`longitude`. `COALESCE(p.location, ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography)` guards against NULL during seed and migration gaps.

### Redis Caching Architecture

Cache-aside pattern on all high-traffic read paths. Dual-mode: Upstash (production) / local Docker Redis (development, works offline).

| Cache Key                                                     | TTL   | Invalidated by                           |
| ------------------------------------------------------------- | ----- | ---------------------------------------- |
| `kridha:products:{lat3dp}:{lng3dp}:{radius}:{page}:{filters}` | 60s   | Product create/update/delete/deal change |
| `kridha:product:{id}`                                         | 300s  | Product update/delete                    |
| `kridha:deals:{lat}:{lng}:{radius}`                           | 120s  | Deal create/expire                       |
| `kridha:seller:{userId}`                                      | 600s  | Seller profile update                    |
| `kridha:notifs:{userId}:{page}`                               | 30s   | New notification created                 |
| `kridha:platform-config`                                      | 3600s | Manual invalidation only                 |

Latitude/longitude rounded to 3 decimal places (~111m precision) — nearby users share the same cache entry. All cache operations are fire-and-forget and fail-open: Redis error = cache miss = DB query. Redis is never the source of truth.

### Connection Pool Configuration

Prisma 7 with `@prisma/adapter-pg`. The adapter receives a configured `pg.Pool` — not a connection string — to give explicit control over pool sizing under load.

```
Development (Docker): max=50 connections, idleTimeoutMillis=30000
Production (Supabase free): max=15 connections (leaves headroom on 200-connection pooler limit)
```

Passing a connection string to the adapter uses `pg` defaults (max=10), which causes connection queuing under concurrent load. Explicit pool configuration eliminates the queuing bottleneck.

### Lazy Stock Expiry (No Cron Required)

Vercel Hobby allows one cron execution per day. Rather than relying on a daily sweep, stock release is lazy:

- `productRepo.findNearby` calls `releaseAllExpiredPendingOrders()` (fire-and-forget) before counting `available`
- `cartService.addItem` calls `releaseExpiredHoldsForProduct(productId)` before the stock advisory check
- `GET /api/orders/[id]/advance` returns `410 Gone` if the payment window has expired, triggering frontend redirect

The daily cron at 2 AM sweeps anything the lazy release missed. Maximum stock lock under worst case (server error during lazy release, daily cron not yet run): until 2 AM. Acceptable for Tier-2 B2B where orders are placed during business hours.

### Pricing Logic

`calcUnitPrice(quantity, tiers)` in `src/lib/pricing.ts` sorts tiers ascending by `minQty` and iterates all of them, overwriting `price` for every tier where `quantity >= tier.minQty`. The last qualifying tier wins. This is correct: a 50-unit order at tiers `[{min:1,₹100},{min:10,₹90},{min:50,₹80}]` must produce `₹80`, not `₹100` (first match).

Price is always calculated server-side. No endpoint accepts `unitPrice` from the client. Cart items store `unitPrice` at add-time (`ci.unitPrice`) and this locked price is used at order creation — buyers are protected from deal removal between cart add and checkout (INV-18 extends to financial fields).

---

## Stack

| Layer      | Technology                                | Why                                                                                                              |
| ---------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router)                   | Single deployment: frontend + API routes + cron                                                                  |
| Language   | TypeScript strict                         | Schema/type mismatches caught at compile time                                                                    |
| Database   | PostgreSQL 16 + PostGIS via Supabase      | GIST index on `geography` column for O(log n) radius search; `pg_trgm` GIN for product search                    |
| ORM        | Prisma 7 + `@prisma/adapter-pg`           | Type-safe queries; `$transaction()` for atomic stock decrement; configured `pg.Pool` for connection management   |
| Cache      | Upstash Redis (prod) / Docker Redis (dev) | HTTP-based serverless-compatible; sliding window rate limiting + product feed TTL                                |
| Auth       | Phone + PIN · Argon2 · HttpOnly Cookies   | XSS-proof; no localStorage; token family theft detection; userSession IP tracking                                |
| Payments   | Razorpay                                  | Two-phase: advance (booking confirmation) + payment link (remaining at pickup)                                   |
| Images     | Cloudinary                                | Signed direct uploads; `f_auto/q_auto/w_1200`; blurHash placeholders                                             |
| i18n       | next-intl + `i18n-strings.ts`             | Hindi-first; notifications resolved at creation time, not at render                                              |
| Validation | Zod v4                                    | Schema-first; `safeString` transform strips HTML from all user string inputs (stored XSS prevention)             |
| Logging    | Pino + GlitchTip + Upptime                | Structured JSON with `requestId` correlation; 14 fields redacted before write; error tracking; uptime monitoring |
| Deploy     | Vercel (Hobby) + Supabase                 | ₹0/month                                                                                                         |

**Total infrastructure cost: ₹0/month**

---

## Observability

**Logging (Pino):** Structured JSON on every request — `action`, `method`, `path`, `status`, `ms`, `requestId`. Sensitive fields (`pin`, `otp`, `accountNumber`, `ifscCode`, `panNumber`, `refreshToken`, cookie headers) redacted before write. `withLogger(handler, action)` wraps all route handlers.

**Error tracking (GlitchTip):** `@sentry/nextjs` SDK pointing at GlitchTip DSN. Every unhandled exception captured with stack trace, request context, and userId. Email alert on new error type. Security events (credential stuffing, token theft, IP change on refresh) fire Sentry messages with `fatal` severity.

**Uptime monitoring (Upptime):** GitHub Actions checks `/api/health` every 5 minutes. Opens GitHub Issue on outage (MTTR tracked automatically). Public status page at [DevWithAbhishek.github.io/kridha-status](https://DevWithAbhishek.github.io/kridha-status).

---

## Performance Validation (k6 Load Tests)

Tests in `tests/load/`. Run against local Docker for accurate numbers (no cold start noise).

| Test                            | Tool                           | Result                                                                  |
| ------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Response time percentiles       | k6 `01_percentiles.js`         | P95 < 200ms reads (Docker + Redis cache)                                |
| Throughput & error rate         | k6 `02_throughput.js`          | 52+ req/s at 100 VUs, 0% HTTP 5xx                                       |
| Race condition (stock oversell) | k6 `03_race_condition.js`      | 50 concurrent checkouts on stock=10 → success=10, conflict=40, errors=0 |
| Webhook idempotency             | k6 `04_webhook_idempotency.js` | ✅ 100 concurrent duplicates → WebhookLog COUNT = 1                     |
| Concurrency (cart, auth, reads) | k6 `05_concurrency.js`         | 200 VUs on product read, 99%+ success rate                              |

---

## System Invariants

Correctness guarantees enforced at both DB and application layer.

| #      | Invariant                                          | Enforcement                                                                                 |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| INV-01 | `product.available` never goes negative            | DB `CHECK (available >= 0)` + `SELECT FOR UPDATE` inside `prisma.$transaction()`            |
| INV-02 | COMPLETED or CANCELLED status cannot change        | State machine — terminal states have empty edge sets                                        |
| INV-03 | Payment webhook processed exactly once             | `WebhookLog.razorpayPaymentId @unique` + idempotency check before processing                |
| INV-04 | BUYER cannot access seller-only routes             | `requireRole(req, Role.SELLER)` reads JWT from HttpOnly cookie                              |
| INV-05 | User sees only their own orders                    | `userId` from cookie; all order queries filter by `buyerId` or `sellerId`                   |
| INV-06 | Delivery OTP cleared after verification            | `deliveryOtp` set to `null` on COMPLETED in same transaction as status update               |
| INV-07 | Phone is the unique user identifier                | `phone @unique` at DB level; silent signup prevents enumeration                             |
| INV-08 | Seller store name + address must be unique         | `@@unique([storeName, street])` at DB level                                                 |
| INV-09 | Deal price reverts after expiry                    | Product query JOINs only `status = ACTIVE AND expiresAt > NOW()`                            |
| INV-10 | Order total must meet minimum                      | `sellerTotal >= PlatformConfig.minOrderAmountPerSeller` before Razorpay creation            |
| INV-11 | Order cannot confirm without captured advance      | Only `payment.captured` webhook triggers `PENDING → CONFIRMED`                              |
| INV-12 | Order cannot complete without full payment AND OTP | State machine requires `READY_FOR_OTP_VERIFICATION` before `verifyOtp()`                    |
| INV-13 | Refund calculated server-side only                 | `calcRefundAmount(advance, pickupDeadline, cancelledBy)` — client never sends refund amount |
| INV-14 | Seller cannot see own products in buyer feed       | `AND p."sellerId" != $userId` in PostGIS raw query when `userId` present                    |
| INV-15 | Review only allowed after COMPLETED SubOrder       | `reviewService` verifies `subOrder.status === COMPLETED` and buyer ownership                |
| INV-16 | One review per order per product                   | `Review.@@unique([subOrderId, productId])` at DB level                                      |
| INV-17 | Bank details masked in non-admin responses         | `accountNumber` truncated to last 4 digits in all non-admin handlers                        |
| INV-18 | Client never sends status transitions or prices    | Zod schemas omit `status` and `unitPrice` from all request bodies                           |
| INV-19 | Cart checkout reads from server state only         | `POST /api/cart/checkout` takes no body — server reads `CartSession` from DB                |

---

## API Surface

61 endpoints across 14 resource groups. Full contract in [`API.md`](./API.md).

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

**Response envelope** — every endpoint, success or error:

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

## Local Development

**Prerequisites:** Docker Desktop, Node.js 20+

```bash
git clone https://github.com/DevWithAbhishek/kridha.git && cd kridha
npm install

# Copy env template
cp .env.example .env.local
# Fill: DIRECT_URL, DATABASE_URL (Docker), JWT_SECRET, ADMIN_JWT_SECRET,
#       RAZORPAY_*, CLOUDINARY_*, WEBHOOK_SECRET, GLITCHTIP_DSN, CRON_SECRET

# Start Docker services
docker-compose up -d
# → PostgreSQL + PostGIS on localhost:5432
# → Redis on localhost:6379

# Run migrations (creates PostGIS extension, GIST + GIN indexes)
npx prisma migrate deploy

# Seed database
npx prisma db seed
# → 10 verified sellers, 540 products, 108 deals, 1 test buyer
# → Seller phones + buyer phone printed to console (all use PIN: 1234)

npm run dev
```

**Local vs Production env:**

| Variable                 | Local (Docker)                                         | Production (Vercel)         |
| ------------------------ | ------------------------------------------------------ | --------------------------- |
| `DATABASE_URL`           | `postgresql://kridha:secret@localhost:5432/kridha_dev` | Supabase pooled (port 6543) |
| `DIRECT_URL`             | Same as DATABASE_URL                                   | Supabase direct (port 5432) |
| `UPSTASH_REDIS_REST_URL` | _(empty — uses Docker Redis)_                          | Upstash URL                 |
| `REDIS_URL`              | `redis://localhost:6379`                               | _(empty)_                   |

Redis client auto-detects environment: Upstash when `UPSTASH_REDIS_REST_URL` is set, local Docker Redis when `REDIS_URL` is set, cache disabled when neither is set (all operations no-op silently).

**All required environment variables:**

```
DATABASE_URL              # Supabase pooled (prod) / Docker (dev)
DIRECT_URL                # Supabase direct (prod) / Docker (dev)
JWT_SECRET                # ≥32 char random string
ADMIN_JWT_SECRET          # separate secret — admin surface
ENCRYPTION_KEY            # 64-char hex — AES-256-GCM for bank details at rest
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
NEXT_PUBLIC_RAZORPAY_KEY_ID
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  # production only
REDIS_URL                                           # development only
GLITCHTIP_DSN
CRON_SECRET
```

---

## Architecture Patterns

**Repository Pattern:** All Prisma access isolated per domain — `authRepo`, `productRepo`, `orderRepo`, `sellerRepo`, `adminRepo`. Services import repos, never `prisma` directly.

**State Machine:** `validateTransition(from, to)` in `src/lib/state-machine.ts` throws before any DB write. Terminal states have empty edge arrays — no if-chains in service code.

**Idempotent Webhook Processing:** `WebhookLog.razorpayPaymentId @unique` + check before process. Insert and status update inside one `$transaction`. Signature failure: logged, `200` returned — never 4xx to Razorpay (prevents retry storms).

**Structured Error Handling:** `AppError` with machine-readable `code`, `statusCode`, and optional `meta`. `handleError()` converts `AppError`, `ZodError`, and unknown errors to consistent JSON. 39 typed error codes. GlitchTip captures all 5xx via `Sentry.captureException()`.

**Compensating Transactions:** If Razorpay order creation fails after the DB `$transaction` commits, a compensating transaction restores stock and cancels SubOrders. Prevents permanently locked stock from failed payment initialization.

**Security Logging:** All auth events logged with structured context — `auth.login_failed`, `auth.pin_locked`, `security.rate_limited_ip`, `security.rate_limited_account`, `security.token_theft`. GlitchTip alerted on token theft (fatal) and credential stuffing suspicion (warning).

---

## Project Status

**Stage 1 — Complete (live at [kridha-marketplace.vercel.app](https://kridha-marketplace.vercel.app))**

- 61 API endpoints on Vercel
- PostgreSQL 16 + PostGIS on Supabase with GIST radius search
- 22 Prisma models, 19 system invariants, 39 typed error codes
- Full buyer + seller + admin flows
- Hindi-first bilingual PWA (mobile-first, dark mode)
- Three-layer rate limiting, CSRF protection, CSP hardened
- `userSession` model with IP tracking and token theft detection
- Redis cache-aside on product feed, deals, seller profiles, notifications
- Lazy stock expiry (no cron dependency for correctness)
- Pino structured logging + GlitchTip error tracking + Upptime monitoring
- k6 load test suite — percentiles, throughput, race condition, webhook idempotency, concurrency
- Docker local dev (PostGIS + Redis) — no cold starts, works offline

**Stage 2 — Planned (target: August 2026)**

- BullMQ workers on Railway (async notifications, payout processing)
- DB read replica for product listing under high load
- Razorpay Route for automated bank transfers
- SMS OTP via Twilio (currently console-logged in dev)

**Stage 3 — Planned (target: December 2026)**

- Multi-city expansion beyond UP
- Seller analytics dashboard
- Mobile app (React Native)
- AI-powered demand forecasting for sellers

---

## Built By

**Abhishek Kumar** · NIT Allahabad '24 · Backend Engineer  
Open to backend roles · Fully available

[![GitHub](https://img.shields.io/badge/GitHub-DevWithAbhishek-black?logo=github)](https://github.com/DevWithAbhishek)
[![Website](https://img.shields.io/badge/Website-codewithabhishek.in-green?logo=google-chrome)](https://www.codewithabhishek.in/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Abhishek%20Kumar-blue?logo=linkedin)](https://www.linkedin.com/in/abhishekkumar878/)
