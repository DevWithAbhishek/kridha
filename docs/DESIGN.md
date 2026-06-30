# DESIGN.md — Kridha Architecture & Implementation Decisions

---

## 1. Patterns Used

### 1.1 State Machine (Order Lifecycle)

`SubOrder.status` transitions are modelled as an explicit finite-state machine
defined in `src/lib/state-machine.ts`.

```typescript
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:                    ["CONFIRMED", "CANCELLED"],
  CONFIRMED:                  ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT:           ["READY_FOR_OTP_VERIFICATION"],
  READY_FOR_OTP_VERIFICATION: ["COMPLETED", "DISPUTED"],
  COMPLETED:                  [],   // terminal — empty edge set
  CANCELLED:                  [],   // terminal — empty edge set
  DISPUTED:                   [],   // terminal — empty edge set
};
```

`validateTransition(from, to)` throws `INVALID_TRANSITION` (HTTP 409) before
any DB write. No `if` chains in service code — correctness is data, not logic.

**Terminal State Protection (Interview: Immutability Guarantee)**

`COMPLETED`, `CANCELLED`, and `DISPUTED` have empty edge arrays. This is not
enforced by a DB constraint — it is enforced by the fact that
`TRANSITIONS[status].length === 0` causes `validateTransition` to throw
unconditionally for any `to` value. Two architectural reasons:

1. **Financial finality.** A `COMPLETED` SubOrder has a settled payout row and
   a Razorpay payment record. Allowing re-transition would create a split-brain
   between the financial ledger and the order record — the payout cannot be
   un-sent, so the order must not be un-completed.

2. **Audit integrity.** `OrderStatusHistory` is append-only. A re-opened
   `CANCELLED` order would produce a history that contradicts the refund
   already issued. Both the refund and the cancellation notification are
   side-effects that cannot be undone — the status must match.

The state machine is the single choke-point. No endpoint, webhook, or cron
job writes `status` directly — all go through `validateTransition` first (INV-02).

---

### 1.2 Repository Pattern (Data Access)

All Prisma access is isolated per domain:

```
src/repo/
  auth.repo.ts      product.repo.ts
  order.repo.ts     seller.repo.ts
  user.repo.ts      admin.repo.ts
```

Services import repos, never `prisma` directly. Swapping the ORM is one file
per domain. Route handlers import services, never repos. The dependency graph
is strictly layered: `route → service → repo → prisma`.

---

### 1.3 Idempotency (Webhook Processing)

```
Razorpay fires payment.captured
  │
  ├─ 1. Verify HMAC (RAZORPAY_WEBHOOK_SECRET)
  │      fail → log, return 200 silently
  ├─ 2. SELECT WebhookLog WHERE razorpayPaymentId = $id
  │      found → return 200 immediately (duplicate)
  └─ 3. prisma.$transaction([
           subOrder.update(PENDING → CONFIRMED),
           webhookLog.create({ razorpayPaymentId }),  ← @unique constraint
           orderStatusHistory.create(),
        ])
        Race: second concurrent INSERT violates @unique → rollback → 200
```

`WebhookLog.razorpayPaymentId @unique` is the idempotency key at the DB layer.
Application-level duplicate checks are insufficient under concurrent delivery —
the `@unique` constraint is the final atomic guard. The handler always returns
`200` to prevent Razorpay's exponential retry backoff (INV-03).

---

### 1.4 Cache-Aside (Product Feed)

`productRepo.findNearby` checks Redis before hitting the DB:

```
Cache key:  products:{lat}:{lng}:{radius}:{category}:{sortBy}:{page}
TTL:        60s (matches TanStack Query staleTime on client)
Invalidate: on product create / PATCH / DELETE (cacheDel in service layer)
```

All cache operations are fail-open — `cacheGet` and `cacheSet` swallow errors.
Redis is never source of truth; the DB is. A Redis outage degrades performance,
not correctness.

**Distinction from rate-limit state:** Redis serves two different
responsibilities in Kridha — cache (fail-open, degrades performance only) and
rate-limit counters (fail-**closed**, see §5a). The two are not interchangeable
failure modes; conflating them was a load-testing finding, not a design intent
— see Performance Validation in `README.md`.

---

## 2. Concurrency Control — Pessimistic Locking for Stock

**The race condition:** Two buyers simultaneously add the last 10 kg of Mustard
Oil to their carts. Both read `available = 10`. Both call
`POST /api/cart/checkout`. Without a lock, both writes succeed — `available`
goes to `−10`, violating INV-01.

### Why Pessimistic Locking (`SELECT FOR UPDATE`)

Kridha uses **pessimistic locking** inside `prisma.$transaction()`:

