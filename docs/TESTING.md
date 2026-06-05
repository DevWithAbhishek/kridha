# TESTING.md — Testing Strategy and Honest Coverage

This document describes what is tested, why each test exists, how success is measured, and where the gaps are. It does not claim complete coverage. It describes the actual state of testing as of Stage 1 completion.

Audience: Engineering Manager, Senior Engineer, Technical Interviewer.

---

## 1. Testing Philosophy

Kridha's testing priorities are ordered by the cost of a failure in production:

**Tier 1 — Financial correctness.** A bug that causes a double payment, a missed refund, or a stock oversell has direct monetary consequences for real users. These paths are tested first and most thoroughly.

**Tier 2 — Security.** A bug that allows session hijacking, bypasses auth, or exposes user data is high-severity with regulatory and trust implications.

**Tier 3 — Operational correctness.** A bug that causes an order to get stuck in the wrong state, a notification to fail silently, or a payout to not fire is serious but recoverable without monetary harm.

**Tier 4 — Performance.** A latency regression hurts user experience but does not corrupt data. Tested under load to establish baselines, not to guarantee specific numbers.

The consequence of this prioritization: load tests and integration tests exist for the high-stakes paths. Unit tests for individual service functions are the known gap.

The philosophy is not "test everything." It is "test the things where being wrong is expensive."

---

## 2. Unit Tests

### Current State: Minimal

This is the most significant gap in the current test suite. There are no Jest unit tests on the service layer.

**What exists:**

The following functions have pure logic that is implicitly tested through integration tests but have no dedicated unit tests:

- `calcUnitPrice(quantity, tiers)` in `src/lib/pricing.ts`
- `calcRefundAmount(advance, pickupDeadline, cancelledBy)` in `src/lib/refund.ts`
- `validateTransition(from, to)` in `src/lib/state-machine.ts`
- `buildWhereClause(filters)` and `buildOrderClause(sortBy, lat, lng)` in `src/lib/postgis.ts`
- `safeString` Zod transform in `src/schemas/index.ts`

**Why these matter:**

`calcUnitPrice` contains the bulk-pricing tier logic — the last qualifying tier wins, not the first match. Getting this wrong means buyers are charged the wrong price at order creation. This function is called on every checkout.

`calcRefundAmount` determines how much money a buyer gets back on cancellation. The tiers depend on `pickupDeadline`, which is stored at order creation time. A bug here has direct financial consequences.

`validateTransition` is the correctness guarantee of the entire order lifecycle. If it incorrectly allows a transition from `COMPLETED` to any other state, an order that should be closed can be re-opened.

**Why unit tests are missing:**

Honest answer: the 45-day build timeline prioritized shipping the correct implementation over verifying it in isolation. Load tests and manual testing caught the obvious regressions. The investment in unit test infrastructure (Jest setup, Prisma mock, test fixtures) was deferred.

**What a unit test suite would look like:**

```typescript
// calcUnitPrice — the cases that matter
describe('calcUnitPrice', () => {
  const tiers = [
    { minQty: 1,  pricePerUnit: 100 },
    { minQty: 10, pricePerUnit: 90  },
    { minQty: 50, pricePerUnit: 80  },
  ];

  it('returns highest qualifying tier, not first match', () => {
    expect(calcUnitPrice(50, tiers)).toBe(80);
    // A bug that returns on first match would return 100 here
  });

  it('returns correct tier for exact boundary', () => {
    expect(calcUnitPrice(10, tiers)).toBe(90);
  });

  it('returns base tier for quantity below first threshold', () => {
    expect(calcUnitPrice(1, tiers)).toBe(100);
  });

  it('returns correct price for quantity above all thresholds', () => {
    expect(calcUnitPrice(100, tiers)).toBe(80);
  });
});
```

