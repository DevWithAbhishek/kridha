# DESIGN.md — Kridha Architecture & Implementation Decisions

This document is the complete implementation guide for Kridha's backend. README.md summarises; this document justifies. Every engineering claim in README.md has its implementation explained here. Audience: CTO, Staff Engineer, Senior Backend Engineer, Engineering Manager, System Design Interviewer.

---

## Table of Contents

1. [Architectural Layers](#1-architectural-layers)
2. [Middleware — Security Boundary](#2-middleware--security-boundary)
3. [Service Layer — Business Logic Ownership](#3-service-layer--business-logic-ownership)
4. [Repository Pattern — Data Access Isolation](#4-repository-pattern--data-access-isolation)
5. [State Machine — Order Lifecycle](#5-state-machine--order-lifecycle)
6. [Order → SubOrder Decomposition](#6-order--suborder-decomposition)
7. [Concurrency Control — Pessimistic Locking](#7-concurrency-control--pessimistic-locking)
8. [Transactions — ACID Guarantees](#8-transactions--acid-guarantees)
9. [Cookie-Only Auth Architecture](#9-cookie-only-auth-architecture)
10. [Token Family Rotation](#10-token-family-rotation)
11. [Refresh Token Flow — Silent Refresh](#11-refresh-token-flow--silent-refresh)
12. [Idempotency — Webhook Processing](#12-idempotency--webhook-processing)
13. [Cache-Aside — Product Feed](#13-cache-aside--product-feed)
14. [Rate Limiting — Three Layers](#14-rate-limiting--three-layers)
15. [Spatial Discovery — PostGIS](#15-spatial-discovery--postgis)
16. [Error Handling — Typed Errors](#16-error-handling--typed-errors)
17. [Logging — Structured + Redacted](#17-logging--structured--redacted)
18. [Database Design — Indexes, Constraints, Schema](#18-database-design--indexes-constraints-schema)
19. [Infrastructure Resilience — Supabase Pooler Retry](#19-infrastructure-resilience--supabase-pooler-retry)
20. [Security — Complete Threat Model](#20-security--complete-threat-model)
21. [Performance — Query Optimisation & Connection Pooling](#21-performance--query-optimisation--connection-pooling)
22. [Testing — Strategy & Validation](#22-testing--strategy--validation)
23. [Key Technical Decisions](#23-key-technical-decisions)
24. [Scale Upgrade Path](#24-scale-upgrade-path)
25. [System Invariants](#25-system-invariants)
26. [Known Limitations](#26-known-limitations)

---

## 1. Architectural Layers

### Request Lifecycle

Every request in Kridha passes through a strict, non-negotiable layer sequence. No layer can be skipped. No handler accesses a lower layer that isn't its direct dependency.

```
Browser / Mobile
      │
      ▼ HTTPS
┌─────────────────────────────────────────────────┐
│  Next.js App Router (Vercel Serverless)          │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Middleware (proxy.ts)                       │ │
│  │  Rate limit → CSRF → JWT verify → Role check │ │
│  └────────────────────┬────────────────────────┘ │
│                        ▼                          │
│  ┌─────────────────────────────────────────────┐ │
│  │  Route Handler (thin)                        │ │
│  │  Parse request → call service → return JSON  │ │
│  └────────────────────┬────────────────────────┘ │
│                        ▼                          │
│  ┌─────────────────────────────────────────────┐ │
│  │  Service Layer                               │ │
│  │  Business rules, validation, orchestration   │ │
│  └────────────────────┬────────────────────────┘ │
│                        ▼                          │
│  ┌─────────────────────────────────────────────┐ │
│  │  Repository Layer                            │ │
│  │  Prisma queries — single domain per file     │ │
│  └────────────┬───────────────────┬────────────┘ │
└───────────────┼───────────────────┼──────────────┘
                ▼                   ▼
        PostgreSQL + PostGIS      Redis
```

**Webhook entry point (separate from user request path):**

```
Razorpay
    │
    ▼ POST /api/webhooks/razorpay
HMAC verify (timingSafeEqual)
    │
    ▼
Idempotency check (WebhookLog @unique)
    │
    ▼
$transaction [ webhookLog.create + subOrder.update + statusHistory.create ]
    │
    ▼
200 (always — even on invalid signature)
```

Webhooks never pass through the user auth middleware. They have their own verification path — HMAC signature rather than JWT. This prevents any accidental coupling between user session state and payment event processing.

### Dependency Direction

```
Route Handler
    → imports Service
          → imports Repository
                → imports Prisma
                      → Supabase Postgres

Route Handler never imports Repository.
Repository never imports Service.
Service never imports another Service's Repository.
```

This is enforced by convention. A lint rule can enforce it mechanically.

---

## 2. Middleware — Security Boundary

**Problem:** Security concerns (auth, rate limiting, CSRF, role enforcement) are cross-cutting. Without centralization they get copy-pasted into each route handler, diverge over time, and the first missed check is a vulnerability.

**Solution:** `src/middleware/proxy.ts` — all requests pass through before any route handler executes.

### Execution Order

```
Incoming request
      │
      ▼
1. Rate limit — Layer 1: per-IP (5/min auth, 60/min general)
      │
      ▼
2. Rate limit — Layer 2: per-account suffix (10/15min, defeats IP rotation)
      │
      ▼
3. Rate limit — Layer 3: global platform ceiling (500 auth req/min)
      │
      ▼
4. CSRF double-submit check (mutation routes only)
      │
      ▼
5. JWT extraction from HttpOnly cookie
      │
      ▼
6. JWT verification (HS256, algorithm whitelist)
      │
      ▼
7. Role enforcement (BUYER / SELLER / ADMIN boundary)
      │
      ▼
Route Handler
```

Order is non-negotiable. Rate limiting runs before JWT verification — a rate-limited request should not burn a JWT decode operation. CSRF runs before payload parsing — no business logic should execute on a forged request.

### Why Centralized Middleware

A route handler that includes its own auth check is a route handler that could accidentally ship without it. Centralized middleware makes the secure path the only path. The pattern mirrors what Express middleware achieves — but implemented in Next.js App Router's `middleware.ts` file which runs at the edge before any route handler.

### Public Routes

Routes explicitly excluded from JWT enforcement:
- `GET /api/products*` — product discovery is public
- `GET /api/reviews*` — reviews are public
- `POST /api/auth/login`, `POST /api/auth/register` — auth entry points
- `POST /api/webhooks/razorpay` — has its own HMAC verification

All other routes require a valid JWT.

---

## 3. Service Layer — Business Logic Ownership

**Problem:** If business logic lives in route handlers, it cannot be reused (e.g. by a cron job and a user request), cannot be tested without HTTP overhead, and diverges when multiple handlers touch the same domain.

**Solution:** Services own all business rules. Route handlers parse, delegate, and respond.

### Responsibilities

```
Route Handler           Service Layer              Repository
─────────────          ───────────────            ────────────
Parse request     →    Validate inputs     →      DB query
Validate types         Business rules             Return typed model
Call service      ←    Call repos
Return response        Compose result
                       Handle transactions
                       Throw typed errors
```

### What Lives in a Service

- Minimum order value enforcement (`PlatformConfig.minOrderValue`)
- Stock sufficiency check (advisory, before lock)
- Advance calculation (`calcAdvance(total, config)`)
- State machine validation (`validateTransition(from, to)`)
- Refund tier calculation (`calcRefundAmount(advance, deadline, cancelledBy)`)
- Notification creation (i18n resolved at creation time)
- Deal expiry check at read time

### What Does Not Live in a Service

- Prisma queries (repository layer only)
- HTTP request/response parsing (route handler only)
- Cookie manipulation (route handler only)
- Direct Redis access for caching (repository layer, via `withCache`)
- JWT verification (middleware only)

### Testing Implication

A service can be unit-tested by mocking its repository dependencies without starting an HTTP server. This is the primary reason for the separation.

---

## 4. Repository Pattern — Data Access Isolation

**Problem:** If `prisma` is imported anywhere, changing the ORM requires touching every file that uses it. Mocking DB calls in tests requires mocking `prisma` globally.

**Solution:** One repository file per domain. Services import repositories, never `prisma` directly.

### File Structure

```
src/repo/
  auth.repo.ts      — User, UserSession, RefreshToken
  product.repo.ts   — Product, PriceTier, Deal
  order.repo.ts     — Order, SubOrder, OrderItem, OrderStatusHistory
  seller.repo.ts    — SellerProfile, PickupWindow
  user.repo.ts      — User (buyer-facing reads)
  admin.repo.ts     — AdminUser, AdminAuditLog
```

### Layer Contract

```typescript
// product.repo.ts
export async function findNearby(filters: GeoFilters, excludeSellerId?: string) {
  return withRetry(() =>
    prisma.$queryRaw<ProductWithRelations[]>(buildNearbyQuery(filters, excludeSellerId))
  );
}

// product.service.ts
import * as productRepo from "@/repo/product.repo";

export async function getNearbyProducts(input: ...) {
  await releaseExpiredHolds(); // lazy expiry side-effect
  return productRepo.findNearby(input.filters, input.userId);
}
```

### Why Not Prisma Everywhere

Three reasons:

1. **Testability.** `vi.mock("@/repo/product.repo")` is clean and localised. `vi.mock("@/lib/prisma")` pollutes the entire test environment.
2. **Geography queries.** `prisma.$queryRaw` for PostGIS predicates is a sharp edge that shouldn't scatter across the codebase. One repository function wraps it cleanly.
3. **Retry logic.** `withRetry` for Supabase pooler errors belongs at the DB access layer, not in every service.

### Mocking in Tests

```typescript
// order.service.test.ts
import * as orderRepo from "@/repo/order.repo";
vi.spyOn(orderRepo, "createOrder").mockResolvedValue(mockOrder);
```

No Prisma client starts. No DB connection needed. Tests run in milliseconds.

---

## 5. State Machine — Order Lifecycle

**Problem:** Order status logic scattered across route handlers produces duplicate guards, inconsistent enforcement, and states that can be reached via unintended paths.

**Solution:** `src/lib/state-machine.ts` — the single source of truth for valid transitions. No handler writes `status` directly.

```typescript
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:                    ["CONFIRMED", "CANCELLED"],
  CONFIRMED:                  ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT:           ["READY_FOR_OTP_VERIFICATION"],
  READY_FOR_OTP_VERIFICATION: ["COMPLETED", "DISPUTED"],
  COMPLETED:                  [],
  CANCELLED:                  [],
  DISPUTED:                   [],
};

export function validateTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError("INVALID_TRANSITION", 409, { from, to, allowed });
  }
}
```

### State Diagram

```
                    ┌─────────┐
              ┌────►│ PENDING │────────────────────────────────┐
              │     └────┬────┘                                 │
              │          │ payment.captured webhook             │
              │          ▼                                      │
              │    ┌──────────┐                                 │
              │    │CONFIRMED │──────────────────────────────┐  │
              │    └────┬─────┘                              │  │
              │         │ seller requests payment link       │  │
              │         ▼                                    │  │
              │  ┌─────────────────┐                        │  │
              │  │AWAITING_PAYMENT │                        │  │
              │  └────────┬────────┘                        │  │
              │           │ payment_link.paid webhook        │  │
              │           ▼                                  ▼  ▼
              │  ┌──────────────────────────┐      ┌──────────────┐
              │  │READY_FOR_OTP_VERIFICATION│      │  CANCELLED   │◄─┐
              │  └──────────┬───────────────┘      └──────────────┘  │
              │             │ OTP verified                            │
              │    ┌────────┴────────┐             either party can  │
              │    │                 │             cancel from PENDING│
              │    ▼                 ▼             or CONFIRMED       │
              │ ┌───────────┐  ┌──────────┐                         │
              │ │ COMPLETED │  │ DISPUTED │                         │
              │ └───────────┘  └──────────┘                         │
              │  (terminal)     (terminal)                           │
              └─────────────────────────────────────────────────────┘
```

### Terminal State Protection

`COMPLETED`, `CANCELLED`, `DISPUTED` have empty edge arrays. `validateTransition` throws before any DB write. This is not enforced by a DB constraint — it is enforced by the fact that empty arrays produce an unconditional throw for any `to` value.

**Financial finality:** A `COMPLETED` SubOrder has a payout row and a Razorpay payment record. Re-transitioning creates split-brain between financial ledger and order record.

**Audit integrity:** `OrderStatusHistory` is append-only. A re-opened `CANCELLED` order produces a history contradicting the refund already issued.

### Anti-Pattern Avoided

```typescript
// ❌ Wrong — status logic in handler
if (subOrder.status !== "CONFIRMED") {
  throw new Error("Cannot request payment");
}
await prisma.subOrder.update({ data: { status: "AWAITING_PAYMENT" } });

// ✅ Correct — centralized validation
validateTransition(subOrder.status, "AWAITING_PAYMENT"); // throws if invalid
await orderRepo.updateSubOrderStatus(id, "AWAITING_PAYMENT");
```

---

## 6. Order → SubOrder Decomposition

**Problem:** A multi-seller checkout needs two things that conflict in a flat model: one atomic payment (buyer pays once), and independent per-seller fulfillment (Seller A cancelling must not block Seller B).

### Data Model

```
Order
  id
  buyerId
  totalAmount
  advanceAmount
  platformFee
  razorpayOrderId       ← payment reference
  cartSessionId
  createdAt
  (no status — derived from SubOrders)

SubOrder
  id
  orderId               ← FK to Order
  sellerId
  status                ← own state machine
  totalAmount
  advanceAmount
  remainingAmount
  platformFee
  pickupWindowId
  pickupDate
  pickupDeadline        ← stored, not computed (indexable)
  deliveryOtp
  paymentLinkId
  paymentLinkUrl
  razorpayPaymentId
  createdAt

OrderItem
  id
  subOrderId            ← FK to SubOrder (not Order)
  productId
  quantity
  unitPrice             ← locked at add-to-cart time
  totalPrice

OrderStatusHistory
  id
  subOrderId
  status
  createdAt
  note

Payment
  id
  subOrderId
  type                  ← ADVANCE | REMAINING
  status                ← PENDING | PAID | REFUNDED
  amount
  razorpayPaymentId     ← @unique

Refund
  id
  subOrderId
  amount
  status
  razorpayRefundId

Payout
  id
  subOrderId
  amount
  status
  razorpayPayoutId
```

### Why One Order

The buyer pays once. Razorpay creates one order. The advance covers all sellers simultaneously. Splitting the payment across multiple Razorpay orders would require multiple checkout flows, multiple Razorpay UIs, and complex partial-payment reconciliation if one fails.

### Why Many SubOrders

Each seller has:
- Independent pickup window and deadline
- Independent OTP for collection
- Independent payment link for remaining amount
- Independent payout calculation
- Independent cancellation (Seller A cancels → Seller A's SubOrder is CANCELLED, Seller B's continues)
- Independent status machine

A flat `Order` with seller-tagged line items cannot represent "Seller A's portion is COMPLETED, Seller B's is AWAITING_PAYMENT" without a JSONB column or a nullable field explosion.

### Rejected Alternatives

**JSONB sellers array:** `Order.sellers: [{sellerId, status, otp}]`
- Not indexable — `WHERE sellerId = ?` is a table scan with JSONB extraction
- State machine enforcement requires application-level guards on array elements
- Cron queries (`WHERE status = PENDING AND createdAt < cutoff`) must extract array elements

**Flat order with numbered seller columns:** `seller1Id`, `seller1Status`, `seller2Id`...
- Breaks at any seller count beyond the hardcoded maximum
- Schema migration required to support more sellers per order

### Stock Locking at Seller Granularity

Inside `prisma.$transaction()`, stock decrements are grouped by seller. Seller A's `SELECT FOR UPDATE` on Seller A's products does not block Seller B's concurrent checkout on Seller B's products. Per-seller parallelism, per-product serialisation.

### Order Status Derivation

`Order` has no `status` column. Status is derived:
```typescript
function deriveOrderStatus(subOrders: SubOrder[]): DerivedOrderStatus {
  if (subOrders.every(s => s.status === "COMPLETED")) return "COMPLETED";
  if (subOrders.every(s => s.status === "CANCELLED")) return "CANCELLED";
  if (subOrders.some(s => s.status === "DISPUTED")) return "DISPUTED";
  return "IN_PROGRESS";
}
```

At current scale this is computed on read. At higher scale, a Postgres trigger maintaining a denormalized `Order.derivedStatus` column would be appropriate.

---

## 7. Concurrency Control — Pessimistic Locking

**Problem:** Two buyers simultaneously checkout the last 1 unit of a SKU. Both read `available = 1`. Both attempt decrement. Without a lock, both succeed — `available` goes to `−1`.

### Why Pessimistic Locking Over Optimistic

**Optimistic locking** uses a `version: Int` column:
```sql
UPDATE "Product"
SET available = available - $qty, version = version + 1
WHERE id = $id AND version = $expectedVersion;
```
If another transaction already incremented `version`, this update affects 0 rows. The application detects this and retries the entire transaction.

**The retry storm problem:** Kridha's hot SKUs are genuinely hot. A mill selling the last 50 kg of Mustard Oil at market close may have 20 buyers simultaneously. Under optimistic locking:
- Round 1: 19 of 20 fail version check → retry
- Round 2: 18 of 19 fail → retry
- Round 3: exponential degradation of tail latency

**Pessimistic locking** (`SELECT FOR UPDATE`) serialises at the DB layer:
- Transaction 1 acquires row lock → decrements → commits
- Transactions 2–20 queue behind the lock
- Each reads the updated `available` in sequence
- First N (where N ≤ available) succeed; rest get clean `409 INSUFFICIENT_STOCK`

Deterministic, no retries, bounded latency.

### Implementation

```typescript
// src/services/order.service.ts
await prisma.$transaction(async (tx) => {
  // Lock the product row before reading available
  const [product] = await tx.$queryRaw<Product[]>`
    SELECT id, available, "minOrderQuantity"
    FROM "Product"
    WHERE id = ${productId}
    FOR UPDATE
  `;

  if (!product) throw ERR.PRODUCT_NOT_FOUND();
  if (product.available < quantity) throw ERR.INSUFFICIENT_STOCK({ available: product.available });

  // Decrement — lock held until COMMIT
  await tx.product.update({
    where: { id: productId },
    data: { available: { decrement: quantity } },
  });

  // All other writes in same transaction
  const subOrder = await tx.subOrder.create({ ... });
  await tx.orderItem.createMany({ ... });
  await tx.orderStatusHistory.create({ ... });

}, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
```

### Advisory vs Hard Check

```
cartService.addItem(productId, quantity)
  │
  ├── Advisory check: product.available >= quantity ?
  │   └── If no → throw INSUFFICIENT_STOCK immediately
  │       (skips transaction overhead for obvious failures)
  │
  ▼ (only if advisory passes)
orderService.createFromCart()
  │
  └── Hard check: SELECT FOR UPDATE → read available → compare
      └── The only correctness guarantee. Advisory is performance only.
```

### Deadlock Prevention

Deadlocks occur when Transaction A locks Row 1 then Row 2, while Transaction B locks Row 2 then Row 1. For multi-product orders:

```typescript
// Always lock products in consistent order (by productId)
const sortedItems = items.sort((a, b) => a.productId.localeCompare(b.productId));
for (const item of sortedItems) {
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${item.productId} FOR UPDATE`;
}
```

Consistent lock ordering eliminates the circular dependency that causes deadlocks. Postgres detects and resolves deadlocks when they occur by killing one transaction with a deadlock error (`P2034`). The service wraps this as `INTERNAL_ERROR`.

### Isolation Level

`ReadCommitted` (Postgres default): a transaction sees only committed data from other transactions. Combined with `SELECT FOR UPDATE`, this gives the correct behavior:
- Transaction 1 commits `available = 0`
- Transaction 2's `FOR UPDATE` waits, then reads `available = 0` (not the stale pre-commit value)

Repeatable Read is not needed here — `FOR UPDATE` provides the locking guarantee independently.

### DB Safety Net

```sql
ALTER TABLE "Product" ADD CONSTRAINT "check_available_non_negative"
CHECK (available >= 0);
```

This is a secondary guard. It catches any bug that bypasses the application-level lock check. It should never be the first line of defence — but it guarantees that even a buggy code path cannot silently corrupt inventory.

---

## 8. Transactions — ACID Guarantees

### What Prisma `$transaction` Provides

```typescript
await prisma.$transaction(async (tx) => {
  // Everything here commits together or rolls back together
  // tx is a scoped Prisma client — use it for all DB calls inside
});
```

**Atomicity:** all writes commit or none do. A crash mid-transaction leaves no partial state.
**Consistency:** DB constraints (CHECK, UNIQUE, FK) are evaluated at commit time.
**Isolation:** `READ COMMITTED` by default. Concurrent transactions see committed state only.
**Durability:** committed data survives crashes (Supabase/WAL).

### When Transactions Are Used

1. **Order creation:** stock decrement + Order + SubOrder + OrderItems + OrderStatusHistory in one transaction. All succeed or none do.
2. **Webhook processing:** WebhookLog insert + SubOrder status update + OrderStatusHistory in one transaction. Idempotency key (`@unique`) enforced atomically.
3. **OTP verification:** SubOrder status update + OTP clearance (`deliveryOtp = null`) in one transaction.
4. **Cancellation with refund:** SubOrder update + Refund create + stock restore in one transaction.

### Compensating Transactions

Distributed systems cannot have true rollback across service boundaries. When Razorpay is called after a Postgres commit, failure requires a compensating transaction:

```
1. prisma.$transaction commits:
   - stock decremented
   - Order created
   - SubOrder created (PENDING)

2. Razorpay order creation fails (network error / rate limit)

3. Compensating transaction:
   - SubOrder.status = CANCELLED
   - Product.available += quantity (restore stock)
   - OrderStatusHistory entry

4. If compensating transaction also fails:
   - logger.error with COMPENSATION_FAILED + full context
   - Manual intervention required
   - SubOrder.status remains PENDING → lazy expiry will clean up in ≤15 min
```

The compensating transaction is not a rollback — it is a forward correction. The original transaction's effects are real and committed. The compensation creates new DB state that cancels the business effect.

### Nested Writes

Prisma's `$transaction` does not support nested transactions (savepoints are not exposed). The pattern for nested operations is to pass `tx` down the call stack:

```typescript
await prisma.$transaction(async (tx) => {
  await orderRepo.createOrder(tx, orderData);        // tx passed in
  await orderRepo.createSubOrders(tx, subOrderData); // same tx
});
```

Repository functions accept an optional `tx` parameter. When present, they use `tx` instead of `prisma`. When absent, they use `prisma` directly (for non-transactional reads).

---

## 9. Cookie-Only Auth Architecture

**No Authorization header. No localStorage. No JWT in response body.**

```
Cookie             │ HttpOnly │ Path            │ MaxAge │ Purpose
───────────────────┼──────────┼─────────────────┼────────┼──────────────────────────────────
kridha_access      │ YES      │ /               │ 15 min │ JWT — route handlers verify
kridha_refresh     │ YES      │ /api/auth       │ 7 days │ Rotation chain — hash in DB
kridha_lang        │ NO       │ /               │ 1 year │ "hi" | "en" — next-intl reads
kridha_access_exp  │ NO       │ /               │ 15 min │ Unix timestamp — proactive refresh
```

### Why HttpOnly Cookies

**XSS resistance.** A client-rendered Next.js app has real XSS exposure. Any JavaScript-readable token (`localStorage`, non-HttpOnly cookie, response body) is exfiltrable by a malicious script in any dependency. HttpOnly cookies are inaccessible to JavaScript — `document.cookie` does not include them.

**Shared device context.** UP Tier-2 buyers frequently use shared Android devices in shop environments. Multiple users share the same browser. An `localStorage` token from a previous session leaks to the next user of the device.

**Rejected alternatives:**
- `localStorage + Authorization header` — directly exfiltrable via XSS; rejected
- In-memory storage (module-level variable) — lost on page refresh, forces re-login at supplier counter; rejected
- `sessionStorage` — cleared on tab close, same XSS exposure; rejected

### CSRF Mitigation

HttpOnly cookies are sent automatically by the browser on any same-origin request — and also on cross-origin requests satisfying `SameSite: Lax` (GET navigation). Mutation endpoints require CSRF protection.

**Double-submit pattern:**
```
1. On login: server sets kridha_csrf (non-HttpOnly, readable by JS)
2. Client reads cookie, attaches as X-CSRF-Token header on mutations
3. Middleware validates: header value === cookie value
4. An attacker's forged cross-site request cannot read the non-HttpOnly cookie
   → header is missing → middleware rejects
```

### Path Scoping

`kridha_refresh` has `path=/api/auth`. The browser never sends this cookie to `/api/products`, `/api/orders`, or any other endpoint. A vulnerability in the product search endpoint cannot expose the refresh token — the browser would not have included it in the request.

### Admin Separation

```
kridha_admin      │ HttpOnly │ path=/api/admin │ JWT signed with ADMIN_JWT_SECRET
```

Admin tokens use a separate signing secret. A compromised user JWT cannot be replayed against admin endpoints. Admin payload carries `type: "admin"` — middleware rejects any JWT without this claim at admin routes, even if the signing key were accidentally identical.

---

## 10. Token Family Rotation

**Problem:** Simple refresh token rotation (issue new, invalidate old) fails silently when a token is stolen. The attacker uses the token first; the legitimate user's next attempt fails and they assume a session expiry. Theft is undetected.

**Solution:** Token family rotation adds reuse detection. A rotated token presented again is evidence of theft and triggers full family revocation.

### Schema

```typescript
// Prisma schema
model UserSession {
  id            String    @id @default(cuid())
  userId        String
  familyId      String    // groups all tokens in one refresh chain
  tokenHash     String    // SHA-256 of current valid refresh token
  parentHash    String?   // SHA-256 of previous token (for reuse detection)
  ipAddress     String?
  userAgent     String?
  lastSeenIp    String?
  lastSeenAt    DateTime?
  expiresAt     DateTime
  revokedAt     DateTime? // null = active, set = revoked
  createdAt     DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([familyId])
}
```

### Token Issuance

```typescript
// On login or first token issue
const familyId = crypto.randomUUID();
const refreshToken = crypto.randomBytes(32).toString("hex");
const tokenHash = sha256(refreshToken);

await prisma.userSession.create({
  data: {
    userId,
    familyId,
    tokenHash,
    parentHash: null,  // first token has no parent
    expiresAt: addDays(new Date(), 7),
  },
});
```

### Rotation on Use

```
POST /api/auth/refresh
  │
  ├── 1. Decode refresh token from kridha_refresh cookie
  ├── 2. SHA-256 hash the token
  ├── 3. SELECT UserSession WHERE tokenHash = $hash AND revokedAt IS NULL
  │
  ├── ✅ Found (legitimate use):
  │     a. Generate new refresh token
  │     b. Update UserSession: tokenHash = newHash, parentHash = oldHash
  │     c. Issue new access token (15 min)
  │     d. Set new kridha_refresh cookie
  │     e. Return 200
  │
  └── ❌ Not found — check if it's a rotated token:
        SELECT UserSession WHERE parentHash = $hash
        │
        ├── Found: THIS IS REUSE OF A ROTATED TOKEN
        │     a. SELECT all sessions WHERE familyId = session.familyId
        │     b. UPDATE all: revokedAt = NOW()
        │     c. logger.fatal({ event: "TOKEN_THEFT_DETECTED", userId, familyId })
        │     d. Return 401
        │
        └── Not found: token is unknown (expired, manually cleared, etc.)
              Return 401
```

### Stolen Token Scenario

```
T=0: User logs in → RefreshToken A issued (familyId: xyz)
T=1: Attacker steals RefreshToken A (XSS, interception, etc.)
T=2: Attacker uses RefreshToken A → RefreshToken B issued, A's hash becomes parentHash
T=3: User tries to use RefreshToken A (their copy)
     → A's hash not found as current tokenHash
     → A's hash found as parentHash of B's session
     → Theft detected: entire family xyz revoked
     → User and attacker both logged out
     → Fatal alert fired
```

### Why Family Rotation Over Simple Rotation

Simple rotation: `tokenHash` replaced on use, old token rejected.
- Legitimate double-send (network retry) logs out the user
- Theft only detected if user happens to refresh after attacker did
- No alert fired

Family rotation: reuse of any already-rotated token revokes the entire chain.
- Theft detected the moment the legitimate user next refreshes
- Alert fired immediately
- Attacker loses access

### Client-Side Deduplication

A slow network causes the client to send the same refresh request twice before receiving a response. Without client-side deduplication, the second request carries the already-rotated token and triggers theft detection — a false positive.

See §11 for the client-side refresh lock that prevents this.

---

## 11. Refresh Token Flow — Silent Refresh

**Problem:** Access tokens expire every 15 minutes. A user browsing the app should never see a login redirect due to expiry. Concurrent requests during a refresh should not all attempt their own refresh simultaneously.

### Token Expiry Detection

`kridha_access_exp` is a non-HttpOnly cookie containing the access token's Unix expiry timestamp. The Axios request interceptor reads this before each request:

```typescript
// src/lib/api.ts
axiosInstance.interceptors.request.use(async (config) => {
  const expiry = getCookie("kridha_access_exp");
  const expiresAt = expiry ? parseInt(expiry, 10) * 1000 : 0;
  const needsRefresh = Date.now() > expiresAt - 60_000; // 60s buffer

  if (needsRefresh) {
    await refreshTokens(); // see below
  }

  return config;
});
```

### Refresh Lock — Race Condition Prevention

Without a lock, multiple concurrent requests all detect expiry simultaneously and all attempt a refresh. The second refresh arrives with the already-rotated token and triggers false theft detection.

```typescript
// src/lib/api.ts
let isRefreshing = false;
let refreshQueue: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

async function refreshTokens(): Promise<void> {
  if (isRefreshing) {
    // Another refresh is already in flight — queue this caller
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    // Use a clean Axios instance with NO interceptors
    // to prevent recursive refresh loops
    await refreshClient.post("/api/auth/refresh");

    // Drain queue — all waiting callers can now proceed
    refreshQueue.forEach(q => q.resolve());
  } catch (err) {
    // Refresh failed — reject all queued callers
    refreshQueue.forEach(q => q.reject(err as Error));
    throw err;
  } finally {
    isRefreshing = false;
    refreshQueue = [];
  }
}
```

### Why a Clean Axios Instance for Refresh

`refreshClient` is a separate `axios.create()` instance with no interceptors attached:

```typescript
const refreshClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
});
// No interceptors — intentional
```

If the main `axiosInstance` were used for the refresh call:
1. Refresh request fires
2. Interceptor checks expiry again
3. Token still expired (refresh hasn't returned yet)
4. Interceptor calls `refreshTokens()` again
5. Infinite recursion / `isRefreshing` lock saves it but wastes a request

The clean client bypasses the interceptor entirely.

### Response Interceptor — 401 Handling

```typescript
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retried) {
      error.config._retried = true;

      try {
        await refreshTokens();
        // Replay the original failed request with new tokens
        return axiosInstance(error.config);
      } catch {
        // Refresh failed — redirect to login
        window.location.href = `/auth/login?redirect=${window.location.pathname}`;
      }
    }
    return Promise.reject(error);
  }
);
```

`_retried` flag prevents infinite retry if the replayed request also 401s (e.g. resource genuinely not authorized for this user).

### Multiple Tabs

Each browser tab runs its own JavaScript context with its own `isRefreshing` flag. Two tabs can simultaneously attempt refresh. The second refresh arrives with the rotated token:
- The server detects reuse → revokes the family → returns 401
- Both tabs redirect to login

This is correct behavior — a simultaneously refreshing second tab is indistinguishable from token theft at the server. The tradeoff (rare double-logout) is accepted over the alternative of server-side coordination complexity.

---

## 12. Idempotency — Webhook Processing

**Problem:** Razorpay retries webhook delivery on any non-200 response, and occasionally redelivers even after a 200 acknowledgment (failover, retry races). The same `payment.captured` event delivered 100 times must produce exactly one DB write.

### Why Application-Level Checks Are Insufficient

```typescript
// ❌ Wrong — race condition between check and insert
const existing = await prisma.webhookLog.findFirst({
  where: { razorpayPaymentId: paymentId }
});
if (existing) return res.status(200).json({ received: true }); // duplicate
await prisma.webhookLog.create({ data: { razorpayPaymentId: paymentId } });
// ← Two concurrent requests both pass the findFirst check and both reach here
```

The gap between `findFirst` and `create` is a race window. Two concurrent identical webhook deliveries both pass the check and both proceed to create — producing two Payment rows, two SubOrder transitions, two notifications.

### DB-Level Idempotency

```typescript
// WebhookLog schema
model WebhookLog {
  id                  String   @id @default(cuid())
  razorpayPaymentId   String   @unique  // ← the atomic guard
  event               String
  processedAt         DateTime @default(now())
}
```

```typescript
// Handler
try {
  await prisma.$transaction([
    prisma.webhookLog.create({
      data: { razorpayPaymentId, event }
      // If this is a duplicate, the @unique constraint throws P2002
      // The entire transaction rolls back — no Payment row, no state transition
    }),
    prisma.payment.update({ ... }),
    prisma.subOrder.update({ data: { status: "CONFIRMED" } }),
    prisma.orderStatusHistory.create({ ... }),
  ]);
} catch (err) {
  if (isPrismaUniqueViolation(err)) {
    // Duplicate delivery — already processed, nothing to do
    return res.status(200).json({ received: true });
  }
  throw err; // re-throw unexpected errors
}
```

Concurrent duplicate deliveries race at the Postgres level. Exactly one `INSERT INTO WebhookLog` wins; all others fail the `@unique` constraint. The transaction for losers rolls back entirely. The Payment update and SubOrder transition execute exactly once.

### Sequence Diagram

```
Razorpay ──► POST /api/webhooks/razorpay (delivery 1)
Razorpay ──► POST /api/webhooks/razorpay (delivery 2, concurrent)
                    │                    │
                    ▼                    ▼
             HMAC verify           HMAC verify
                    │                    │
                    ▼                    ▼
       $transaction starts      $transaction starts
       WebhookLog.create()      WebhookLog.create()
                    │                    │
                    ▼                    ▼
         INSERT succeeds       INSERT fails (P2002 @unique)
                    │                    │
                    ▼                    ▼
       Payment.update()         Transaction rolls back
       SubOrder → CONFIRMED               │
       StatusHistory.create()             │
       Transaction commits               ▼
                    │           catch P2002 → 200 { received: true }
                    ▼
          200 { received: true }
```

### Why Always Return 200

Razorpay retries on any non-200 response. Returning 400 for invalid signatures or 500 for processing errors triggers exponential backoff retries — flooding logs, burning webhook quota, and potentially triggering Razorpay's retry exhaustion behavior (which may disable webhook delivery for the account).

Always returning 200 signals "received and handled." What the handler did with the event is internal. Invalid signatures are logged and silently discarded.

### HMAC Verification

```typescript
import { createHmac, timingSafeEqual } from "crypto";

function verifyWebhookSignature(body: string, signature: string): boolean {
  const expected = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  // timingSafeEqual prevents timing attacks that leak signature bytes
  // by measuring response time at each character mismatch
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex"),
  );
}
```

Standard string comparison short-circuits at the first mismatched byte. An attacker submitting requests with incrementally correct signatures can measure response time to recover the full expected signature. `timingSafeEqual` compares all bytes in constant time regardless of where the mismatch occurs.

---

## 13. Cache-Aside — Product Feed

**Problem:** `productRepo.findNearby` runs a PostGIS radius query with 5-table joins. At steady state, most product feed requests have identical or near-identical parameters (same city, same radius, same page). Running the full query for every request is wasteful.

### Pattern

```
Request arrives
      │
      ▼
      cacheGet(key)
      │
      ├── HIT → return cached JSON
      │
      └── MISS → run DB query
                  │
                  ▼
                  cacheSet(key, result, TTL)  ← fire-and-forget
                  │
                  ▼
                  return result
```

```typescript
// Cache key
const key = `products:${roundTo3dp(lat)}:${roundTo3dp(lng)}:${radius}:${category}:${sortBy}:${page}`;
```

### Why Lat/Lng Rounded to 3 Decimal Places

3dp ≈ 111m precision. Buyers within 111m of each other share a cache entry. Without rounding, two buyers 5m apart with GPS noise in the 5th–6th decimal place generate different cache keys and each trigger a PostGIS query.

At Gorakhpur scale (city radius ~15 km), the effective cache key space at 3dp is bounded and manageable. At 4dp it fragments too finely; at 2dp it conflates distinct search areas.

### TTL Design

```
Key type                    TTL      Rationale
────────────────────────── ──────── ───────────────────────────────────────
products:{geo}:{filters}   60s      Matches TanStack Query staleTime on client
product:{id}               300s     Product detail changes infrequently
deals:{geo}                120s     Deals expire on a cron schedule
seller:{userId}            600s     Seller profiles rarely change
notifications:{userId}     30s      Notifications need near-real-time freshness
platform-config            3600s    Manual invalidation only
```

### Invalidation

```typescript
// On product create / PATCH / DELETE
async function invalidateProductCache(productId: string, sellerId: string) {
  await cacheDelete(`product:${productId}`);
  // Pattern-delete all listing keys
  // Note: SCAN + DEL is O(n) in key count — see Known Limitations
  await cacheDeletePattern(`products:*`);
}
```

Invalidation is write-through — every product mutation invalidates relevant cache entries. The listing key pattern-delete is broad (any product change invalidates all listing caches) because the product may appear in many different geographic/filter combinations.

### Cache Stampede

**Problem:** A cache TTL expires while 100 concurrent requests all miss and all fire the PostGIS query simultaneously — pool exhaustion.

**Current state:** Not yet mitigated. This is a known gap (see §26).

**Mitigation (planned):**
```typescript
async function withCache<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached) return cached;

  // Short-lived lock prevents stampede
  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, "1", { NX: true, EX: 2 });

  if (!acquired) {
    // Another request is populating — wait briefly and retry
    await sleep(100);
    return withCache(key, ttl, fn); // retry will likely hit cache
  }

  try {
    const result = await fn();
    await cacheSet(key, result, ttl);
    return result;
  } finally {
    await redis.del(lockKey);
  }
}
```

### Fail-Open

All cache operations swallow errors:
```typescript
async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    logger.warn({ event: "cache_miss_on_error", key });
    return null; // fall through to DB
  }
}
```

A Redis outage degrades to direct DB queries. Correctness is unaffected. Rate limiting uses a different failure mode — see §14.

### Distinction from Rate-Limit State

Redis caching (§13): fail-open. Redis outage means more DB reads.
Redis rate limiting (§14): fail-closed. Redis outage means requests blocked.

These are the same Redis instance but with opposite failure modes by design.

---

## 14. Rate Limiting — Three Layers

**Problem:** Per-IP limiting is the standard approach but defeated by a botnet rotating 1000 IPs. After authentication, per-account limiting is needed. Global platform limits prevent DDoS on auth endpoints specifically.

### Three Layers

```
Layer 1: Per-IP sliding window
  Key:     ratelimit:ip:{hashedIP}
  Limit:   5 attempts/min (auth routes), 60/min (general)
  Defeats: Single-source brute force
  Bypass:  IP rotation (defeated by Layer 2)

Layer 2: Per-account sliding window
  Key:     ratelimit:account:{last6digitsOfPhone}
  Limit:   10 attempts / 15 min
  Defeats: IP-rotating credential stuffing
  Why last 6 digits: consistent per-account key regardless of which IP the attacker uses

Layer 3: Global platform ceiling
  Key:     ratelimit:global:auth
  Limit:   500 auth req/min platform-wide
  Defeats: Distributed DDoS against auth endpoint specifically
```

### Sliding Window Algorithm

```typescript
// Using @upstash/ratelimit with Redis sorted sets
// Window: 60s, limit: 5

async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowMs;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);   // remove expired entries
  pipeline.zadd(key, now, `${now}-${Math.random()}`); // add current request
  pipeline.zcard(key);                               // count in window
  pipeline.expire(key, Math.ceil(windowMs / 1000)); // TTL cleanup

  const results = await pipeline.exec();
  const count = results[2] as number;

  return count <= limit; // true = allowed
}
```

### Why Fail Closed

```typescript
async function rateLimit(key: string, limit: number, window: number): Promise<void> {
  try {
    const allowed = await checkRateLimit(key, limit, window);
    if (!allowed) throw new AppError("RATE_LIMITED", 429);
  } catch (err) {
    if (err instanceof AppError) throw err; // re-throw rate limit errors

    // Redis unavailable — fail closed
    logger.error({ event: "rate_limit_redis_error", key });
    throw new AppError("RATE_LIMITED", 429, { reason: "rate_limit_unavailable" });
  }
}
```

**Original behavior (incorrect):** Redis error → catch swallowed → request passes through. During a Redis outage, rate limiting was silently disabled — the worst possible time, since an infrastructure failure is when an attacker would attempt to exploit the gap.

**Corrected behavior:** Redis error → treat as "cannot verify limit" → block request. A Redis outage now degrades auth availability, not security posture.

---

## 15. Spatial Discovery — PostGIS

**Problem:** `WHERE ABS(latitude - $lat) < delta` is not indexable and geometrically inaccurate at India's latitudes. 1° longitude in Gorakhpur ≈ 99km, but 1° in Srinagar ≈ 92km. Fixed deltas produce elliptical, not circular, search areas.

### Why PostGIS Geography (Not Geometry)

```sql
-- geometry: flat 2D Euclidean plane — correct only for small areas
-- geography: WGS-84 ellipsoid — geodesic distances, correct globally

ALTER TABLE "Product"
  ADD COLUMN location geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  ) STORED;
```

`geography` computes true geodesic distance in metres. `ST_DWithin(location, target, 5000)` returns all rows within exactly 5km, accounting for Earth's curvature. At India-scale distances (up to ~50km radius), the error from using flat `geometry` is ~0.2% — small but nonzero.

### GIST Index

```sql
CREATE INDEX "Product_location_gist" ON "Product" USING GIST (location);
```

B-Tree indexes are 1D. Geographic points are 2D. GIST (Generalised Search Tree) builds an R-Tree of bounding boxes. For a radius query:
1. Intersect query circle's bounding box with GIST pages (cheap — eliminates most of the table)
2. Check remaining candidates with exact `ST_DWithin` predicate

Without the GIST index: O(n) table scan for every product feed request. With it: O(log n) index lookup + O(k) candidate checks.

### KNN Sort

```sql
ORDER BY
  location <-> ST_MakePoint($lng, $lat)::geography ASC
```

`<->` is the KNN (K-Nearest-Neighbour) distance operator. It uses the GIST index to return results in distance order **without computing distance for every row**. The index traversal provides approximate ordering; exact distances are computed only for the result set. This is significantly faster than `ORDER BY ST_Distance(location, target) ASC` which computes exact distances for every row that passes the `WHERE` filter.

### Why `$queryRaw` Instead of Prisma ORM

Prisma cannot construct `ST_DWithin` predicates for `Unsupported("geography(Point, 4326)")` columns. The geography type is not a Prisma-native type — it appears as `Unsupported()` in the schema and cannot be used in `prisma.product.findMany({ where: { ... } })` with spatial predicates.

```typescript
// src/lib/postgis.ts
export function buildNearbyQuery(f: GeoFilters, excludeSellerId?: string) {
  const geoFilter = Prisma.sql`
    AND ST_DWithin(
      COALESCE(
        p."location",
        ST_SetSRID(ST_MakePoint(p."longitude", p."latitude"), 4326)::geography
      ),
      ST_MakePoint(${f.lng}, ${f.lat})::geography,
      ${f.radiusM}
    )`;

  const excludeClause = excludeSellerId
    ? Prisma.sql`AND p."sellerId" != ${excludeSellerId}`
    : Prisma.empty;

  return Prisma.sql`
    SELECT p.*, ST_Distance(
      p.location, ST_MakePoint(${f.lng}, ${f.lat})::geography
    ) / 1000.0 AS distance_km
    FROM "Product" p
    WHERE p."productStatus" = 'ACTIVE'
      AND p."deletedAt" IS NULL
      ${geoFilter}
      ${excludeClause}
    ORDER BY
      p.location <-> ST_MakePoint(${f.lng}, ${f.lat})::geography ASC
    LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}
  `;
}
```

All user inputs are Prisma.sql parameters — never string-interpolated. SQL injection is prevented at the library level.

### Generated Column Issue

The `GENERATED ALWAYS AS` column rejected inserts via Prisma's default ORM path during seeding:
- Prisma's `product.create()` includes `location` in the INSERT, which conflicts with `GENERATED ALWAYS`
- Fix: seed via raw SQL against `DIRECT_URL` (not pooled): `INSERT INTO "Product" (longitude, latitude, ...) VALUES ($1, $2, ...)` — the generated column populates automatically
- `COALESCE(p.location, ST_SetSRID(ST_MakePoint(...)))` in queries guards against rows where the generated column is NULL (inserted via the ORM path before the fix)

---

## 16. Error Handling — Typed Errors

**Problem:** Throwing strings (`throw "stock insufficient"`) produces non-parseable errors, inconsistent HTTP status codes, and no machine-readable error identification.

### AppError

```typescript
export class AppError extends Error {
  constructor(
    public code: string,       // machine-readable: "INSUFFICIENT_STOCK"
    public statusCode: number, // HTTP status: 409
    public meta?: object,      // context: { available: 3, requested: 10 }
  ) {
    super(code);
  }
}
```

### Error Factory

```typescript
// src/lib/errors.ts
export const ERR = {
  INSUFFICIENT_STOCK: (meta?: { available: number; requested: number }) =>
    new AppError("INSUFFICIENT_STOCK", 409, meta),

  INVALID_TRANSITION: (meta?: { from: string; to: string }) =>
    new AppError("INVALID_TRANSITION", 409, meta),

  PRODUCT_NOT_FOUND: () => new AppError("PRODUCT_NOT_FOUND", 404),

  RATE_LIMITED: (meta?: object) =>
    new AppError("RATE_LIMITED", 429, meta),

  // ... 39 total error codes
};
```

### Global Handler

```typescript
// src/lib/handle-error.ts
export function handleError(err: unknown, req: Request): Response {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, status: err.statusCode, meta: err.meta });
    return jsonResponse({ success: false, code: err.code, message: err.message, meta: err.meta }, err.statusCode);
  }

  if (err instanceof ZodError) {
    return jsonResponse({ success: false, code: "VALIDATION_ERROR", errors: err.flatten() }, 400);
  }

  // Unknown errors — log full stack, return generic 500
  logger.error({ err, event: "unhandled_error" });
  Sentry.captureException(err);
  return jsonResponse({ success: false, code: "INTERNAL_ERROR" }, 500);
}
```

### Response Envelope

Every endpoint returns:
```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "code": "INSUFFICIENT_STOCK", "message": "Not enough stock", "meta": { "available": 0 } }
```

The client checks `success`, then inspects `code` to determine UI behaviour. `code` is machine-readable and stable across versions. `message` is human-readable and may change.

---

## 17. Logging — Structured + Redacted

**Problem:** `console.log` produces unstructured strings — unsearchable, unfiltered, uncorrelatable across concurrent requests.

### Pino

```typescript
// src/lib/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "pin", "otp", "deliveryOtp", "refreshToken",
      "req.headers.cookie", "res.headers['set-cookie']",
      "accountNumber", "ifscCode", "panNumber",
      "razorpayKeySecret", "webhookSecret", "adminJwtSecret",
      "encryptionKey", "cloudinaryApiSecret", "cronSecret",
    ],
    censor: "[REDACTED]",
  },
});
```

### Request Correlation

```typescript
// src/lib/with-logger.ts
export function withLogger(handler: Handler, action: string): Handler {
  return async (req) => {
    const requestId = crypto.randomUUID();
    const start = Date.now();

    const childLogger = logger.child({ requestId, action });
    req.logger = childLogger;

    try {
      const res = await handler(req);
      childLogger.info({
        method: req.method,
        path: new URL(req.url).pathname,
        status: res.status,
        ms: Date.now() - start,
      });
      return res;
    } catch (err) {
      childLogger.error({ err, ms: Date.now() - start });
      throw err;
    }
  };
}
```

Every log line from a request carries the same `requestId`. A production incident is debugged by filtering `WHERE requestId = 'abc-123'` across all log lines — exact request path, timing, and any errors.

### Security Events

```typescript
// Specific security events fire at elevated severity
logger.fatal({ event: "TOKEN_THEFT_DETECTED", userId, familyId });       // token reuse
logger.warn({  event: "CREDENTIAL_STUFFING_SUSPECTED", ip, attempts });  // rate limit exceeded
logger.info({  event: "IP_CHANGE_ON_REFRESH", userId, from, to });       // session anomaly
```

GlitchTip receives `fatal` and `error` severity events via Sentry SDK (`@sentry/nextjs` pointed at GlitchTip DSN). Email alert fires on new error types.

### Redaction

Redaction happens before serialisation. The value never appears in the output buffer. 14 fields are redacted:
`pin`, `otp`, `deliveryOtp`, `refreshToken`, `Cookie header`, `Set-Cookie header`, `accountNumber`, `ifscCode`, `panNumber`, `razorpayKeySecret`, `webhookSecret`, `adminJwtSecret`, `encryptionKey`, `cloudinaryApiSecret`.

---

## 18. Database Design — Indexes, Constraints, Schema

### Key Constraints

```sql
-- Inventory floor — catches bugs that bypass the lock
ALTER TABLE "Product" ADD CONSTRAINT "check_available_non_negative"
  CHECK (available >= 0);

-- Webhook idempotency — atomic guard
ALTER TABLE "WebhookLog" ADD CONSTRAINT "webhooklog_payment_id_unique"
  UNIQUE ("razorpayPaymentId");

-- Review uniqueness — one review per order line
ALTER TABLE "Review" ADD CONSTRAINT "review_suborder_product_unique"
  UNIQUE ("subOrderId", "productId");

-- Store identity — store name + street uniquely identifies a seller location
ALTER TABLE "SellerProfile" ADD CONSTRAINT "seller_storename_street_unique"
  UNIQUE ("storeName", "street");
```

### Key Indexes

```sql
-- Spatial — primary index for all proximity queries
CREATE INDEX "Product_location_gist" ON "Product" USING GIST (location);

-- Text search — trigram acceleration for ILIKE product name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_nameEn_gin" ON "Product" USING GIN ("nameEn" gin_trgm_ops);
CREATE INDEX "Product_nameHi_gin" ON "Product" USING GIN ("nameHi" gin_trgm_ops);

-- Expiry cron — fast lookup for expired pending orders
CREATE INDEX "SubOrder_status_pickupDeadline" ON "SubOrder" ("status", "pickupDeadline")
  WHERE status = 'PENDING';  -- partial index, only indexes relevant rows

-- Seller's order inbox — sellers querying their incoming orders
CREATE INDEX "SubOrder_sellerId_status" ON "SubOrder" ("sellerId", "status");

-- Buyer's order history
CREATE INDEX "Order_buyerId_createdAt" ON "Order" ("buyerId", "createdAt" DESC);

-- Token lookup — hot path on every auth refresh
CREATE INDEX "UserSession_tokenHash" ON "UserSession" ("tokenHash")
  WHERE "revokedAt" IS NULL;  -- partial index, active sessions only

-- Family revocation
CREATE INDEX "UserSession_familyId" ON "UserSession" ("familyId");
```

### Why Partial Indexes

The expiry cron query: `WHERE status = 'PENDING' AND pickupDeadline < NOW()`. Over time, the vast majority of SubOrders are CONFIRMED, COMPLETED, or CANCELLED. A full index on `(status, pickupDeadline)` grows with the entire table. A partial index `WHERE status = 'PENDING'` indexes only the relevant rows — stays small regardless of historical order volume.

Similarly, `UserSession WHERE revokedAt IS NULL` only indexes active sessions. Revoked sessions (the majority over time) are excluded.

### Foreign Key Enforcement

All FK relationships are enforced at the DB level, not only in Prisma schema. Prisma schema is the source of truth for generating migrations, but the actual constraints exist in Postgres and would reject inconsistent writes even if Prisma were bypassed.

### `pickupDeadline` — Stored, Not Computed

```typescript
// At order creation
const window = await pickupWindowRepo.findById(pickupWindowId);
const pickupDeadline = combineDateAndTime(pickupDate, window.endTime);
// stored as DateTime on SubOrder
```

`WHERE "pickupDeadline" < NOW()` with a B-Tree index is O(log n). A computed `pickupDate + window.endTime` in the query would be non-indexable — every row requires evaluation.

---

## 19. Infrastructure Resilience — Supabase Pooler Retry

### Connection Architecture

```
Application (Vercel) ──► DATABASE_URL (port 6543, pgBouncer pooled)
Migrations / Seed   ──► DIRECT_URL   (port 5432, direct Postgres)
```

pgBouncer in transaction-pooling mode: a connection from the application pool is returned to pgBouncer after each transaction, not held for the request duration. This multiplexes many application connections over fewer Postgres backend connections — efficient at scale, but surfaces as dropped connections under bursty load.

### Failure Modes

```
Failure type                                  Error message
────────────────────────────────────────────  ────────────────────────────────────
Free-tier pause resume (7 days inactive)       P1001 / ECONNREFUSED / non-101 status
pgBouncer connection recycled mid-request      Connection terminated unexpectedly
Pool exhausted under burst                     Timed out fetching a new connection
```

### `withRetry`

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 4,
  delayMs = 1500,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isTransient =
        err instanceof Error &&
        (err.message.includes("P1001") ||
          err.message.includes("Can't reach database") ||
          err.message.includes("Connection terminated") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("Timed out fetching") ||
          err.message.includes("network error"));

      if (!isTransient || attempt === retries) throw err;
      await sleep(delayMs * attempt); // linear: 1.5s, 3s, 4.5s, 6s
    }
  }
  throw new Error("unreachable");
}
```

**Linear, not exponential, backoff:** the bottleneck is Supabase's fixed resume time (~1–4s), not server load. Exponential backoff would add unnecessary latency once the instance is warm.

**`withRetry` is NOT used on `$transaction` calls with `SELECT FOR UPDATE`.** Retrying a transaction transparently would silently re-acquire a lock on a potentially different row state. Transactional mutations must handle their own retry at the service level where the business intent is known.

---

## 20. Security — Complete Threat Model

### XSS Prevention

**HttpOnly cookies** — access token inaccessible to JavaScript, even if an attacker injects a script.

**`safeString` Zod transform** — all string inputs sanitised at the validation layer:
```typescript
const safeString = z.string().transform(v => sanitizeHtml(v, { allowedTags: [] }));
```
User-controlled strings (product names, store descriptions, review comments) pass through `safeString`. Stored XSS requires both injection and rendering — `safeString` eliminates injection.

### CSRF Prevention

Double-submit cookie pattern. Non-HttpOnly `kridha_csrf` cookie set on login; `X-CSRF-Token` header required on all mutations. Cross-origin forged requests cannot read the cookie.

### Timing Attack Prevention

**Argon2 DUMMY_HASH:** On login with an unknown phone number, Argon2 verification still runs against a pre-computed dummy hash. Without this, the response time difference between "user not found" (fast, no hash) and "wrong PIN" (slow, hash comparison) leaks user existence. See `DUMMY_HASH` in `src/lib/auth.ts`.

**`timingSafeEqual` for webhook HMAC:** Prevents signature byte recovery via response time measurement.

### JWT Security

```typescript
jwt.verify(token, JWT_SECRET, {
  algorithms: ["HS256"],  // ← algorithm whitelist — prevents none-algorithm attack
});
```

The `none` algorithm attack: a JWT with `alg: "none"` in the header can be crafted without a signature. Without an explicit algorithm whitelist, some implementations accept it. The whitelist rejects any JWT where `alg` is not `HS256`.

### PIN Security

```typescript
await argon2.hash(pin, {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64MB
  timeCost: 3,
  parallelism: 4,
});
```

Argon2id is memory-hard — GPU-based brute force attacks are expensive because they require large amounts of GPU memory per attempt, limiting parallelism. `memoryCost: 65536` (64MB) is the OWASP 2024 minimum recommendation for Argon2id.

### Progressive PIN Lockout

```
5 failures  → 10 minute lockout
10 failures → 1 hour lockout
20+ failures → 24 hour lockout
```

Stored on `User.pinFailedAttempts` and `User.pinLockedUntil`. Enforced at service layer before Argon2 verification is attempted — no hash computation wasted on locked accounts.

### Silent Signup (Enumeration Prevention)

```typescript
// On registration with an already-registered phone
return res.status(201).json({ success: true }); // identical to successful registration
// Never return "phone already registered"
```

An attacker cannot determine whether a phone number is registered by testing the signup endpoint.

### Bank Detail Encryption

```typescript
// AES-256-GCM for seller bank details at rest
const encrypted = encrypt(accountNumber, process.env.ENCRYPTION_KEY!);
await prisma.sellerProfile.update({ data: { accountNumber: encrypted } });

// On read: truncate for non-admin, decrypt for admin/payout processing
const masked = `****${decrypted.slice(-4)}`; // non-admin view
```

### CSP Headers

```
Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'
```

`frame-ancestors 'none'` prevents clickjacking. `object-src 'none'` disables Flash/plugin injection. `base-uri 'self'` prevents base tag injection attacks.

---

## 21. Performance — Query Optimisation & Connection Pooling

### Connection Pool Configuration

```
DATABASE_URL → pgBouncer (port 6543, transaction mode)
  └── Supabase free tier: max 60 backend connections
  └── Application: effectively unlimited concurrent requests
      (pgBouncer multiplexes)

DIRECT_URL → Postgres direct (port 5432)
  └── Used by: prisma migrate, seed, withRetry long-running ops
  └── pgBouncer in transaction mode doesn't support multi-statement sessions
```

**pg_trgm full-text vs PostGIS:** product name text search (`ILIKE '%query%'`) uses `pg_trgm` GIN index. PostGIS handles radius. Both run in a single query — no N+1 between text matching and spatial filtering.

### Pagination

All list endpoints use cursor-based or offset pagination with explicit `LIMIT`:
```sql
LIMIT ${limit} OFFSET ${(page - 1) * limit}
```

`productRepo.findNearby` never returns unbounded result sets. Default limit: 20. Maximum: 50. Without explicit limits, a query for all products in a 50km radius could return thousands of rows on a mature catalog.

### Slow Query Identification

Supabase Dashboard → Query Performance → Slow Queries shows queries by mean execution time. The PostGIS query was profiled here — GIST index confirmed active by `EXPLAIN ANALYZE` showing `Index Scan using Product_location_gist`.

### N+1 Prevention

Prisma `include` for all multi-table reads:
```typescript
await prisma.order.findMany({
  where: { buyerId },
  include: {
    subOrders: {
      include: {
        seller: { include: { pickupWindows: true } },
        orderItems: { include: { product: true } },
      },
    },
  },
});
```

No lazy loading — all relations required for a response are fetched in one query.

---

## 22. Testing — Strategy & Validation

### Testing Pyramid

```
           ┌───────────┐
           │   k6      │  Load / concurrency / idempotency
           │  (5 files)│
           └─────┬─────┘
                 │
         ┌───────┴────────┐
         │  Integration   │  (planned — supertest + real DB)
         └───────┬────────┘
                 │
       ┌─────────┴──────────┐
       │    Unit (planned)  │  Service layer — mocked repos
       └────────────────────┘
```

### k6 Load Tests

```
01_percentiles.js    — P50/P90/P95/P99 per endpoint, 100 VUs steady state
02_throughput.js     — req/s and error rate, ramp 10→500 VUs
03_race_condition.js — stock locking proof, 50 isolated buyers on stock=10
04_webhook_idempotency.js — 100 concurrent identical webhook deliveries
05_concurrency.js    — cart stability (50 VUs) + cache cold vs warm comparison
```

### Race Condition Test Methodology

Test 03 uses 50 isolated buyer accounts (each with their own JWT from `setup-race-test.ts`). Each VU calls `POST /api/orders` directly — bypassing the cart layer so the test exercises `SELECT FOR UPDATE` specifically, not cart-layer advisory checks.

```
Expected result: exactly 10 successes (201), exactly 40 conflicts (409), 0 server errors
DB verification: SELECT available FROM "Product" WHERE id = $id → must return 0
```

### Webhook Idempotency Test

100 VUs send the identical webhook payload (same `razorpayPaymentId`) concurrently. All receive 200. DB verification: `SELECT COUNT(*) FROM "WebhookLog" WHERE "razorpayPaymentId" = $id → 1`.

### What Load Tests Found (Production Findings)

1. **Dev server collapse under concurrency** — `next dev` is single-threaded; collapsed at 50 VUs. Tests redirected to production build.
2. **Cart-clearing gap** — stock reached zero mid-checkout; cart UI did not clear after 409. The lock held; the bug was in client state. Fixed.
3. **Rate limiter fail-open** — Redis stopped mid-test; rate limiter passed all requests. Fixed to fail-closed.
4. **False positive** — quantity-5 items rejected by `minOrderValue` check. Not a bug; documented as platform business rule correctly enforcing ₹1000 minimum.

### Known Testing Gaps

- No unit tests on service layer — `orderService.createFromCart` has zero unit tests; compensating transaction path untested in isolation
- Race condition test requires isolated buyer accounts — test setup script (`setup-race-test.ts`) must run before test 03
- No CI integration — k6 tests run manually; a regression in locking or idempotency would not be caught automatically

---

## 23. Key Technical Decisions

### `pickupDeadline` Stored, Not Computed

`SubOrder.pickupDeadline = pickupDate + window.endTime` is stored as a `DateTime` column at order creation. The Vercel Cron job queries `WHERE "pickupDeadline" < NOW() AND status = 'PENDING'` — indexed, O(log n).

### Hindi-First i18n — Resolution at Creation

Notification content resolved at creation time using `user.preferredLang`. The `Notification` table stores the final rendered string. Correct even if the user changes `preferredLang` after the fact — historical notifications reflect the language preference at the time of the event.

### Separate Deal Entity

`Deal` is a first-class model:
1. **History** — expired deals retained for seller analytics
2. **One ACTIVE per product** — enforced at service layer
3. **Cron-safe expiry** — `Deal.expiresAt` is indexed; cron runs `UPDATE "Deal" SET status = 'EXPIRED' WHERE expiresAt < NOW()`

### Minimum Order Value

`PlatformConfig.minOrderValue` (₹1000) enforced server-side at checkout. A request bypassing the UI must still be rejected by the service layer. Identified during load testing as the cause of an apparent "anomalous rejection pattern" — was correctly enforcing business logic.

### `DIRECT_URL` for Seed/Migrations

pgBouncer in transaction-pooling mode does not support long-lived multi-statement sessions. `prisma migrate` and the 540-product seed INSERT batch require session-scoped connections — they use `DIRECT_URL` (port 5432) to bypass pgBouncer.

---

## 24. Scale Upgrade Path

| Scale | Bottleneck | Change |
|-------|------------|--------|
| **Current** | — | Single Supabase Postgres + pgBouncer. Vercel Serverless. Upstash Redis. |
| **5x traffic** | Product feed DB load | Supabase read replica for `productRepo.findNearby`. Redis cache TTL extended. `pg_trgm` GIN already in place. |
| **10x traffic** | pgBouncer connection limits | Supabase Pro (higher pool limits). `withCache` stampede prevention (Redis SET NX lock). |
| **50x traffic** | Synchronous notification/payout in request path | BullMQ workers on Railway. Lazy expiry moves to queue. Vercel Hobby cron replaced. |
| **100x traffic** | Single Postgres write throughput | Partition `Product` table by city. Read replicas per region. Razorpay Route for automated payouts. |
| **1M+ products** | PostGIS GIST performance | Partition spatially by bounding box. Each partition has its own GIST index. Queries routed by city. |

**PostGIS GIST scales to 10x without schema change.** The bottleneck at 10x is DB compute (read replica), not the spatial index design.

---

## 25. System Invariants

19 correctness guarantees enforced at DB and application layer. Violating any is a bug, not a missing feature.

| # | Invariant | Enforcement |
|---|-----------|-------------|
| INV-01 | `product.available` never goes negative | DB `CHECK (available >= 0)` + `SELECT FOR UPDATE` |
| INV-02 | `COMPLETED`/`CANCELLED`/`DISPUTED` status cannot change | State machine empty edge arrays; `validateTransition` throws |
| INV-03 | Webhook event processed exactly once | `WebhookLog.razorpayPaymentId @unique` + transaction |
| INV-04 | BUYER cannot access seller-only routes | `requireRole(req, "SELLER")` in middleware |
| INV-05 | User sees only their own orders | `userId` from JWT; all queries filter by `buyerId`/`sellerId` |
| INV-06 | OTP cleared after verification | `deliveryOtp = null` in same transaction as status → COMPLETED |
| INV-07 | Phone is the unique user identifier | `phone @unique` at DB level; silent signup prevents enumeration |
| INV-08 | Seller store name + address must be unique | `@@unique([storeName, street])` at DB level |
| INV-09 | Deal price reverts after expiry | Query joins only `status = ACTIVE AND expiresAt > NOW()` |
| INV-10 | Order total ≥ platform minimum | `sellerTotal >= PlatformConfig.minOrderValue` before Razorpay creation |
| INV-11 | Order cannot confirm without captured advance | Only `payment.captured` webhook triggers PENDING → CONFIRMED |
| INV-12 | Order cannot complete without payment AND OTP | State machine requires READY_FOR_OTP_VERIFICATION before COMPLETED |
| INV-13 | Refund calculated server-side only | `calcRefundAmount(advance, pickupDeadline, cancelledBy)` — client never sends refund amount |
| INV-14 | Seller cannot see own products in buyer feed | `AND p."sellerId" != $userId` in PostGIS query when authenticated |
| INV-15 | Review only after COMPLETED SubOrder | `reviewService` verifies `subOrder.status === COMPLETED` and buyer ownership |
| INV-16 | One review per order per product | `@@unique([subOrderId, productId])` at DB level |
| INV-17 | Bank details masked in non-admin responses | `accountNumber` truncated to last 4 digits |
| INV-18 | Client never sends status transitions or prices | Zod schemas omit `status` and `unitPrice` from all request bodies |
| INV-19 | Cart checkout reads from server state only | `POST /api/cart/checkout` takes no body — server reads CartSession from DB |

---

## 26. Known Limitations

Stated explicitly rather than left for a reviewer to find:

- **No unit tests on service layer.** `orderService.createFromCart` has zero unit tests. The compensating transaction path (Razorpay failure after Postgres commit) has never been triggered in a controlled test environment.
- **Race condition test requires pre-setup.** Test 03 requires 50 isolated buyer accounts created by `setup-race-test.ts`. Running without this setup produces misleading results.
- **Cache stampede unmitigated.** Concurrent cache misses on the same product listing key all fire the PostGIS query simultaneously. A short-lived Redis lock in `withCache` is the known fix — not yet applied.
- **Lazy expiry concurrent sweeps.** `releaseAllExpiredPendingOrders()` is called on every product feed request. Under high concurrent load, many simultaneous sweeps run. A Redis distributed lock (`SET NX EX 30`) at the top of the sweep function limits this to one sweep per 30 seconds — not yet applied.
- **No chaos / multi-AZ failover testing.** The Supabase pooler retry wrapper covers the transient-connection failure classes observed under load. Network partition, multi-region failover are untested.
- **No automated load-test regression in CI.** k6 tests run manually. A regression in locking, idempotency, or rate-limit fail-mode behavior would not be caught automatically.
- **Refresh-token table has no retention sweep.** Expired and rotated sessions accumulate. Not a correctness issue at current volume; the security property holds at point-of-use regardless of table size.
- **`withRetry` not applied to `$transaction` calls.** Transient Supabase connection failures during a `SELECT FOR UPDATE` transaction are not retried automatically — the lock must be re-acquired explicitly. Services must handle `P1001` errors at the caller level for transactional paths.