```sql
BEGIN;
SELECT * FROM "Product" WHERE id = $1 FOR UPDATE;
-- row is now locked — concurrent readers that also use FOR UPDATE block here
UPDATE "Product" SET available = available - $qty WHERE id = $1;
INSERT INTO "OrderItem" ...;
COMMIT;
```

The `FOR UPDATE` lock is held from `SELECT` to `COMMIT`. Any concurrent
transaction attempting `SELECT ... FOR UPDATE` on the same product row blocks
until the first transaction commits or rolls back. Outcome: exactly one buyer
gets `201 CREATED`, the other gets `409 INSUFFICIENT_STOCK`.

**Why pessimistic over optimistic (version counter)?**

Optimistic locking adds a `version: Int` column. On update:
```sql
UPDATE "Product" SET available = available - $qty, version = version + 1
WHERE id = $1 AND version = $expectedVersion;
```
If another transaction incremented `version` first, this update affects 0 rows
→ application retries the whole transaction.

For Kridha's hot SKUs (mustard oil from one mill, 50 units total, 20 buyers
simultaneously), optimistic locking produces a **retry storm** — most
transactions fail their `version` check, retry, fail again, and exhaust their
retry budget. The latency tail explodes.

Pessimistic locking serialises access at the DB layer. One transaction holds
the lock, the rest queue. Total time = sum of serialised writes (fast) rather
than sum of failed attempts × retry count (unpredictable). For low-contention
rows (most products), the lock is held for <5ms — negligible overhead.

**Deterministic success for hot SKUs** — the first N transactions where N ≤
`available` always succeed. No retry needed. The (N+1)th transaction gets a
clean `409` immediately. This is the correct behaviour for a marketplace: first
come, first served, no ambiguity.

```typescript
// src/services/order.service.ts (simplified)
await prisma.$transaction(async (tx) => {
  const product = await tx.$queryRaw<Product[]>`
    SELECT * FROM "Product" WHERE id = ${productId} FOR UPDATE
  `;
  if (product[0].available < quantity) throw ERR.INSUFFICIENT_STOCK({ ... });
  await tx.product.update({
    where: { id: productId },
    data:  { available: { decrement: quantity } },
  });
  // INSERT OrderItems, SubOrders, etc.
}, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
```

The `CHECK (available >= 0)` DB constraint is a secondary safety net — it
catches any bug that bypasses the application-level lock check (INV-01).

**Load-test verification:** A stock-drain scenario run to zero mid-checkout
surfaced a gap in cart-clearing logic on the client side (the cart did not
clear after a `409`, allowing a retry against already-decremented stock in the
UI state, not the DB state). The DB-level lock and the `CHECK` constraint held
in every case — no row ever went negative. The bug was in client cart state,
not the locking guarantee. Identified and corrected; full methodology in
`README.md` → Performance Validation.

---

## 3. Spatial Discovery — PostGIS `ST_DWithin` + GIST Index

### Why Not Simple Lat/Lng Filters?

A naive approach:
```sql
WHERE ABS(latitude - $lat) < $latDelta AND ABS(longitude - $lng) < $lngDelta
```
This is a bounding-box filter on Euclidean coordinates. It has two problems:

1. **No index support.** Two separate B-Tree indexes on `latitude` and
   `longitude` cannot be combined efficiently — the DB must scan one index and
   filter on the other, or table-scan.
2. **Inaccurate at scale.** 1° longitude ≠ same distance everywhere.
   At Gorakhpur (26°N), 1° lng ≈ 99 km. At Srinagar (34°N), 1° lng ≈ 92 km.
   A fixed delta produces elliptical, not circular, search regions.

### PostGIS Geography Type + GIST Index

```sql
-- Migration (executed once on DB init)
ALTER TABLE "Product"
  ADD COLUMN location geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  ) STORED;

CREATE INDEX "Product_location_gist"
  ON "Product" USING GIST (location);
```

`geography(Point, 4326)` stores coordinates on the WGS-84 ellipsoid —
the same datum used by GPS. `ST_DWithin` on geography types computes
**true geodesic distance in metres** (not degrees), accounting for Earth's
curvature. Accurate to within centimetres at India-scale distances.

Supabase ships PostGIS as a first-class enabled extension on its Postgres
instances (`CREATE EXTENSION IF NOT EXISTS postgis;` is a one-line migration,
no separate spatial database needed) — the geography type and GIST indexing
above run on the same Postgres instance as every other table in Kridha.

**Spatial Indexing — Why GIST?**