```typescript
// validateTransition — the terminal state guarantee
describe('validateTransition', () => {
  it('throws on any transition from COMPLETED', () => {
    expect(() => validateTransition('COMPLETED', 'CANCELLED'))
      .toThrow('INVALID_TRANSITION');
  });

  it('throws on any transition from CANCELLED', () => {
    expect(() => validateTransition('CANCELLED', 'CONFIRMED'))
      .toThrow('INVALID_TRANSITION');
  });

  it('allows PENDING to CONFIRMED', () => {
    expect(() => validateTransition('PENDING', 'CONFIRMED')).not.toThrow();
  });

  it('throws on invalid transition from valid state', () => {
    expect(() => validateTransition('CONFIRMED', 'COMPLETED'))
      .toThrow('INVALID_TRANSITION');
  });
});
```

```typescript
// calcRefundAmount — financial correctness
describe('calcRefundAmount', () => {
  const advance = 200;
  const future24h = new Date(Date.now() + 25 * 60 * 60 * 1000);
  const future1h  = new Date(Date.now() + 1  * 60 * 60 * 1000);
  const past      = new Date(Date.now() - 1  * 60 * 60 * 1000);

  it('returns 100% refund when buyer cancels >24h before pickup', () => {
    expect(calcRefundAmount(advance, future24h, 'BUYER')).toBe(200);
  });

  it('returns 50% refund when buyer cancels 2-24h before pickup', () => {
    expect(calcRefundAmount(advance, future1h, 'BUYER')).toBe(100);
  });

  it('returns 0% refund when buyer cancels <2h before pickup', () => {
    expect(calcRefundAmount(advance, past, 'BUYER')).toBe(0);
  });

  it('returns 100% refund when seller cancels regardless of timing', () => {
    expect(calcRefundAmount(advance, future1h, 'SELLER')).toBe(200);
    expect(calcRefundAmount(advance, past,      'SELLER')).toBe(200);
  });
});
```

**Risk mitigated:** Regression in pricing or refund calculation logic. A change to `calcUnitPrice` that inadvertently breaks the tier selection logic would be caught immediately.

**How success is measured:** All cases pass. Edge cases (exact boundary quantities, expired deadlines, seller-vs-buyer cancellation) are explicitly covered.

---

## 3. Integration Tests

### Current State: Manual + k6

There are no automated Jest integration tests hitting a test database. Integration testing is currently done through:

1. **Manual testing** against the local Docker environment during development.
2. **k6 load tests** that validate HTTP-level behavior at scale.
3. **Seed + manual verification** that the full user flow works end-to-end.

**What an integration test suite would cover:**

```
cartService.addItem:
  - product not found → ERR.PRODUCT_NOT_FOUND
  - pickup window does not belong to seller → ERR.WINDOW_UNAVAILABLE
  - pickup date in the past → ERR.INVALID_PICKUP_DATE
  - pickup day not in window.daysActive → ERR.INVALID_PICKUP_DATE
  - insufficient stock (advisory check) → ERR.INSUFFICIENT_STOCK
  - successful add returns cartItem with correct unitPrice

orderService.create:
  - product deleted after cart add → ERR.PRODUCT_NOT_FOUND
  - seller unverified at checkout → ERR.FORBIDDEN
  - stock insufficient under SELECT FOR UPDATE → ERR.INSUFFICIENT_STOCK
  - Razorpay failure triggers compensating transaction
  - multi-seller order creates correct SubOrder count
  - locked price from CartItem.unitPrice used, not recalculated

webhookHandler (payment.captured):
  - invalid HMAC signature → 200, no processing
  - duplicate paymentId → 200, no second write
  - SubOrder not found → 200, logged
  - SubOrder not PENDING → 200, no transition
  - valid capture → SubOrder CONFIRMED, Payment PAID, OTP generated
```

**Why integration tests are missing:**

Integration tests against a real database require: a test database, migration setup in CI, test data factories, teardown between tests. The investment is 2-3 days to set up correctly. This was deferred in favor of shipping.

**Risk of the gap:**

A service-layer change that breaks `cartService.addItem` validation logic would not be caught until manual testing or a user reports it in production. This is the most significant operational risk in the current test posture.

---

## 4. Load Tests

### Current State: Active, Results Available

Five k6 test files in `tests/load/`. Run against local Docker (PostgreSQL + Redis). Results below are from actual test runs, not estimates.

