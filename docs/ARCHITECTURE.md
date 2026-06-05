# ARCHITECTURE.md — Kridha System Reasoning

This document explains why each major component was designed the way it was. It is not a description of what the system does. It is an explanation of why it was built this way, what was considered and rejected, and what breaks under specific conditions.

Audience: CTO, senior backend engineer.

---

## Table of Contents

1. [Auth Architecture](#1-auth-architecture)
2. [Order Architecture — The Decomposition Decision](#2-order-architecture--the-decomposition-decision)
3. [State Machine Design](#3-state-machine-design)
4. [Payment Processing — Two-Phase Flow](#4-payment-processing--two-phase-flow)
5. [Inventory Reservation — Row Locking](#5-inventory-reservation--row-locking)
6. [Redis — What It Does and What It Cannot Do](#6-redis--what-it-does-and-what-it-cannot-do)
7. [Rate Limiting — Three Layers](#7-rate-limiting--three-layers)
8. [Webhook Processing — Idempotency Under Concurrency](#8-webhook-processing--idempotency-under-concurrency)
9. [Reconciliation — Financial Ledger Integrity](#9-reconciliation--financial-ledger-integrity)
10. [Observability — What Gets Logged and Why](#10-observability--what-gets-logged-and-why)
11. [Scaling Constraints — Honest Analysis](#11-scaling-constraints--honest-analysis)

---

## 1. Auth Architecture

### Why HttpOnly cookies over Authorization headers or localStorage

The target user is a kirana owner in UP Tier-2, accessing Kridha on a shared Android device. Shared devices mean multiple people may use the same browser session at different times. On a shared device, `localStorage` is readable by any JavaScript running in the same origin — a XSS vulnerability in any dependency (a date picker, a chart library, an image optimizer) exposes the access token silently, without any indication to the user.

HttpOnly cookies are inaccessible to JavaScript by specification. A successful XSS attack cannot read them. This is not a theoretical risk mitigation — it is the removal of an entire attack surface for a user demographic that is unlikely to run separate browser profiles or regularly clear storage.

**Alternative considered — Authorization headers with in-memory token storage:**
Storing the JWT in memory (a module-level variable, not localStorage) eliminates XSS token theft and is used by some high-security systems. The problem is that in-memory storage survives only within the same JavaScript context. A page refresh, a tab close, or a browser restart loses the token and forces the user to re-authenticate. For a kirana owner standing at a supplier's counter trying to show an OTP, a forced re-login at the wrong moment is a significant UX failure. HttpOnly cookies persist correctly across tab closes and page refreshes.

**Alternative considered — Authorization headers with localStorage:**
Rejected outright. localStorage is readable by JavaScript. Any dependency with a supply-chain compromise or a DOM XSS vulnerability in user-generated content (product names, store descriptions) would silently exfiltrate the token.

**Tradeoffs accepted:**
HttpOnly cookies require CSRF protection. All mutation endpoints use a double-submit CSRF token: a random value stored in a non-HttpOnly cookie and echoed in a request header. The middleware validates that the cookie value matches the header value. A cross-site request forged by an attacker cannot read the non-HttpOnly cookie value from a different origin, so the double-submit check fails. The cost is one extra header per mutation request. The benefit is the elimination of XSS-based token theft.

**The refresh token scoping decision:**
`kridha_refresh` is scoped to `path=/api/auth`. The browser sends this cookie only to auth endpoints, never to `/api/products`, `/api/orders`, or `/api/admin`. This limits blast radius: if an attacker intercepts a refresh token through a non-auth endpoint vulnerability, they cannot replay it — the browser would not have sent it to that endpoint in the first place.

### Why token family rotation rather than simple refresh token rotation

Simple rotation: when a refresh token is used, issue a new one and invalidate the old one. The problem: if an attacker steals the refresh token and uses it before the legitimate user, the legitimate user's next refresh attempt will fail (their token is now invalid). They will be forced to log in, at which point they might notice the problem — or might not, if they assume it's a session expiry.

Token family rotation adds a second invariant: if a refresh token that has already been rotated is presented (a reused token), all sessions for that user are immediately revoked. The entire family is invalidated. This detects the theft scenario: the attacker uses the token, the legitimate user uses their copy (now stale), the system detects the reuse, revokes everything, and alerts via GlitchTip at fatal severity.

**Failure scenario:**
A user on a slow mobile connection sends the refresh request twice due to a network timeout before the first response arrives. Both requests carry the same refresh token. The first processes, issues a new token, invalidates the old one. The second arrives with the now-invalid old token — the system detects this as reuse and revokes all sessions.

**Mitigation:**
The refresh client in `api.ts` queues concurrent refresh requests and deduplicates them. Only one refresh request is in flight at a time. All queued requests wait for the first to complete and use its result. The second request never reaches the server.

### Why PIN over OTP or password

OTP requires SMS infrastructure, which has cost, delivery latency, and telecom dependencies. A user at a supplier's counter with poor signal cannot receive an OTP in time. OTP also requires a valid phone number reachable by SMS at every login — many UP feature phones have intermittent SMS delivery.

Passwords require users to remember them, have password recovery infrastructure, and create usability friction for a demographic that is accustomed to PIN-based UX (ATMs, mobile banking). A 4-digit PIN with progressive lockout (5 failures → 10 minutes, 10 → 1 hour, 20+ → 24 hours) and Argon2 hashing provides reasonable security for a marketplace application while matching the UX expectations of the user base.

**What PIN does not protect against:**
A device that is physically stolen and unlocked by the thief who knows the PIN. This is a physical security problem, not an application security problem. It is out of scope.

### Why a separate admin auth surface

Admin JWTs are signed with `ADMIN_JWT_SECRET`, distinct from `JWT_SECRET`. Admin cookies are named `kridha_admin` with `path=/api/admin`. The browser never sends the admin cookie to buyer or seller endpoints.

The separation means that even if `JWT_SECRET` were compromised, an attacker could not craft admin tokens. Even if an admin JWT were intercepted, it cannot be replayed against non-admin endpoints. Admin tokens carry `type: "admin"` in the payload — a user JWT with `type: "user"` is rejected by admin middleware even if the signing secrets were accidentally identical.

---

## 2. Order Architecture — The Decomposition Decision

### The problem that forced the decomposition

A buyer ordering from three sellers in one checkout needs:

1. **One atomic payment event.** The advance must cover all sellers simultaneously. The buyer pays once. One Razorpay order. One webhook. One confirmation email. The financial unit is the checkout session.

2. **Three independent operational tracks.** Each seller has their own pickup window, pickup deadline, OTP, payment link, payout record, cancellation path, status history, and refund calculation. Seller A cancelling their SubOrder must not affect Seller B's ability to confirm theirs. Seller B receiving their remaining payment must not trigger Seller A's state machine.

A single `Order` table with seller-specific fields cannot satisfy both requirements. If Seller A's cancellation sets the entire Order to `CANCELLED`, Seller B's fulfillment is blocked. If the Order status reflects only the majority state, there is no clean representation of partial cancellation and partial completion.

**The decomposition:**
`Order` is the financial unit. It holds `totalAmount`, `advanceAmount`, `platformFee`, `cartSessionId`, and the relationship to the Razorpay advance. It does not hold status — its status is derived from its SubOrders.

`SubOrder` is the per-seller contract. It holds `status`, `pickupDate`, `pickupDeadline`, `deliveryOtp`, `paymentLinkUrl`, and the payout record. Its state machine is independent. It can be `CONFIRMED` while a sibling `SubOrder` for the same `Order` is `CANCELLED`.

**Alternative considered — denormalized single Order with seller arrays:**
A single `Order` with `sellers: [{sellerId, status, items, otp}]` stored as JSONB. Simpler schema. The problem: JSONB fields cannot be indexed for the queries that matter — `WHERE sellerId = ?` to find a seller's incoming orders, `WHERE status = PENDING AND createdAt < cutoff` for expiry sweeps, `WHERE pickupDeadline < NOW()` for the payout cron. Every query becomes a table scan with JSONB extraction. State machine enforcement on array elements requires application-level guards that are harder to verify than DB-level constraints.

**Alternative considered — flat Order with nullable seller fields:**
`Order.seller1Id`, `Order.seller1Status`, `Order.seller1Otp`, `Order.seller2Id`... This breaks at any number of sellers greater than the hardcoded maximum and is structurally unmaintainable.

**Tradeoffs accepted:**
The decomposition adds join complexity. Every query that needs order + suborder data requires a join. `orderRepo.findSubOrderById` joins across 5 tables. The complexity is in the query layer, not the business logic layer — which is the correct place for it.

### Why stock decrement is per-seller group, not per-order

Inside `prisma.$transaction()`, stock decrements are grouped by seller. Seller A's `SELECT FOR UPDATE` on Seller A's products does not block Seller B's concurrent checkout on Seller B's products. This matters because in a marketplace with dozens of sellers, serializing all concurrent checkouts on a single transaction-level lock would eliminate any parallelism in the checkout path. The lock scope is the product row, not the order. Two buyers checking out from different sellers have no contention at the DB layer.

---

## 3. State Machine Design

### Why a centralized state machine over distributed status checks

The naive implementation puts status transition logic in the route handlers:

```typescript
// Anti-pattern: status logic in route handler
if (subOrder.status !== 'CONFIRMED') {
  throw new Error('Cannot request payment');
}
await prisma.subOrder.update({ data: { status: 'AWAITING_PAYMENT' } });
```

The problem is that this logic lives in one handler. When a second handler also needs to transition status, the same guard is duplicated. When a third handler needs to know what states are valid targets from a given state, there is no single source of truth. The state machine encodes the graph once:

```typescript
const TRANSITIONS: Record = {
  PENDING:                      ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:                    ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT:             ['READY_FOR_OTP_VERIFICATION', 'CANCELLED'],
  READY_FOR_OTP_VERIFICATION:   ['COMPLETED', 'DISPUTED'],
  COMPLETED:                    [],   // terminal
  CANCELLED:                    [],   // terminal
  DISPUTED:                     [],   // terminal
};
```

`validateTransition(from, to)` throws `INVALID_TRANSITION` before any database write. The caller does not need to know which transitions are valid — it attempts the transition and either succeeds or receives a typed error. Adding a new transition requires editing one object. Adding a new terminal state requires adding an empty array. No if-chain grows.

### Why terminal states have empty edge arrays rather than explicit rejection

The empty array approach means that the same `validateTransition()` function handles terminal state rejection without a special case. `TRANSITIONS['COMPLETED']` returns `[]`. The transition check `if (!allowed.includes(to)) throw INVALID_TRANSITION` handles terminals identically to any other invalid transition. There is no `if (status === 'COMPLETED') throw` branch that could be forgotten.

**Failure scenario:**
A webhook arrives for a SubOrder that is already `COMPLETED` — the `payment_link.paid` event fires twice due to Razorpay's retry logic. The webhook handler checks `SubOrder.status` and finds `COMPLETED`. `validateTransition('COMPLETED', 'READY_FOR_OTP_VERIFICATION')` throws before any DB write. The handler returns `200` (the correct response to Razorpay) without modifying state. The WebhookLog idempotency check would catch this before the state machine, but the state machine provides a second independent guard.

---

## 4. Payment Processing — Two-Phase Flow

### Why advance at booking + remaining at pickup, not full payment upfront

The Kridha user is purchasing from a supplier they may not have dealt with before. A kirana owner buying 100 kg of wheat from an unknown mill has legitimate concerns: the product may not match the listing description, the quantity may be short, the quality may be below expectation. Full upfront payment removes the buyer's leverage entirely.

Two-phase payment preserves buyer leverage while giving the seller commitment:

**Phase 1 — Advance (₹100–₹500):** The buyer demonstrates intent. The seller sees a confirmed order with a payment record. The advance is collected via a Razorpay order at checkout — the buyer pays immediately. `payment.captured` fires the webhook, transitions the SubOrder to `CONFIRMED`, and generates the OTP.

**Phase 2 — Remaining:** The seller requests a Razorpay payment link after the buyer arrives and inspects the goods. The buyer pays the remainder via the link. `payment_link.paid` fires the webhook, transitions to `READY_FOR_OTP_VERIFICATION`. The buyer shows the OTP. Seller verifies. `COMPLETED`.

**Alternative considered — full escrow:**
The buyer pays 100% at checkout, held in escrow, released on OTP verification. This is conceptually clean but requires Razorpay Route or a similar escrow product, which has additional KYC requirements, higher integration complexity, and cost. At Kridha's current stage (pre-revenue, ₹0/month infrastructure), this is architecturally premature.

**Alternative considered — COD with payment tracking:**
The buyer pays nothing upfront. All payment happens at pickup. This eliminates the buyer commitment problem — no-shows remain common, hurting sellers who held stock. The advance is specifically a commitment mechanism: a buyer who has paid ₹120 is significantly more likely to show up than a buyer with a zero-cost confirmation.

**Why the advance calculation is server-side only:**
`MIN(₹500, MAX(₹100, 5% of order total))` is computed in `src/lib/pricing.ts`. No endpoint accepts `advanceAmount` from the client. If the client could set the advance, a buyer could set it to ₹1 — satisfying the "advance paid" requirement while providing essentially no commitment. The server reads `PlatformConfig.advancePercent`, `advanceMinAmount`, and `advanceCapAmount` from the database and calculates the advance atomically before the Razorpay order is created.

### Why the compensating transaction exists

Razorpay order creation happens after `prisma.$transaction()` commits. This is unavoidable — Razorpay is an external service and cannot participate in a Postgres transaction. The sequence is:

1. `$transaction` commits: stock decremented, Order created, SubOrders created with `PENDING` status.
2. `rz.orders.create()` is called.
3. If step 2 throws (network error, Razorpay rate limit, invalid amount), step 1 has already committed.

Without a compensating transaction, the SubOrders remain `PENDING` forever. The stock is decremented and never restored. Buyers see the product as less available than it actually is. The lazy expiry mechanism would eventually clean this up (15 minutes later at best, 24 hours at worst) — but that is a 15-minute window where the stock is incorrectly locked.

The compensating transaction runs immediately on Razorpay failure: restore stock (`available += quantity` per OrderItem), set SubOrders to `CANCELLED` with reason "Razorpay initialization failed". If the compensating transaction itself fails (extremely rare — Postgres is available since we just committed to it), the error is logged at the highest severity with full context for manual intervention.

**What the compensating transaction does not handle:**
Network partition between the Razorpay call and the compensating transaction. If the Razorpay call succeeds but the response is lost (the function times out), the system will attempt the compensating transaction while Razorpay has already created the order. The compensating transaction cancels the SubOrders in the DB, but the Razorpay order remains open. A buyer could theoretically pay this orphaned Razorpay order. The webhook would arrive, find no `PENDING` SubOrder matching the `razorpayAdvanceId`, log a warning, and return `200` without processing — the payment would need manual reconciliation. This edge case is documented, rare, and acceptable at current scale.

---

## 5. Inventory Reservation — Row Locking

### Why pessimistic locking over optimistic locking

**Optimistic locking** uses a version counter. Each product row has `version: Int`. To decrement stock, the update includes `WHERE id = $id AND version = $currentVersion`. If the row has been modified by another transaction since the read, the version mismatch causes the update to affect zero rows, which the application detects and retries.

The problem with optimistic locking for Kridha's use case: hot SKUs are highly contested. A mill selling the last 50 kg of Mustard Oil at market close may have 20+ buyers checking out simultaneously. With optimistic locking, 19 of 20 transactions fail their version check. They retry. The second wave, 18 fail. They retry. The retry storm continues until only one succeeds. Latency tail explodes under exactly the conditions where correct behavior matters most.

**Pessimistic locking** (`SELECT FOR UPDATE`) acquires a row-level write lock. The second buyer's transaction waits for the first to commit, then reads the updated `available` count. If `available < requested`, it throws `INSUFFICIENT_STOCK` immediately. No retry. No version check failure. First come, first served — deterministically at the database layer.

**Alternative considered — Redis-based distributed lock:**
`SET product:{id}:lock 1 EX 5 NX` before decrementing, `DEL product:{id}:lock` after. The problem: distributed locks introduce a second system of truth. If Redis goes down, the lock layer disappears and concurrent checkouts are unprotected. If the lock TTL expires while the transaction is in progress (slow query, slow network), the lock is released while the transaction still holds it. Redis locks are advisory — they do not prevent a bug in the code from bypassing them. Postgres row locks are enforced by the database engine.

**The specific implementation:**

```typescript
const [locked] = await tx.$queryRaw(
  Prisma.sql`SELECT available FROM "Product" WHERE id = ${item.productId} FOR UPDATE`
);
if (locked.available < item.quantity) {
  throw ERR.INSUFFICIENT_STOCK({ ... });
}
await tx.product.update({
  where: { id: item.productId },
  data:  { available: { decrement: item.quantity } },
});
```

The `SELECT FOR UPDATE` and the `UPDATE` are in the same transaction. If the transaction rolls back for any reason, the lock is released and the stock is not decremented. The lock is never held outside the transaction boundary.

**Advisory check before the transaction:**
`cartService.addItem` checks stock before the transaction — `if (product.available < input.quantity) throw INSUFFICIENT_STOCK`. This is advisory only. It prevents the obvious case (buyer requests 100 units, only 5 available) from reaching the transaction at all, reducing unnecessary lock contention. The hard guarantee is the `SELECT FOR UPDATE` inside the transaction. The advisory check is a performance optimization, not a correctness guarantee.

**Failure scenario:**
A transaction holds a `SELECT FOR UPDATE` lock and the Vercel function times out before it commits or rolls back. Postgres detects the client disconnect and automatically rolls back the transaction, releasing the lock. The lock cannot be held indefinitely by a timed-out function — Postgres handles cleanup.

---

## 6. Redis — What It Does and What It Cannot Do

### What Redis is used for

**Rate limiting:** Sliding window counters using sorted sets. `ZADD`, `ZRANGEBYSCORE`, `ZCARD` implement the per-IP and per-account limiters. Upstash's `@upstash/ratelimit` handles the sliding window logic in production.

**Product feed caching:** Cache-aside pattern. `GET kridha:products:{lat}:{lng}:{radius}:{page}:{filters}` on every product feed request. TTL: 60 seconds. Invalidated on every product write. This prevents the PostGIS query from running on every request at steady state.

**Session-adjacent data:** Not used. JWTs are self-contained. Session state lives in the `userSession` table in Postgres.

### What Redis is not used for

Redis is not the source of truth for anything. Every Redis value either has a TTL or is derived from Postgres state that is authoritative. If Redis is lost entirely, the system continues to function correctly — rate limiters fail open, caches miss and fall through to Postgres, nothing is permanently lost.

**Why fail-open on rate limiting:**
If Redis is unavailable and rate limiting fails closed (blocks all requests), legitimate users cannot authenticate during a Redis outage. The auth endpoints become unavailable. A Redis outage turns into a platform outage. Failing open means legitimate users can still authenticate during a Redis outage. The risk — a credential stuffing attack succeeding during a Redis outage — is accepted over the certainty of blocking all legitimate auth during an infrastructure failure.

**Cache key design — rounding lat/lng to 3 decimal places:**
3 decimal places of latitude/longitude represents approximately 111 meters of precision. Buyers within 111 meters of each other receive the same cache entry. In practice, buyers searching for products in Gorakhpur are within the same few square kilometers — the geographic precision is more than sufficient. Without rounding, two buyers standing 5 meters apart with GPS coordinates differing in the 6th decimal place would generate different cache keys and each trigger a PostGIS query.

### Connection pool implications

With the PrismaPg adapter, Redis operations and Postgres operations share no connection pool. Redis connections are managed by the Upstash HTTP client (one HTTPS request per operation) or the local Redis client. Postgres connections come from `pg.Pool`. They are independent failure domains.

---

## 7. Rate Limiting — Three Layers

### Why three layers instead of one

**Layer 1 — Per-IP sliding window (5 req/min on auth endpoints):**
The standard approach. Effective against naive brute force from a single IP. Defeated trivially by IP rotation — a botnet with 1000 IPs can make 5000 attempts per minute while each IP stays within limit.

**Layer 2 — Per-account sliding window (10 attempts per phone prefix per 15 min):**
The key is the phone number's last 6 digits — constant regardless of the attacker's IP. An attacker credential-stuffing with a list of phone numbers hits Layer 2 after 10 attempts per number per 15-minute window, across all IPs. IP rotation cannot bypass this layer because the rate limit key is not the IP.

**Layer 3 — Global platform ceiling (500 auth req/min):**
A hard cap on the total auth request rate across all users, all IPs. Protects against a distributed DDoS against the auth endpoints specifically — even if the attacker has enough IPs and phone numbers to stay under Layers 1 and 2 individually, the global ceiling caps total throughput.

**Alternative considered — single adaptive rate limiter:**
A rate limiter that adjusts its threshold based on observed traffic patterns (higher threshold during business hours, lower during off-hours). More sophisticated but significantly more complex to implement correctly, tune, and operate. The three fixed-layer approach is auditable — the thresholds are constants, the behavior is predictable.

**What the three layers do not protect against:**
A sustained distributed credential stuffing attack with a large enough phone number list and enough IPs to stay under all three layers simultaneously. At 500 auth req/min global ceiling, an attacker with 50 phones and 100 IPs would exhaust their per-account quota in 15 minutes and need to wait. This is friction, not a hard stop. A truly determined attacker with real stolen credentials is a different threat model (requires additional signals — device fingerprinting, behavioral analysis) that is out of scope at current scale.

---

## 8. Webhook Processing — Idempotency Under Concurrency

### Why the webhook always returns 200

Razorpay retries webhook delivery on any non-200 response. If the handler returns `400` (invalid signature), `500` (processing error), or times out, Razorpay retries — typically at 1 minute, 5 minutes, 30 minutes intervals. A handler that returns non-200 on invalid signatures would cause Razorpay to retry invalid requests indefinitely, flooding logs with noise and potentially triggering Razorpay's retry exhaustion behavior.

The correct behavior: always return `200`. Log invalid signatures at warning level. Do not process. Do not retry. The `200` tells Razorpay "received, handled." What the handler did with the event is internal.

### Why HMAC verification uses timingSafeEqual

String comparison in most languages short-circuits — it returns `false` at the first differing character. If an attacker submits requests with known partial signatures, they can measure response time differences to determine which characters are correct — a timing attack that recovers the full signature character by character.

`crypto.timingSafeEqual()` always takes the same time regardless of where the mismatch occurs. It compares all bytes before returning. The response time leaks no information about signature correctness.

### The idempotency mechanism under concurrent delivery

Razorpay occasionally delivers the same event twice in rapid succession — during its own failover, during retry races, or when the handler returns `200` but the acknowledgment is lost on the network. The idempotency requirement: 100 concurrent identical deliveries must produce exactly one database write.

The mechanism:

```typescript
// Inside a $transaction:
await tx.webhookLog.create({
  data: { razorpayPaymentId, event, processedAt: new Date() }
  // razorpayPaymentId has @unique constraint
});
// If this succeeds, proceed with payment + state update.
// If this throws P2002 (unique constraint), this is a duplicate — return 200 silently.
```

The `@unique` constraint on `WebhookLog.razorpayPaymentId` means that concurrent inserts with the same payment ID race at the database level. Postgres enforces the constraint — exactly one insert succeeds, all others fail with `P2002`. The transaction for the failing inserts rolls back. The payment and SubOrder update only execute once — inside the transaction of the winning insert.

**Alternative considered — application-level duplicate check:**
`findFirst` before insert. If found, return early. The problem: between the `findFirst` and the `create`, another concurrent handler can also pass the `findFirst` check and proceed to insert. Both proceed, both update the Payment and SubOrder, the second update either fails on the SubOrder state machine (if the first already transitioned) or succeeds — producing a second Payment row for the same payment. The `@unique` constraint eliminates this race because the constraint is enforced atomically at the DB level.

---

## 9. Reconciliation — Financial Ledger Integrity

### The ledger model

Every payment event in Kridha produces a `Payment` row:

- Advance captured: `type: ADVANCE, status: PAID, razorpayPaymentId: pay_xxx`
- Remaining paid: `type: REMAINING, status: PAID, razorpayPaymentId: pay_yyy`
- Refund initiated: `Refund` row, `status: INITIATED`
- Refund processed: `Refund.status` updated to `PROCESSED` via `refund.processed` webhook
- Payout: `Payout` row created after `COMPLETED` SubOrder payout transfer

The ledger is append-only in practice. No Payment row is deleted. No amount is modified after creation. The source of truth for "what was paid" is the `Payment` table, verified against Razorpay's dashboard on reconciliation.

### Why refund amounts are server-side only

`calcRefundAmount(advanceAmount, pickupDeadline, cancelledBy)` in `src/lib/refund.ts`. The client never sends `refundAmount` in a cancellation request. If it did, a buyer could cancel and claim a 100% refund regardless of the cancellation timing — or a seller could cancel and claim the advance without penalty.

The refund tiers use `SubOrder.pickupDeadline` — a column stored at order creation time from `pickupWindow.endTime` and `pickupDate`. It is not computed at cancellation time. This matters because if the calculation used `NOW() + window.endTime`, a system clock issue or a delayed cancellation request could produce different refund amounts than expected. The deadline is fixed at order creation and cannot be changed after the fact.

### Why the payout cron reads from the DB, not from Razorpay

The payout cron (`GET /api/cron/transfer-advances`) finds SubOrders where `status = COMPLETED AND NOT EXISTS (SELECT 1 FROM Payout WHERE subOrderId = ?)`. It reads completed orders that have not yet been paid out. It does not query Razorpay to find payments — the Razorpay payment reference is already stored on the `Payment` row.

If the payout cron were to query Razorpay for what to pay out, a Razorpay API failure would block all payouts. By reading from the DB, the payout cron only depends on Postgres availability. Razorpay is queried only to initiate the transfer — once, per SubOrder, not to determine what transfers are due.

---

## 10. Observability — What Gets Logged and Why

### Structured logging over console.log

`console.log` writes an unstructured string. It cannot be queried. It cannot be filtered. It cannot be correlated across requests. A production incident involving multiple concurrent requests produces interleaved `console.log` output with no way to associate a log line with the specific request that generated it.

Pino writes structured JSON. Every log line from a route handler includes `requestId` (a UUID generated per request in `withLogger`), `userId` (if authenticated), `action` (the handler's semantic intent), `method`, `path`, `status`, and `ms`. A production incident can be investigated by filtering `WHERE requestId = 'abc-123'` to see every log line from that specific request, in order.

### What gets redacted and why

14 fields are redacted before any log write: `pin`, `otp`, `deliveryOtp`, `refreshToken`, `kridha_refresh` header, `accountNumber`, `ifscCode`, `panNumber`, `razorpayKeySecret`, `webhookSecret`, `adminJwtSecret`, `encryptionKey`, `cloudinaryApiSecret`, `cronSecret`.

These fields appear in request bodies, response bodies, and internal data structures that are logged for debugging. If any of these appeared in log storage, they would represent a credential leak — PIN could enable account takeover, bank details could enable fraud.

The redaction is configured at the Pino logger level using `redact: { paths: [...], censor: '[REDACTED]' }`. The redaction happens before the log line is serialized — the field value never appears in the output buffer.

### What GlitchTip captures versus what Pino captures

**Pino** captures structured request context — what happened, when, how long it took, what user was involved. It is the operational record. Every request gets a log line regardless of whether an error occurred.

**GlitchTip** captures exceptions and security events — what went wrong, with a stack trace and request context. Not every request produces a GlitchTip event. Only:
- Unhandled exceptions in route handlers (5xx errors)
- Token reuse detection (`security.token_theft`)
- Credential stuffing suspicion (`security.credential_stuffing`)
- IP change on refresh (`security.ip_change_on_refresh`)
- Rate limit violations (`security.rate_limited_account`)

GlitchTip is for alerting — it sends email on new error types. Pino is for investigation — it provides the raw data. They serve different functions and are not interchangeable.

### Why Upptime checks `/api/health` not a functional endpoint

A functional endpoint like `/api/products` runs PostGIS queries, hits Redis, and touches the Prisma connection pool. If Upptime checks this endpoint every 5 minutes, it consumes 12 product feed queries per hour just for uptime monitoring. On Supabase free tier, connection slots are limited. Uptime monitoring should not compete with real user traffic for DB connections.

The shallow health endpoint returns `{ status: "ok" }` without a DB query. It confirms only that the Vercel function is alive and responding. A deep health check at `/api/health/deep` (not monitored automatically) hits the DB and confirms database connectivity — used manually during incident investigation, not by Upptime.

---

## 11. Scaling Constraints — Honest Analysis

### What breaks first at 500 concurrent users

**Supabase free tier connection limit (60 connections, pg.Pool max=15):**
At 500 concurrent users with varied request timing, the pool of 15 connections becomes the binding constraint. Requests queue waiting for an available connection. The `connectionTimeoutMillis: 5000` setting means connections wait up to 5 seconds before failing. At 500 concurrent users, connection wait time dominates latency.

**Mitigation at this scale:** Supabase Pro ($25/month) raises the connection limit and enables PgBouncer in transaction mode — multiplexes thousands of application connections over 50–100 real Postgres connections. This extends the ceiling by ~10x.

### What breaks second at 500 concurrent users

**Vercel serverless cold starts under burst traffic:**
Vercel spins up new function instances under load. Each cold start takes 200–800ms. A burst of 500 requests hitting a previously quiet deployment causes a wave of cold starts before the pool of warm instances stabilizes. During this window, P99 latency spikes.

**Mitigation at this scale:** Vercel Pro reduces cold start frequency. A persistent server (Railway, Render) eliminates cold starts entirely at the cost of operational complexity and fixed monthly cost.

### What breaks at 1000 concurrent users

**Lazy expiry concurrent sweeps:**
`releaseAllExpiredPendingOrders()` is called fire-and-forget on every product feed request. At 1000 concurrent product feed requests, up to 1000 concurrent expiry sweeps run. Each sweep does a `findMany` + multiple `$transaction` calls. At this scale, expiry sweeps compete aggressively with real user traffic for Postgres connections.

**Mitigation:** Redis-based distributed lock — `SET expire-orders-running 1 EX 30 NX`. Only one expiry sweep runs per 30 seconds. All other concurrent calls see the lock and skip. This is a 2-line addition to `expiry.ts` and should be added before the system reaches 500 concurrent users.

**BullMQ requirement:**
Notification delivery, payout processing, and expiry sweeps should move to BullMQ workers on a persistent process (Railway). The synchronous execution of these operations inside request handlers is appropriate for low volume but creates backpressure at high volume. At 1000 users, a slow notification delivery blocks the checkout response.

### What does not break at 1000 users

**The state machine.** Pure in-memory computation with no DB queries. Scales linearly.

**The idempotency mechanism.** The `@unique` constraint is enforced at the Postgres index level — it scales with the database, not with application concurrency.

**The rate limiter.** Upstash Redis handles thousands of operations per second. Rate limiting is not the bottleneck.

**The auth layer.** JWT verification is in-memory computation (HMAC-SHA256). Cookie parsing is trivial. Authentication does not scale with DB or Redis capacity.

---

*For implementation specifics, see the inline comments in `src/services/order.service.ts`, `src/lib/state-machine.ts`, `src/lib/redis.ts`, and `src/app/api/webhooks/razorpay/route.ts`.*

*For financial reconciliation details, see `src/lib/refund.ts` and `src/lib/pricing.ts`.*

*For security threat model per control, see [SECURITY.md](./SECURITY.md).*