A B-Tree index is one-dimensional. Geographic coordinates are two-dimensional.
A GIST (Generalised Search Tree) index partitions 2D space into bounding boxes
using an R-Tree strategy. For a radius query, PostGIS intersects the query
circle's bounding box with the GIST index pages — discarding most of the table
without reading it.

At 500 products within a 50 km radius, a GIST-indexed `ST_DWithin` reads
O(log n) index pages + O(k) matching rows, where k is the result count.
A lat/lng table scan reads O(n) rows regardless.

**KNN Operator for Distance Sort**

```sql
ORDER BY
  COALESCE(p.location, ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography)
  <-> ST_MakePoint($lng, $lat)::geography ASC
```

The `<->` operator is PostGIS's KNN (K-Nearest-Neighbour) operator. It uses
the GIST index to return rows in distance order **without computing distance
for every row** — the index provides the ordering. This is significantly faster
than `ORDER BY ST_Distance(...) ASC` which requires a full distance computation
per row after the `WHERE` filter.

**Composable SQL with `Prisma.sql`**

The Prisma ORM cannot construct spatial predicates for `Unsupported()`
geography columns. All product discovery uses `prisma.$queryRaw` with
`Prisma.sql` tagged template fragments — all user inputs are parameterised,
never interpolated:

```typescript
// src/lib/postgis.ts
const geoFilter = Prisma.sql`
  AND ST_DWithin(
    COALESCE(
      p."location",
      ST_SetSRID(ST_MakePoint(p."longitude", p."latitude"), 4326)::geography
    ),
    ST_MakePoint(${f.lng}, ${f.lat})::geography,
    ${f.radiusM}
  )`;
```

`COALESCE` guards against NULL `location` values — products inserted before
the generated column migration still resolve via their stored `latitude`/
`longitude` columns.

**Why this matters in practice, not just in theory:** the `GENERATED ALWAYS`
geography column rejected ORM-path inserts during seed-data population —
Prisma's default insert path does not satisfy the generated-column expression.
Fixed with a raw SQL insert using `ST_SetSRID(ST_MakePoint(...))` issued
against Supabase's direct connection string (port 5432, not the pooled 6543
endpoint — see §4). The `COALESCE` guard above exists specifically because of
this — any row inserted via a path that bypasses the generated column still
resolves correctly from its raw `latitude`/`longitude` columns.

**INV-14 — Seller Feed Exclusion**

```typescript
const excludeClause = f.excludeSellerId
  ? Prisma.sql`AND p."sellerId" != ${f.excludeSellerId}`
  : Prisma.empty;
```

When `getOptionalUser(req)` resolves a caller, their `userId` is passed as
`excludeSellerId`. Sellers browsing the buyer feed do not see their own
products. Anonymous requests pass no `excludeSellerId` — no exclusion applied.

---

## 4. Infrastructure Resilience — Supabase Pooler Retry

### The Problem: Transient Pooled-Connection Failures

Kridha connects to Postgres through Supabase's two connection modes:

```
DATABASE_URL   → pgBouncer pooled connection, port 6543, transaction mode
DIRECT_URL     → direct connection, port 5432, no pooler in front
```

The pooled endpoint (`DATABASE_URL`) is what the application uses at request
time — pgBouncer multiplexes many short-lived Prisma client connections over a
smaller number of real Postgres backend connections. Under two conditions this
surfaces transient connection errors that are not application bugs:

1. **Free-tier project pause.** Supabase pauses a free-tier project's compute
   after 7 days with no activity. The first request after a pause must wait
   for the project to resume before the pooler can reach Postgres at all.
2. **Pooler connection churn.** In transaction-pooling mode, pgBouncer can
   recycle a connection between statements. Under bursty concurrent load this
   occasionally surfaces as a dropped connection mid-request rather than a
   query error — a different failure shape than a query syntax or constraint
   problem.

`Prisma` surfaces both as variants of:

```
PrismaClientInitializationError: P1001 — Can't reach database server
```

```
"Connection terminated unexpectedly"   — pooled connection recycled mid-request
"ECONNREFUSED"                          — port not yet accepting connections (project resuming)
"Timed out fetching a new connection"   — pool exhausted under burst
```

These are **transient** by nature — the underlying Postgres instance is
healthy, the connection path to it is temporarily unavailable. Without retry,
the first request after a pause, or any request caught in pooler churn under
load, returns a 500 to the user. This is exactly the class of failure the
production load test (see `README.md` → Performance Validation) was designed
to surface: testing against `next dev` locally does not reproduce Supabase's
pooled-connection behavior under concurrency the way a production build
hitting the real pooled endpoint does.

### `withRetry` — Backoff Wrapper