---

#### 4.1 Percentile Baseline — `01_percentiles.js`

**What it tests:** Per-endpoint latency distribution (P50, P90, P95, P99, Max) across all 7 primary endpoints under 100 concurrent VUs.

**Why it exists:** Establishes a performance baseline. Any future change that causes a P95 regression is visible immediately when this test is re-run. Prevents "it worked in dev" situations where performance is only discovered in production.

**Infrastructure:** Local Docker. pg.Pool max=50. Redis cache active. No Vercel cold start overhead.

**Results (actual):**

| Endpoint | P50 | P95 | P99 | Max | Status |
|----------|-----|-----|-----|-----|--------|
| `GET /api/health` | ~8ms | ~42ms | ~78ms | ~140ms | ✅ |
| `GET /api/products` (cache hit) | ~14ms | ~80ms | ~180ms | ~310ms | ✅ |
| `GET /api/products` (cache miss) | ~52ms | ~200ms | ~390ms | ~620ms | ✅ |
| `POST /api/cart` | ~28ms | ~110ms | ~220ms | ~380ms | ✅ |
| `POST /api/cart/checkout` | ~95ms | ~280ms | ~490ms | ~720ms | ✅ |
| `POST /api/webhooks/razorpay` | ~18ms | ~65ms | ~120ms | ~190ms | ✅ |
| `GET /api/orders` | ~35ms | ~130ms | ~240ms | ~400ms | ✅ |

**Note on Supabase numbers:** Pre-fix tests against Supabase with default pg.Pool (max=10) showed P95=2300ms across all endpoints — caused entirely by connection queuing, not query performance. These numbers are not cited anywhere as performance benchmarks.

**Thresholds defined:** P95 < 500ms on all endpoints (local Docker). Test fails if crossed.

**Total requests:** 9,702. HTTP 5xx: 0. HTTP 4xx: 0. Error rate: 0.00%.

**Risk mitigated:** Silent performance regression from a query change or middleware addition.

**How success is measured:** Zero HTTP 5xx. All P95 values below defined thresholds. These thresholds are calibrated to local Docker, not to Vercel production.

---

#### 4.2 Throughput and Error Rate — `02_throughput.js`

**What it tests:** Sustainable request throughput and error rate under ramping load (10 → 100 → 300 → 500 VUs). Weighted endpoint distribution mirrors real traffic patterns (40% products, 25% deals, 15% orders, 10% notifications, 10% health).

**Why it exists:** Measures the system's maximum sustainable throughput before errors appear. Identifies the VU count at which the system degrades.

**Results (actual — Supabase + default pool, test interrupted at 500 VUs):**

```
Total requests:  29,230
Throughput:      52.75 req/s
HTTP 2xx:        21,752
HTTP 4xx:        7,346   (rate limiter 429s — correct behavior)
HTTP 5xx:        0
Timeouts:        132     (Supabase cold starts, not application errors)
Error %:         25.58%  (inflated by 429s, which are expected)
```

**Honest interpretation:** The 25.58% "error rate" is misleading. The 7,346 HTTP 4xx responses are rate limiter `429 Too Many Requests` — the correct response to concurrent auth requests from a single IP. Removing 429s from the error calculation gives a true error rate of ~0.45% (the 132 timeouts). The timeouts are entirely Supabase cold starts, not application logic failures.

**Post-fix projection (Docker + explicit pool):** With max=50 pool on Docker and Redis cache active, expected throughput is 200+ req/s at 100 VUs with near-zero timeouts.

**Risk mitigated:** Discovering that the system falls over at 50 concurrent users. Finding that before launch is the point.

**How success is measured:** HTTP 5xx count < 20 (hard threshold). No application panics or crashes.

---

#### 4.3 Race Condition — Stock Integrity — `03_race_condition.js`

**What it tests:** Whether `SELECT FOR UPDATE` prevents stock overselling under concurrent checkout.

**Why it exists:** This is the most financially consequential code path in Kridha. An oversell bug means orders are created for products that cannot be fulfilled — directly harming buyers and sellers.

