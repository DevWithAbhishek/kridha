# 🌿 Kridha

> B2B + B2C self-pickup marketplace connecting kirana owners with micro-suppliers in Tier-2/3 India — starting with Uttar Pradesh.

[![Live](https://img.shields.io/badge/status-building-yellow)](https://github.com/DevWithAbhishek/kridha)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## The Problem

Udaan and B2B platforms require minimum orders of 50 kg+ to make delivery economics work. A kirana owner needing 8 kg of mustard oil from a local mill 3 km away has no platform — he calls, negotiates, and pays cash on pickup with zero protection.

**Kridha removes the minimum order constraint** by eliminating delivery entirely. Buyers self-pickup. Suppliers list what they have. The platform handles discovery, payment protection, and trust — nothing else.

---

## Who It's For

| Role | Who | What they do |
|------|-----|--------------|
| **Buyer** | Kirana owners, small retailers | Browse nearby suppliers, place orders, pay advance, self-pickup |
| **Seller** | Farmers, oil mills, local manufacturers, small wholesalers | List products, set price tiers, manage pickup windows, receive payouts |
| **Admin** | Platform operators | Verify seller KYC, manage disputes, audit all actions |

---

## How It Works

### 🛒 Buyer Flow

A kirana owner in Lucknow opens Kridha. He sees suppliers within 10 km selling Mustard Oil, Wheat, and Dairy — filtered by city and radius. He narrows results by price range, deal active, distance, brand, and category, with sorting by price or distance.

He selects Mustard Oil (10 kg at bulk tier price), adds Wheat Flour from a second supplier to cart, and checks out. Kridha calculates the advance per seller — `MIN(₹500, MAX(₹100, 5% of order total))` — and collects the combined advance in one Razorpay flow.

Both orders confirm atomically. He receives a delivery OTP and pickup window for each supplier independently.

At the supplier's location he inspects the goods. Seller requests full payment via Kridha. Buyer pays. Buyer shares OTP. Order is marked **COMPLETED**. Seller payout is queued for the next batch run.

### 🏪 Seller Flow

A mustard oil mill owner onboards Kridha. He creates his store (name + address combination is unique on the platform) and sets pickup windows — morning 6–9 AM, evening 4–7 PM, Monday to Saturday.

He lists Mustard Oil with variable units (sold in KG, minimum 5 KG, increment 5 KG), price tiers (₹95/kg for 5–20 kg, ₹88/kg for 20 kg+), and marks it unbranded. He adds a deal — 10% off for 72 hours. After the deal expires, pricing reverts to the original tier automatically via Vercel Cron.

### 📦 Order Lifecycle
PENDING → CONFIRMED → AWAITING_PAYMENT → READY_FOR_OTP_VERIFICATION → COMPLETED
↘ CANCELLED                                        ↘ DISPUTED

Every transition is recorded in `OrderStatusHistory` with a timestamp. In-app notifications fire on every transition, resolved per `user.preferredLang` at creation time — no runtime translation. Either party can cancel subject to refund tier rules.

**Refund tiers on cancellation:**

| When | Buyer refund | Seller gets |
|------|-------------|-------------|
| Before advance paid | No charge | — |
| 24h+ before pickup | 100% | 0% |
| 2–24h before pickup | 50% | 50% |
| <2h or on inspection | 0% | 100% |
| Seller cancels | 100% | 0% + reliabilityScore −15 |

---

## Technical Architecture

### Order → SubOrder Decomposition

**The core design question:** why does a single checkout produce an `Order` with multiple `SubOrder` records?

**Atomic financial transaction vs. independent seller logistics.**

An `Order` is the buyer's single Razorpay advance — one payment, one receipt. It must be atomic: the advance covers all sellers simultaneously in one transaction. This is the financial unit.

A `SubOrder` is a per-seller operational contract. Each seller has independent pickup windows, pickup deadlines, payment links, OTPs, and payout records. A buyer ordering from three sellers in one checkout produces three completely independent fulfillment tracks. Seller A cancelling does not affect Seller B. Seller B's OTP verification does not complete Seller A's order. Payouts are calculated per-seller after platform fee deduction: `payout = SubOrder.totalAmount − SubOrder.platformFee`.

The decomposition also enforces `INV-16` — reviews link to `SubOrder`, not `Order`. One review per product per seller transaction, not per checkout session.

At the DB layer: `Order` holds `totalAmount`, `advanceAmount`, `platformFee`, and `cartSessionId`. `SubOrder` holds `status`, `pickupDate`, `pickupDeadline`, `deliveryOtp`, `paymentLinkUrl`, `otpAttempts`, and the payout record. Stock decrement happens inside `prisma.$transaction()` with `SELECT FOR UPDATE` per-seller group — two buyers racing for the last item produce exactly one `201` and one `409 INSUFFICIENT_STOCK`.

### Cookie-Only Authentication

Kridha uses **strictly HttpOnly cookies** — no `Authorization` headers, no `localStorage`, no JWTs in response bodies.

| Cookie | Path | Max-Age | HttpOnly | Purpose |
|--------|------|---------|----------|---------|
| `kridha_access` | `/` | 15 min | ✅ | JWT access token — user identity |
| `kridha_refresh` | `/api/auth` | 7 days | ✅ | Rotation chain — SHA-256 hash stored in DB |
| `kridha_lang` | `/` | 1 year | ❌ | `"hi"` or `"en"` — next-intl client reads it |
| `kridha_access_exp` | `/` | 15 min | ❌ | Unix timestamp — proactive refresh scheduler reads it |

`kridha_refresh` is scoped to `path=/api/auth` — the browser never sends it to product, order, or payment endpoints. Token family rotation: reusing a rotated refresh token immediately revokes all sessions for that user (theft detection).

The `api.ts` Axios interceptor handles silent refresh. On `401`, it queues all in-flight requests and fires `POST /api/auth/refresh` using a clean `refreshClient` instance (no interceptor — prevents recursive refresh loops). On success, queued requests replay. On failure, all queued requests reject and the user is redirected to `/login`. Auth endpoints (`/auth/login`, `/auth/signup`, `/auth/refresh`) are explicitly excluded from the interceptor to prevent infinite refresh cycles.

`getUser(req)` and `requireRole(req, Role)` in `src/lib/get-user.ts` read `req.cookies.get("kridha_access")` and verify the JWT directly — no header dependency. Route handlers never import JWT. `getOptionalUser()` is used on public GET routes (product feed) to optionally resolve the caller for INV-14 (seller feed exclusion) without blocking unauthenticated access.

Admin routes use a completely separate auth surface: `kridha_admin` cookie, `ADMIN_JWT_SECRET`, `getAdmin()` / `requireSuperAdmin()` in `src/lib/getAdmin.ts`. Admin tokens carry `type: "admin"` — a user JWT cannot be substituted even if both secrets were identical.

### PostGIS Spatial Queries

Product discovery uses a raw `$queryRaw` PostGIS query — not Prisma's ORM. Reasons:

1. **`Unsupported("geography(Point, 4326)")`** — Prisma cannot construct spatial predicates for this column type.
2. **`ST_DWithin` + GIST index** — the geography GIST index on `Product.location` makes radius queries O(log n). Prisma `findMany` with lat/lng arithmetic would table-scan.
3. **`<->` KNN operator** — `ORDER BY location <-> target` uses the index for nearest-first sorting without computing distance for every row.
4. **`min_price` subquery** — `CASE WHEN deal THEN discounted_price ELSE tier_price` per product in the same query pass, avoiding N+1 on tier resolution.

`buildWhereClause()` and `buildOrderClause()` in `src/lib/postgis.ts` compose `Prisma.sql` tagged template fragments. All user inputs are parameterized — no string interpolation.

The `location` column is a Postgres generated column populated from `latitude`/`longitude`. `COALESCE(p.location, ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography)` guards against NULL during seed and migration gaps.

### Pricing Logic

`calcUnitPrice(quantity, tiers)` in `src/lib/pricing.ts` sorts tiers ascending by `minQty` and iterates all of them, overwriting `price` for every tier where `quantity >= tier.minQty`. The last qualifying tier wins. This is correct: a 50-unit order at tiers `[{min:1,₹100},{min:10,₹90},{min:50,₹80}]` must produce `₹80`, not `₹100` (first match).

Price is always calculated server-side. No endpoint accepts `unitPrice` from the client — INV-18 extends to financial fields.

---

## The ₹0/month Stack

| Service | Role | Free tier constraint | Mitigation |
|---------|------|---------------------|------------|
| **Neon** (PostgreSQL + PostGIS) | Primary DB | 0.5 GB storage, compute suspends after 5 min inactivity | `withRetry()` in `src/lib/db.ts` — 4 attempts with 1.5s exponential backoff on P1001 / WebSocket errors. Neon wakes in 1–4s. |
| **Upstash Redis** | Rate limiting, product feed cache | 10k commands/day | Fail-open rate limiter: Redis errors are caught and logged, request passes through. Cache miss falls through to DB — Redis is never source of truth. |
| **Vercel Hobby** | Hosting, API routes, Cron | 100 GB bandwidth, 60s function timeout, 2 cron jobs | `cpus: 1` in `next.config.ts` prevents OOM on build. 3 crons defined in `vercel.json` — requires Pro for all 3 to run. |
| **Cloudinary** | Product + avatar images | 25 GB storage, 25 GB bandwidth | Signed uploads — files go directly from browser to Cloudinary, never through Vercel. `CLOUDINARY_API_SECRET` never leaves server. |
| **Razorpay** | Payments | No monthly fee — 2% per transaction | Webhook idempotency via `WebhookLog.razorpayPaymentId @unique` prevents double-processing on Razorpay retries. |
| **GlitchTip** | Error tracking | Free self-hosted / free tier | Drop-in `@sentry/nextjs` DSN replacement. `GLITCHTIP_DSN` in `instrumentation.ts`. |

**Cold start handling:** `PrismaNeon` adapter uses Neon's serverless WebSocket driver — connection established per request, not per process. `withRetry<T>(fn, retries=4, delayMs=1500)` wraps all DB calls that can tolerate retry. The `Razorpay` instance is a module-level singleton (`getRazorPay()`) — reused across warm invocations within the same Lambda container.

---

## System Invariants

Correctness guarantees enforced at both DB and application layer. Violating any of these is a bug, not a missing feature.

| # | Invariant | Enforcement | Enforcement Node |
|---|-----------|-------------|-----------------|
| INV-01 | `product.available` never goes negative | DB `CHECK (available >= 0)` + `SELECT FOR UPDATE` inside `prisma.$transaction()` | `src/services/order.service.ts` + DB constraint |
| INV-02 | COMPLETED or CANCELLED status cannot change | State machine rejects transitions before any DB write. Terminal states have empty edge sets. | `src/lib/state-machine.ts` → `validateTransition()` |
| INV-03 | Payment webhook processed exactly once | `WebhookLog.razorpayPaymentId @unique` — duplicate event returns `200` without reprocessing | `src/app/api/webhooks/razorpay/route.ts` + DB unique constraint |
| INV-04 | BUYER cannot access seller-only routes | `requireRole(req, Role.SELLER)` reads JWT from `kridha_access` cookie | `src/lib/get-user.ts` → `requireRole()` |
| INV-05 | User sees only their own orders | `getUser(req)` resolves `userId` from cookie. Order queries filter by `buyerId` or `sellerId`. Admins exempt. | `src/lib/get-user.ts` + `src/repo/order.repo.ts` |
| INV-06 | Delivery OTP cleared after verification | `deliveryOtp` set to `null` on COMPLETED in the same transaction as status update | `src/services/payment.service.ts` → `verifyOtp()` |
| INV-07 | Phone is the unique user identifier | `phone @unique` at DB level. Silent signup: duplicate phone returns `201` without revealing existence | `prisma/schema.prisma` + `src/services/auth.service.ts` |
| INV-08 | Seller store name + address must be unique | `@@unique([storeName, street])` at DB level | `prisma/schema.prisma` |
| INV-09 | Deal price reverts after expiry | Vercel Cron sets `Deal.status = EXPIRED` daily. Product response JOINs only `status = ACTIVE AND expiresAt > NOW()` | `src/app/api/cron/expire-deals/route.ts` + `src/repo/product.repo.ts` |
| INV-10 | Order total must be ≥ ₹1,000 | `orderService` checks `sellerTotal >= PlatformConfig.minOrderAmountPerSeller` before Razorpay advance creation | `src/services/order.service.ts` |
| INV-11 | Order cannot confirm without captured advance | Only `payment.captured` webhook triggers `PENDING → CONFIRMED`. No manual promotion endpoint exists. | `src/app/api/webhooks/razorpay/route.ts` |
| INV-12 | Order cannot complete without full payment AND OTP | State machine requires `READY_FOR_OTP_VERIFICATION` before `verifyOtp()` is callable | `src/lib/state-machine.ts` + `src/services/payment.service.ts` |
| INV-13 | Refund calculated server-side only | `calcRefundAmount(advance, pickupDeadline, cancelledBy)` — client never sends `refundAmount` | `src/lib/refund.ts` + `src/services/order.service.ts` |
| INV-14 | Seller cannot see own products in buyer feed | `AND p."sellerId" != $userId` appended to PostGIS raw query when `userId` is present | `src/lib/postgis.ts` → `buildWhereClause()` + `src/repo/product.repo.ts` |
| INV-15 | Review only allowed after COMPLETED SubOrder | `reviewService` verifies `subOrder.status === COMPLETED` and `subOrder.order.buyerId === userId` | `src/services/review.service.ts` |
| INV-16 | One review per order per product | `Review.@@unique([subOrderId, productId])` at DB level | `prisma/schema.prisma` |
| INV-17 | Bank details masked in all non-admin responses | `accountNumber` truncated to last 4 digits in all seller profile GET handlers. `adminRepo.getSellerDetail()` returns unmasked. | `src/app/api/sellers/profile/route.ts` + `src/repo/admin.repo.ts` |
| INV-18 | Client never sends status transitions | No endpoint accepts `status` in request body. All transitions via service layer or webhooks only. | `src/schemas/index.ts` (Zod schemas omit `status`) |
| INV-19 | Cart checkout reads from server state only | `POST /api/cart/checkout` takes no body. Server reads `CartSession` from DB by `userId`. | `src/app/api/cart/checkout/route.ts` |

---

## Architecture Patterns

### Repository Pattern
All Prisma access is isolated per domain: `authRepo`, `productRepo`, `orderRepo`, `sellerRepo`, `userRepo`, `adminRepo`. Services import repos, never `prisma` directly. ORM replacement = one file per domain.

### State Machine
`validateTransition(from, to)` in `src/lib/state-machine.ts` throws `INVALID_TRANSITION` before any DB write. Terminal states (`COMPLETED`, `CANCELLED`, `DISPUTED`) have empty edge arrays — no `if` chain, no enum comparison in service code.

### Idempotent Webhook Processing
`WebhookLog.razorpayPaymentId @unique` + check-before-process in the webhook handler. Insert and status update inside one `$transaction`. Duplicate event: `200`, no reprocessing. Signature failure: logged, `200` returned — prevents Razorpay retry storms.

### Structured Error Handling
`AppError` class with machine-readable `code`, `statusCode`, and optional `meta`. `handleError()` in `src/lib/handleError.ts` converts `AppError`, `ZodError`, and unknown errors to consistent JSON. 39 typed error codes in `src/lib/errors.ts`. 5xx `AppError`s are logged via Pino before responding.

### Structured Logging
Pino with `redact` — `pin`, `otp`, `deliveryOtp`, `refreshToken`, `accountNumber`, `ifscCode`, `panNumber` are replaced with `[REDACTED]` before any log write. `withLogger(handler, action)` wraps route handlers to emit `{ userId, action, method, path, status, ms }` on every request.

### Cache-Aside (Product Feed)
`cacheGet<T>()` / `cacheSet()` / `cacheDel()` in `src/lib/redis.ts` wrap Upstash operations. Cache key: `products:{lat}:{lng}:{radius}:{category}:{page}`. TTL: 60s (matches TanStack Query `staleTime`). All cache operations are non-fatal — errors fall through to DB. Invalidated on product create/update/delete.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router) | Single deployment: frontend + API routes + cron |
| Language | TypeScript strict | Schema/type mismatches caught at compile time; no `any` in codebase |
| Database | PostgreSQL 16 via Neon + PostGIS | GIST index on `geography` column for O(log n) radius search; `pg_trgm` GIN for product search |
| ORM | Prisma 7 + `@prisma/adapter-neon` | Type-safe queries; `$transaction()` for atomic stock decrement |
| Cache | Upstash Redis | HTTP-based, serverless-compatible; sliding window rate limiting + product feed TTL |
| Auth | Phone + PIN · Argon2 · HttpOnly Cookies | XSS-proof; no localStorage; token family theft detection via rotation chain |
| Payments | Razorpay | Two-phase: advance (booking confirmation) + payment link (remaining at pickup) |
| Images | Cloudinary | Signed direct uploads; auto f_auto/q_auto/w_1200; blurHash placeholders |
| i18n | next-intl + `i18n-strings.ts` | Hindi-first; notifications resolved at creation time, not at render |
| Validation | Zod v4 | Schema-first — API contract drives service implementation |
| Logging | Pino + GlitchTip | Structured JSON to Vercel log drain; `@sentry/nextjs` pointing at GlitchTip DSN |
| Deploy | Vercel (Hobby) | ₹0/month; cron support; preview URLs per PR |

**Total infrastructure cost: ₹0/month**

---

## API Surface

61 endpoints across 12 resource groups. Full contract in [`API.md`](./API.md).

| Group | Endpoints | Auth |
|-------|-----------|------|
| Auth | 8 | Public + Cookie |
| Users | 5 | Cookie (BUYER/SELLER) |
| Sellers | 6 | Cookie (SELLER) |
| Pickup Windows | 4 | Cookie (SELLER) |
| Products — Buyer | 3 | Public (optional auth) |
| Products — Seller | 7 | Cookie (SELLER) |
| Cart | 6 | Cookie (BUYER) |
| Orders | 7 | Cookie (BUYER/SELLER) |
| Reviews | 4 | Public GET / Cookie write |
| Saved Products | 3 | Cookie (BUYER) |
| Notifications | 6 | Cookie (BUYER/SELLER) |
| Webhooks | 1 | HMAC (Razorpay) |
| Admin | 8 | Cookie (ADMIN JWT) |
| Cron | 3 | Bearer `CRON_SECRET` |

**Response envelope** — every endpoint, success or error:
```json
{ "success": true,  "data": { } }
{ "success": false, "code": "MACHINE_READABLE", "message": "Human readable.", "meta": { } }
```

---

## Database Schema

22 Prisma models. Key relationships:
User ──< SellerProfile ──< Product ──< PriceTier
──< PickupWindow         ──< Deal
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
──< RefreshToken
AdminUser ──< AdminAuditLog
PlatformConfig (singleton: id = "singleton")
WebhookLog

---

## Local Setup

```bash
git clone https://github.com/DevWithAbhishek/kridha.git && cd kridha
npm install
cp .env.example .env          # fill DATABASE_URL, DIRECT_URL, JWT_SECRET, etc.
docker-compose up -d           # postgres:5432 (PostGIS) + redis:6379
npx prisma migrate dev         # enables postgis, pg_trgm, GIST + GIN indexes
npx prisma db seed             # 10 verified sellers, 540 products, 108 deals, 1 buyer
npm run dev
```

**Seed credentials** — all accounts use PIN `1234`. Ten seller phones + one test buyer phone printed to console after seed completes.

**Required environment variables:**
DATABASE_URL          # Neon pooled (runtime)
DIRECT_URL            # Neon non-pooled (migrations + seed)
JWT_SECRET            # ≥32 char random string
ADMIN_JWT_SECRET      # separate secret — admin surface
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
GLITCHTIP_DSN
CRON_SECRET           # Vercel sets automatically; replicate locally for testing
NEXT_PUBLIC_RAZORPAY_KEY_ID

---

## Project Status

**Stage 1 — Complete**
- 61 API endpoints on Vercel
- PostgreSQL on Neon with PostGIS radius search
- 22 Prisma models, 19 system invariants, 39 typed error codes
- Full buyer + seller + admin flows
- Hindi-first bilingual PWA (mobile-first, dark mode)
- Pincode autofill (India Post API, 2G-optimized)

**Stage 2 — Planned**
- BullMQ workers on Railway (replace Vercel cron for high-volume payout processing)
- DB read replica for product listing under load
- Razorpay Route for automated bank transfers
- SMS OTP via Twilio (currently console-logged in dev)

---

## Built By

**Abhishek** · NIT Allahabad '24 · Backend Engineer  
Open to backend roles · Fully available from April 2026

[![GitHub](https://img.shields.io/badge/GitHub-DevWithAbhishek-black?logo=github)](https://github.com/DevWithAbhishek)
[![Website](https://img.shields.io/badge/Website-codewithabhishek.in-green?logo=google-chrome)](https://www.codewithabhishek.in/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Abhishek%20Kumar-blue?logo=linkedin)](https://www.linkedin.com/in/abhishekkumar878/)