```typescript
// src/lib/db.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 4,
  delayMs = 1500,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isTransientConnectionError =
        err instanceof Error &&
        (err.message.includes("P1001") ||
          err.message.includes("Can't reach database") ||
          err.message.includes("Connection terminated") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("Timed out fetching a new connection") ||
          err.message.includes("network error"));

      if (!isTransientConnectionError || attempt === retries) throw err;

      // Linear backoff: 1.5s, 3s, 4.5s, 6s
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error("unreachable");
}
```

**Design decisions:**

- **4 retries × 1.5s base = max 15s wait.** A free-tier project resume
  typically completes well inside this window; pooler churn under load
  resolves in one or two retries almost always. The 4th retry is insurance
  for the resume-from-pause case specifically.
- **Linear (not exponential) backoff** — the bottleneck for a project resume
  is a fixed wake time, not server load that benefits from exponential
  spacing. Exponential backoff would add unnecessary latency once the project
  is already warm.
- **Error message matching, not error type.** Prisma's pooled-connection
  errors surface with different shapes depending on whether the failure is at
  the pgBouncer layer or the underlying Postgres connection. String matching
  on `err.message` is more robust than `instanceof` checks across these cases.
- **Non-connection errors propagate immediately.** Constraint violations,
  unique key errors, and query errors are thrown on the first attempt.
  `withRetry` never masks application bugs — it only retries the specific
  transient-connection error strings listed above.
- **`DIRECT_URL` for seed/migrations.** Prisma CLI and `prisma/seed.ts` use
  `DIRECT_URL` (the unpooled, port-5432 connection) rather than the pooled
  `DATABASE_URL`. pgBouncer in transaction-pooling mode does not reliably
  support the long-lived, multi-statement session behavior that `prisma
  migrate` and large batched seed inserts require — the 540-product raw
  INSERT batch in the seed script is run against the direct connection for
  this reason.

**Usage pattern:**

```typescript
// Any DB call that can tolerate retry
const product = await withRetry(() =>
  productRepo.findNearby(input, excludeSellerId)
);
```

Not every call uses `withRetry` — mutations inside `prisma.$transaction()`
with `SELECT FOR UPDATE` should not be retried transparently, as the lock
release and re-acquisition must be explicit.

---

## 5. Cookie-Only Auth Architecture

**No `Authorization` header. No `localStorage`. No JWT in response body.**

```
kridha_access     │ HttpOnly │ path=/          │ 15 min  │ JWT — route handlers verify directly
kridha_refresh    │ HttpOnly │ path=/api/auth  │ 7 days  │ Rotation chain — hash stored in DB
kridha_lang       │          │ path=/          │ 1 year  │ "hi"|"en" — next-intl reads from JS
kridha_access_exp │          │ path=/          │ 15 min  │ Unix expiry — proactive refresh scheduler
```

`kridha_refresh` is path-scoped to `/api/auth`. The browser never sends it to
`/api/products`, `/api/orders`, or any other endpoint — a stolen refresh token
cannot be replayed against non-auth endpoints.

**Token Family Rotation:** Every `POST /api/auth/refresh` issues a new pair and
revokes the old token hash in `RefreshToken`. Reusing a rotated token revokes
all sessions for that user — theft detection with zero false positives.

**Silent Refresh (Axios Interceptor):**

On `401`, the `api.ts` interceptor fires `POST /api/auth/refresh` using a
dedicated `refreshClient` — a clean Axios instance with **no interceptor**. If
the refresh itself returns `401`, the clean client rejects without re-entering
the interceptor, preventing recursive 401 loops. All in-flight requests are
queued during refresh and replayed on success.

### 5a. Rate Limiter Failure Mode — Fail Closed

Rate-limit counters live in Redis, separately from the cache-aside layer in
§1.4. The two have deliberately different failure modes:

- **Cache (§1.4):** fail-open. A Redis outage means more DB reads, not
  incorrect behavior.
- **Rate limiter:** fail-**closed**. If Redis is unreachable when a rate-limit
  check is attempted, the request is **blocked**, not allowed through.

This was not the original behavior. Load testing against a stopped Redis
instance mid-run exposed the original implementation failing open — Redis
unavailable meant the limiter could not read a counter, defaulted to "no limit
found," and allowed unlimited traffic through during exactly the window an
attacker would want it. Corrected to fail closed: if the rate-limit state
cannot be read, the request is rejected, not waved through. The tradeoff is a
Redis outage now degrades auth/write availability instead of degrading only
read performance — judged the correct tradeoff for an endpoint class where the
alternative is unbounded abuse during an infrastructure failure (INV-06 in
`README.md` System Invariants).

---

## 6. Key Technical Decisions