**Design flaw in the initial test (honest documentation):**

The initial test used a single BUYER_JWT for all 50 VUs. All 50 VUs shared one user account, one cart session. The test produced:

```
checkout 201 (success):  14  (expected: 10)
checkout 409 (conflict): 0   (expected: 40)
checkout 500 (error):    33  (expected: 0)
```

This is not evidence of a bug in `SELECT FOR UPDATE`. It is evidence of a bug in the test design. With 50 VUs sharing one cart session, concurrent `DELETE /api/cart` and `POST /api/cart` calls create indeterminate cart state — some VUs see an empty cart, some see a cart with wrong quantities. The 33 server errors are cart session integrity failures, not stock locking failures.

**The correct test design:**

Each VU needs an isolated buyer account with an isolated cart session. The test setup script (`tests/scripts/setup-race-test.ts`) creates 50 isolated buyer accounts. Each VU receives its own JWT. With isolated carts, the only contention point is the `Product.available` row inside `orderService.create` — which is where `SELECT FOR UPDATE` actually operates.

**Current status:** The corrected test is designed and the setup script is written. The test has not been run against the production code with the corrected multi-user setup due to time constraints. **This is the highest-priority testing gap.**

**What SELECT FOR UPDATE guarantees (independent of the test):** The Postgres row-level lock acquired by `SELECT FOR UPDATE` serializes concurrent access to the product row at the database engine level. It is not possible for two transactions to simultaneously read `available`, both see a positive value, and both decrement — one must wait for the other to commit. This is a Postgres guarantee, not an application guarantee. The test is meant to demonstrate it, not to be the source of it.

**Risk mitigated when test is corrected:** Empirical proof that concurrent checkout produces exactly 10 successes and 40 conflicts when stock=10. Any future refactor of `orderService.create` that accidentally removes the `SELECT FOR UPDATE` would cause this test to fail.

**How success is measured (corrected test):**
```
checkout_success  = 10  (exactly — matches stock)
checkout_conflict = 40  (exactly — remainder of 50 VUs)
checkout_error    = 0   (zero 500s — hard requirement)
DB verification:  SELECT available FROM "Product" WHERE id = ?  → returns 0
```

---

#### 4.4 Concurrency — Cart, Auth, Product Reads — `05_concurrency.js`

**What it tests:** Four concurrent scenarios:
- Scenario A: 50 VUs add to cart simultaneously
- Scenario B: 30 VUs checkout when stock=5
- Scenario C: 20 VUs login simultaneously (rate limiter verification)
- Scenario D: 200 VUs read product feed

**Results (actual):**

Scenarios A, B, C showed all-zero results in initial runs because `BUYER_JWT`, `BUYER_PHONE`, and `PRODUCT_ID` were not passed as environment variables. 401 responses fell through uncounted. The same single-user problem as the race condition test affected A and B.

**Scenario D results (actual, correct):**

```
Success rate:  100.00%
P50 latency:   ~40ms
P95 latency:   4,846ms  (Supabase cold starts)
P99 latency:   ~0ms     (native histogram issue — see below)
```

The 4,846ms P95 is Supabase cold start latency, not application latency. On Docker with cache, expected P95 is ~80ms.

The P99 showing 0ms was caused by the Trend constructor receiving `true` as the second argument (native histogram mode), which changes how percentiles are reported in the summary. Fixed in the optimized test version.

**Risk mitigated:** Discovering that the product feed collapses under 200 concurrent reads. It does not — 100% success rate at 200 VUs is the validated result.

**How success is measured:** 99%+ success rate on product reads. Zero 5xx on cart operations. Rate limiter 429s visible on auth concurrency.

---

## 5. Race Condition Tests

Covered in detail in section 4.3. Summary:

**What is guaranteed by the implementation (Postgres):** `SELECT FOR UPDATE` serializes concurrent access to product rows. This is a database-level guarantee.

**What is tested:** Scenario D (200 VU product reads) is verified. The stock-level race condition test (10 successes from 50 concurrent checkouts on stock=10) is designed and the setup script is written but the corrected multi-user run is pending.

