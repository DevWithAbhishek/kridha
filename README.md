# 🌿 Kridha

> B2B + B2C self-pickup marketplace connecting kirana owners with
> micro-suppliers in Tier-2/3 India — starting with Uttar Pradesh.

[![Live](https://img.shields.io/badge/status-building-yellow)](https://github.com/DevWithAbhishek/kridha)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## The Problem

Udaan and B2B platforms require minimum orders of 50 kg+ to make delivery
economics work. A kirana owner needing 8 kg of mustard oil from a local mill
3 km away has no platform to do it through — he calls, negotiates, and pays
cash on pickup with zero protection.

**Kridha removes the minimum order constraint** by eliminating delivery
entirely. Buyers self-pickup. Suppliers list what they have. The platform
handles discovery, payment protection, and trust — nothing else.

---

## Who It's For

| Role       | Who                                                        | What they do                                                           |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Buyer**  | Kirana owners, small retailers                             | Browse nearby suppliers, place orders, pay advance, self-pickup        |
| **Seller** | Farmers, oil mills, local manufacturers, small wholesalers | List products, set price tiers, manage pickup windows, receive payouts |

---

## How It Works

### 🛒 Buyer Flow

A kirana owner in Lucknow opens Kridha. He sees suppliers within 10 km
selling Mustard Oil, Wheat, and Dairy — filtered by city and radius. He
narrows results by price range, deal active, distance, brand, and category,
with sorting by price or distance.

He selects Mustard Oil (10 kg at bulk tier price), adds Wheat Flour from a
second supplier to cart, and checks out. Kridha calculates the advance per
seller — `MIN(₹500, MAX(₹100, 5% of order total))` — and collects the
combined advance in one Razorpay flow.

Both orders confirm atomically. He receives a delivery OTP and pickup window
for each supplier independently.

At the supplier's location he inspects the goods. Seller requests full
payment via Kridha. Buyer pays. Buyer shares OTP. Order is marked
**COMPLETED**. Seller payout is queued for the 8 PM batch.

**Acceptance criteria:**

- Only suppliers within the configured radius are visible
- Order creation is atomic — stock decrements inside a single
  `prisma.$transaction()` with `SELECT FOR UPDATE`
- Buyer cannot order more than `product.available`
- OTP is generated on CONFIRMED, delivered via in-app notification
- Advance is captured before confirmation
- OTP verification marks order COMPLETED
- OTP is set to `null` immediately after use — never stored long-term (INV-06)
- middleware.ts handles all auth — route handlers never import JWT

---

### 🏪 Seller Flow

A mustard oil mill owner in Kanpur onboards Kridha. He creates his store
(name + address combination is unique on the platform) and sets pickup
windows — morning 6–9 AM, evening 4–7 PM, Monday to Saturday.

He lists Mustard Oil with variable units (sold in KG, minimum 5 KG,
increment 5 KG), price tiers (₹95/kg for 5–20 kg, ₹88/kg for 20 kg+),
and marks it unbranded. He adds a deal — 10% off for 72 hours. After the
deal expires, pricing reverts to the original tier automatically via cron.

**Acceptance criteria:**

- Products visible to buyers in the same city within 30 seconds of listing
- Stock updates propagate immediately on `PATCH /products/:id`
- Deal expiry handled by Vercel Cron — price reverts after `dealExpiresAt`
- Store name + address enforced unique at DB level

---

### 📦 Order Status — Both Roles

Every status transition is recorded in `OrderStatusHistory` with a timestamp.
An in-app notification fires on every transition for both buyer and seller.
Either party can cancel subject to the refund tier rules.

````

**Refund tiers on cancellation:**

| When | Buyer refund | Seller gets |
|------|-------------|-------------|
| Before advance paid | No charge | — |
| 24h+ before pickup | 100% | 0% |
| 2–24h before pickup | 50% | 50% |
| <2h or on inspection | 0% | 100% |
| Seller cancels | 100% | 0% + reliabilityScore −15 |

---

## System Invariants

Correctness guarantees enforced at both DB and application layer.
Violating any of these is a bug, not a missing feature.

| # | Invariant | Enforcement |
|---|-----------|-------------|
| INV-01 | `product.available` never goes negative | DB `CHECK (available >= 0)` + `SELECT FOR UPDATE` inside `prisma.$transaction()` |
| INV-02 | COMPLETED or CANCELLED order status cannot change | State machine validates every transition before writing. Terminal states have no outgoing edges. |
| INV-03 | Payment webhook processed exactly once | `WebhookLog.razorpayPaymentId @unique` — duplicate returns `200` without reprocessing. |
| INV-04 | BUYER cannot access seller-only routes | `requireRole(req, Role.SELLER)` reads `x-user-roles` header set by `middleware.ts`. Returns `403`. |
| INV-05 | User sees only their own orders | `getUser(req)` reads `x-user-id` set by `middleware.ts`. Order query filters by `buyerId` or `sellerId`. Admins exempt. |
| INV-06 | Delivery OTP cleared after verification | `deliveryOtp` set to `null` on COMPLETED. Never stored beyond use. |
| INV-07 | Phone number is the unique user identifier | `phone @unique` enforced at DB level. Silent signup — duplicate phone always returns `201` (enumeration prevention). |
| INV-08 | Seller store name + address must be unique | `@@unique([storeName, street])` enforced at DB level. |
| INV-09 | Deal price reverts to original after expiry | Vercel Cron sets `Deal.status = EXPIRED` after `Deal.expiresAt`. Product response reads active deal via JOIN — expired deal returns no discount. |
| INV-10 | Order total must be >= ₹1000 | `orderService` checks against `PlatformConfig.minOrderAmount` before creating Razorpay advance. |
| INV-11 | Order cannot confirm without captured advance | Only `payment.captured` webhook triggers `PENDING → CONFIRMED`. No manual endpoint. |
| INV-12 | Order cannot complete without full payment AND OTP | State machine requires `READY_FOR_OTP_VERIFICATION` before verify-otp is callable. |
| INV-13 | Refund calculated server-side only | `cancelOrderService` computes from `SubOrder.pickupDeadline`. Client never sends `refundAmount`. Tiers: 24h+ → 100%, 2–24h → 50%, <2h → 0%. |
| INV-14 | Seller cannot see own products in buyer feed | PostGIS raw query adds `AND p."sellerId" != $userId` when `x-user-id` header is present. Anonymous = no exclusion. |
| INV-15 | Review only allowed after COMPLETED SubOrder | `reviewService` verifies `subOrder.status === COMPLETED` and `subOrder.order.buyerId === req.user.id`. |
| INV-16 | One review per order per product | `Review.@@unique([subOrderId, productId])` enforced at DB level. Reviews link to SubOrder (per-seller transaction), not parent Order. |
| INV-17 | Bank details masked in all responses | `accountNumber` truncated to last 4 digits. Raw value never leaves server. |
| INV-18 | Client never sends status transitions | No endpoint accepts `status` in request body. State changes only via service layer and webhooks. |
| INV-19 | Cart checkout reads from server state only | `POST /api/cart/checkout` takes no body. Server reads CartSession from DB. Client cannot inject items. |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router) | Single deployment — frontend + API routes + cron |
| Language | TypeScript strict | Catch schema/type mismatches at compile time |
| Database | PostgreSQL 16 via Neon + PostGIS | GIST index on `geography` column for radius search. `pg_trgm` GIN index for product search. Zero-cost serverless. |
| ORM | Prisma | Type-safe queries, migration history, `$transaction()` |
| Cache | Upstash Redis | HTTP-based, serverless-compatible, sliding window rate limiting |
| Auth | Phone + PIN · Argon2 · HttpOnly Cookies | Enumeration-safe silent signup. Token family theft detection. No localStorage. |
| Payments | Razorpay | Advance + payment links + webhook idempotency |
| Images | Cloudinary | Signed uploads, auto-compression, blurHash placeholders |
| i18n | next-intl | Hindi-first, English fallback |
| Validation | Zod | Schema-first — contract drives implementation |
| Logging | Pino + Sentry | Structured JSON logs, error tracking |
| Deploy | Vercel (hobby) | Zero cost, cron support, preview URLs |

**Total infrastructure cost: ₹0/month**

---

## Local Setup
```bash
# 1. Clone
git clone https://github.com/DevWithAbhishek/kridha.git
cd kridha

# 2. Install
npm install

# 3. Environment — copy and fill in values
cp .env.example .env

# 4. Start local DB and Redis
docker-compose up -d

# 5. Enable PostGIS (Docker PostgreSQL)
npx prisma migrate dev  # migration adds postgis + pg_trgm + GIST + GIN indexes
npx prisma db seed      # 3 Lucknow sellers, 10 products, 1 buyer, PlatformConfig

# 6. Start dev server
npm run dev
````

Open [http://localhost:3000](http://localhost:3000)

---

## Built By

**Abhishek** · NIT Allahabad '24 · Backend Engineer
Open to backend roles · Fully Available from 10th April 2026

## Connect with me

[![GitHub](https://img.shields.io/badge/GitHub-DevWithAbhishek-black?logo=github)](https://github.com/DevWithAbhishek)
[![Website](https://img.shields.io/badge/Website-codewithabhishek.in-green?logo=google-chrome)](https://www.codewithabhishek.in/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Abhishek%20Kumar-blue?logo=linkedin)](https://www.linkedin.com/in/abhishekkumar878/)

---