### pickupDeadline Stored, Not Computed

`SubOrder.pickupDeadline = pickupDate + window.endTime` is stored as a
`DateTime` column at order creation. The Vercel Cron job that expires no-show
orders runs:

```sql
WHERE "pickupDeadline" < NOW() AND status = 'PENDING'
```

A computed expression cannot be indexed. A stored column can have a B-Tree
index — the cron query is O(log n) at any order volume.

### Hindi-First i18n — Resolution at Creation

Notification content is resolved at the time the notification is created,
using `user.preferredLang` from the DB:

```typescript
const copy = notifStrings.orderConfirmed[user.preferredLang](shortId, otp);
await prisma.notification.create({ data: { title: copy.title, body: copy.body, ... } });
```

No runtime translation. No message template stored and resolved later.
The `Notification` table stores the final rendered string. This means
notifications are correct even if the user changes `preferredLang` after the
fact — the historical notification reflects the language preference at the time
of the event.

### Separate Deal Entity (Not a Product Field)

`Deal` is a first-class model, not a `discountPercent` column on `Product`.
Reasons:

1. **History.** Expired deals are retained. `GET /api/products/deals/mine?status=expired`
   gives sellers analytics on which deals drove orders.
2. **One ACTIVE per product** — enforced at service layer (`DEAL_EXISTS` error),
   not at DB level (no partial unique index on `status = ACTIVE`). The service
   check is simpler and sufficient.
3. **Cron-safe expiry.** `Deal.expiresAt` is a stored column. Cron runs
   `UPDATE "Deal" SET status = 'EXPIRED' WHERE expiresAt < NOW() AND status = 'ACTIVE'`.
   The product query joins only `ACTIVE AND expiresAt > NOW()` — double-guarded.

### Minimum Order Value as Platform-Level Business Logic

`PlatformConfig.minOrderValue` (₹1000) is enforced server-side at checkout,
not just surfaced as a UI hint. This is deliberate: client-side minimums are
advisory, not authoritative, and a request that bypasses the UI must still be
rejected by the service layer. Worth noting explicitly because a load-test
scenario using quantity-5 line items initially looked like an anomalous
rejection pattern — it was traced to this exact rule firing correctly, not a
defect. Distinguishing an intentional business-rule rejection from a bug
during load-test triage is itself part of validating the system; see
`README.md` → Performance Validation.

### Order → SubOrder Decomposition

**Atomic financial transaction vs. independent seller logistics.**

An `Order` is the buyer's single Razorpay advance — one payment intent, one
receipt, one atomic financial event. A `SubOrder` is a per-seller operational
contract: independent OTP, pickup window, payment link, payout, and cancellation.

Stock decrement inside `prisma.$transaction()` is grouped per seller —
Seller A's lock does not block Seller B's concurrent checkout. Multi-seller
cart checkout is parallelised at the seller granularity, serialised within
each seller's product set.

---

## 7. Scale Upgrade Path

| Scale | Change |
|-------|--------|
| **Current** | Single Supabase Postgres instance (pooled + direct connection split). Vercel cron. Upstash rate limiting. |
| **10x** | Supabase read replica for `productRepo.findNearby`. Redis cache TTL extended. `pg_trgm` GIN index already in place — no schema change. |
| **100x** | BullMQ workers on Railway replace Vercel cron. Razorpay Route for automated bank transfers. PostGIS GIST index scales without modification. Supabase Pro tier for higher pooler connection limits. |
| **500x** | Partition `Product` table by city (PostGIS `ST_DWithin` partitions cleanly on geography). Read replicas per region. |

PostGIS GIST spatial index is already in place — no spatial architecture change
needed for 10x growth. The bottleneck at 10x is DB compute and pooler
connection limits (read replica, Supabase tier upgrade), not the query design.

---

## 8. Known Limitations

Stated explicitly rather than left for a reviewer to find:

- **No chaos / multi-AZ failover testing yet.** The Supabase pooler retry
  wrapper (§4) covers the transient-connection failure classes actually
  observed under load. Broader failure injection (network partition,
  multi-region failover) is untested.
- **No automated load-test regression suite in CI.** The k6 scenarios that
  surfaced the four issues in `README.md` → Performance Validation were run
  manually, not wired into a CI gate. A regression in locking, idempotency, or
  rate-limit fail-mode behavior would not be caught automatically today.
- **Refresh-token table has no retention sweep.** Per §1.1/ADR-03 in
  `README.md`, expired and rotated tokens are correctly rejected at point of
  use but not deleted — rows accumulate until a cleanup pass is added. Not a
  correctness issue at current volume; listed here as the operational
  follow-up it actually is.