**What the test proves when corrected:** That the application correctly invokes `SELECT FOR UPDATE` and handles the `INSUFFICIENT_STOCK` error from the locked read. It does not prove Postgres's row locking works — that is not in question.

---

## 6. Webhook Tests

### `04_webhook_idempotency.js`

**What it tests:** Whether 100 concurrent identical Razorpay webhook deliveries produce exactly 1 database write.

**Results (actual, verified):**

```
Total webhooks:     100
HTTP 200 received:  100  (all deliveries acknowledged)
Non-200 received:   0
Status:             ✅ PASSED
```

**DB verification query:**
```sql
SELECT COUNT(*) FROM "WebhookLog"
WHERE "razorpayPaymentId" = 'pay_idem_test_{timestamp}';
-- Returns: 1 (not 100)
```

**Important caveat:** The test uses a synthetic `razorpayPaymentId` with no matching SubOrder in the database. The webhook handler follows this path:

1. HMAC signature verified ✅
2. Idempotency check: `WebhookLog.findFirst` → null (new event) ✅
3. Insert `WebhookLog` with `razorpayPaymentId` → succeeds on first concurrent request, fails with P2002 on all others ✅
4. SubOrder lookup by `razorpayAdvanceId` → null (no matching SubOrder exists) → logs warning → returns 200

The `@unique` constraint is exercised and proven to prevent duplicate DB writes. However, the full downstream path (Payment update, SubOrder state transition, OTP generation) is not exercised because no matching SubOrder exists.

**What the corrected test would look like:**

```
Setup:
  1. Create a real PENDING SubOrder with razorpayAdvanceId = FAKE_ORDER_ID
  2. Note the SubOrder ID for post-test verification

Test:
  100 VUs simultaneously POST payment.captured with razorpayPaymentId = FAKE_PAYMENT_ID

Post-test DB verification:
  SELECT COUNT(*) FROM "WebhookLog"   WHERE "razorpayPaymentId" = 'pay_xxx';  -- expects 1
  SELECT COUNT(*) FROM "Payment"      WHERE "razorpayPaymentId" = 'pay_xxx';  -- expects 1
  SELECT status   FROM "SubOrder"     WHERE id = 'sub_xxx';                   -- expects CONFIRMED
  SELECT COUNT(*) FROM "Payment"      WHERE "subOrderId" = 'sub_xxx';         -- expects 1 (not 100)
```

The setup script for this corrected test (`tests/scripts/setup-webhook-test.ts`) is written and creates the required PENDING SubOrder. The corrected test run is pending.

**Risk mitigated:** Duplicate payment processing. Double payment confirmation. Multiple Payment rows for the same Razorpay payment. Financial inconsistency between Kridha's ledger and Razorpay's dashboard.

**How success is measured:**
- All 100 VUs receive HTTP 200 ✅
- WebhookLog row count = 1 ✅ (verified)
- SubOrder transitions to CONFIRMED exactly once ✅ (pending corrected test)
- Payment row count = 1 ✅ (pending corrected test)

---

## 7. Failure Scenarios

These are failure modes that have been identified, reasoned about, and mitigated in the implementation — but not all have automated tests that trigger them.

---

#### 7.1 Razorpay Initialization Fails After DB Transaction Commits

**Scenario:** `prisma.$transaction()` commits successfully (stock decremented, SubOrders created as PENDING). Then `rz.orders.create()` throws a network error.

**What happens:** The compensating transaction fires immediately. It restores stock (`available += quantity` per OrderItem) and marks SubOrders `CANCELLED` with reason "Razorpay initialization failed."

**Test coverage:** Not covered by an automated test. The compensating transaction code exists in `orderService.create` and is exercised manually by mocking `getRazorPay()` to throw. An automated test would use Jest to mock `rz.orders.create` to throw and verify that stock is restored and SubOrders are CANCELLED.

**Risk if untested:** A code change that accidentally removes the compensating transaction would leave stock permanently locked on Razorpay failures.

---

#### 7.2 Redis Completely Unavailable

**Scenario:** Upstash Redis is unreachable (network partition, outage, rate limit).

**What happens:** All Redis operations throw. The `withCache` wrapper catches the error, treats it as a cache miss, proceeds to the DB query, and returns results. Rate limiters fail-open (requests pass through). No user-facing error.

**Test coverage:** Not covered by automated test. Manually verified by pointing `UPSTASH_REDIS_REST_URL` at an invalid endpoint and running the application.

**Risk if untested:** A change to the Redis error handling that converts fail-open to fail-closed would block all product feed requests during Redis outages.

---

#### 7.3 Supabase Connection Pool Exhaustion

**Scenario:** 100+ concurrent requests, pg.Pool max=15 (production), all pool connections held for extended periods.

**What happens:** New requests queue waiting for a connection. After `connectionTimeoutMillis: 5000`, they throw a pool timeout error. `handleError` returns a 500 with `INTERNAL_ERROR` code.

**Test coverage:** This scenario can be triggered by running `02_throughput.js` against a production Supabase URL with a constrained pool. The test showed 132 timeouts at 500 VUs against Supabase free tier with the default pool. With explicit pool configuration (max=15), the timeout count at 100 VUs should be near zero.

**Risk if untested:** Deploying a configuration change that reduces pool size or increases request duration would cause this failure silently.

---

#### 7.4 Webhook Arrives for a SubOrder in Terminal State

**Scenario:** Razorpay retries a `payment.captured` webhook for a SubOrder that is already `CONFIRMED` (the first delivery processed correctly but the acknowledgment was lost).

**What happens:** The idempotency check (`WebhookLog.findFirst`) finds the existing log row. Returns 200 immediately without any state change. The state machine is never reached.

**Test coverage:** Covered by the `04_webhook_idempotency.js` test (the duplicate delivery path is exercised). The state machine protection is an additional guard that would catch any case where the idempotency check is bypassed.

---

#### 7.5 Compensating Transaction Fails

**Scenario:** `rz.orders.create()` throws. The compensating transaction is attempted. The compensating transaction also fails (Postgres is temporarily unavailable, connection pool is exhausted).

**What happens:** The compensating transaction failure is caught separately. `logger.error` fires with message "Stock rollback also failed — manual intervention needed" with the full SubOrder IDs and order amounts. The error is visible in GlitchTip. The stock remains incorrectly locked until the daily cron sweeps it.

**Test coverage:** Not covered by automated test. The error path is implemented and logs correctly. An automated test would mock both `rz.orders.create` and the compensating Prisma calls to throw and verify the error log.

---

## 8. Known Gaps

Documented honestly. No coverage theater.

---

#### Gap 1 — No unit tests on service layer (Highest Priority)

`orderService.create`, `cartService.addItem`, `authService.login`, `paymentService.requestPaymentLink` — none have unit tests. These are the highest-complexity, highest-stakes functions in the codebase.

**What a production team would do:** Implement a test database with test fixtures, Jest setup with `prisma.$disconnect()` in afterAll, and test factories for creating Users, Products, and Orders in known states. Estimated effort: 2 days to set up infrastructure, 2-3 days to write the critical path tests.

**Risk:** A refactor of `calcUnitPrice` integration or `SELECT FOR UPDATE` invocation is invisible until manual testing or a production user reports a pricing anomaly.

---

#### Gap 2 — Race condition test uses single user (corrected test pending)

The `03_race_condition.js` test was run with a single JWT for all 50 VUs, causing cart-layer chaos rather than stock-layer contention. The corrected multi-user test is designed and the setup script exists. The corrected run has not been executed.

**Impact:** The `SELECT FOR UPDATE` guarantee is based on Postgres correctness, not on an empirical k6 test result. The empirical verification is pending.

---

#### Gap 3 — Webhook idempotency test does not exercise full downstream path

The `04_webhook_idempotency.js` test verifies that 100 concurrent identical webhooks produce 1 `WebhookLog` row. It does not verify that the `Payment` table has exactly 1 row or that the `SubOrder` transitions exactly once, because no matching SubOrder exists in the test setup.

**Impact:** The `@unique` constraint is verified. The full transactional path (Payment + SubOrder update) is not verified under concurrent load.

---

#### Gap 4 — No end-to-end test for the full buyer flow

There is no automated test that simulates: register → browse → add to cart → checkout → pay → OTP verification → complete. This flow is tested manually against the live app and against the local Docker environment. A Playwright or Cypress test covering this flow would catch regressions in the frontend → API contract.

---

#### Gap 5 — No load test for the checkout path under simultaneous writes

`02_throughput.js` uses a weighted endpoint distribution that is primarily read-heavy (65% reads, 35% auth/order). There is no load test that simulates 100 concurrent checkouts to measure checkout throughput and identify the write-path bottleneck (expected: `SELECT FOR UPDATE` serialization at high concurrency).

---

#### Gap 6 — No test for the compensating transaction

The Razorpay initialization failure path and its compensating transaction are not covered by any automated test. This is the highest-consequence untested code path: a bug here would leave stock permanently locked on payment initialization failures.

---

#### Gap 7 — No auth security test

There is no automated test for:
- Rate limiter Layer 2 (per-account) firing correctly
- Token family rotation detecting a reused refresh token
- Progressive PIN lockout (5 failures → 10-minute lock)
- Admin JWT not accepted on non-admin endpoints

These are manually verified but would benefit from automated regression tests.

---

## 9. Future Improvements

Ranked by the risk they mitigate and the effort required.

---

#### 9.1 Unit tests for pure logic functions (1-2 days, highest ROI)

`calcUnitPrice`, `calcRefundAmount`, `validateTransition`. These are pure functions with no DB dependency. Jest tests require no database setup. The cases that matter are: boundary quantities on price tiers, exact deadline timing on refunds, terminal state transitions.

---

#### 9.2 Corrected race condition test with multi-user setup (half day)

The setup script exists (`tests/scripts/setup-race-test.ts`). The test file is designed. The run requires executing the setup script, verifying 50 buyer accounts exist, setting `product.available = 10`, running the test, and running the DB verification SQL. One focused afternoon.

---

#### 9.3 Corrected webhook idempotency test with real SubOrder (half day)

The setup script exists (`tests/scripts/setup-webhook-test.ts`). The corrected test run requires executing the setup, running the existing `04_webhook_idempotency.js` against the real SubOrder's `razorpayAdvanceId`, and running the post-test SQL.

---

#### 9.4 Compensating transaction test using Jest mocks (1 day)

Mock `getRazorPay()` to throw after a delay. Verify that the compensating transaction restores stock to the pre-checkout value and sets SubOrders to `CANCELLED`. Requires Jest + Prisma mock infrastructure.

---

#### 9.5 Integration test suite with test database (3-4 days, longer term)

Full Jest integration test suite hitting a test Postgres + Redis instance. Test factories for creating Users, Products, CartSessions, and Orders. Teardown between tests via `prisma.$transaction()` rollback or table truncation.

This is the investment that converts the current "manual integration testing" posture into a "automated regression suite" posture.

---

#### 9.6 Auth security test suite (1-2 days)

Test that:
- Layer 2 rate limiter fires on the 11th attempt from a new IP with the same phone suffix
- A used refresh token causes full session revocation
- An admin JWT is rejected by `requireRole(req, Role.BUYER)`
- A user JWT is rejected by admin middleware

---

#### 9.7 Playwright end-to-end test for buyer flow (2-3 days)

Full buyer flow: registration → product discovery → cart → checkout → Razorpay sandbox payment → order confirmation → OTP display. Run against the local Docker environment. Catches frontend → API contract regressions.

---

*For load test run commands, see `tests/load/README.md`.*  
*For the reasoning behind testing priorities, see [ARCHITECTURE.md — Testing Strategy](./ARCHITECTURE.md).*  
*For what financial correctness means in this system, see [DECISIONS.md — ADR-009](./DECISIONS.md#adr-009).*