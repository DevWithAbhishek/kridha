# DECISIONS.md — Kridha Architecture Decision Records

Ten decisions that shaped Kridha's backend. Each record explains the context that forced the decision, the alternatives that were evaluated and rejected, the consequences that followed, and the condition under which the decision would be revisited. Written for engineers who want to understand the reasoning, not just the outcome.

---

## Index

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](#adr-001--httponly-cookies-over-localstorage) | HttpOnly cookies over localStorage | Accepted |
| [ADR-002](#adr-002--token-family-rotation-over-simple-refresh-rotation) | Token family rotation over simple refresh rotation | Accepted |
| [ADR-003](#adr-003--postgresql-over-mongodb) | PostgreSQL over MongoDB | Accepted |
| [ADR-004](#adr-004--postgis-over-application-level-distance-math) | PostGIS over application-level distance math | Accepted |
| [ADR-005](#adr-005--pessimistic-locking-over-optimistic-locking) | Pessimistic locking over optimistic locking | Accepted |
| [ADR-006](#adr-006--lazy-expiry-over-frequent-cron) | Lazy expiry over frequent cron | Accepted |
| [ADR-007](#adr-007--ordersuborder-decomposition) | Order/SubOrder decomposition | Accepted |
| [ADR-008](#adr-008--redis-cache-aside-with-fail-open) | Redis cache-aside with fail-open | Accepted |
| [ADR-009](#adr-009--webhook-idempotency-via-unique-constraint) | Webhook idempotency via unique constraint | Accepted |
| [ADR-010](#adr-010--nextjs-api-routes-over-a-separate-backend) | Next.js API routes over a separate backend | Accepted |

---

## ADR-001 — HttpOnly Cookies over localStorage

**Status:** Accepted
**Date:** February 2026
**Decider:** Abhishek Kumar

---

### Context

Kridha's target user is a kirana owner in UP Tier-2, frequently accessing the platform on a shared Android device in a shop environment. Multiple family members or employees may use the same browser on the same device at different times. The auth token must survive page refreshes and tab closes, must not be readable by third-party JavaScript, and must not require a re-login at inconvenient moments (e.g. a buyer standing at a supplier's counter trying to show an OTP).

The standard Next.js auth tutorial pattern stores JWTs in `localStorage` and attaches them as `Authorization: Bearer` headers. This is the default choice for most tutorials and most junior implementations.

---

### Decision

Store the access JWT in an `HttpOnly; Secure; SameSite=Lax` cookie named `kridha_access`. Store the refresh JWT in an `HttpOnly; Secure; SameSite=Strict; Path=/api/auth` cookie named `kridha_refresh`. No token is ever sent in a response body. No token is ever readable by JavaScript.

---

### Alternatives Considered

**localStorage with Authorization header:**
The most common implementation pattern. Rejected because `localStorage` is readable by any JavaScript executing in the same origin. A single XSS vulnerability in any dependency — a date picker, a charting library, an image optimizer — silently exfiltrates the JWT. The user has no indication the token was stolen.

**In-memory storage (module-level variable):**
Eliminates XSS risk because the token is never written to any browser storage. The problem is persistence: a page refresh, tab close, or browser restart loses the token and forces the user to re-authenticate. For a kirana owner standing at a supplier's counter opening the OTP screen, a forced re-login at the wrong moment is a real UX failure for this user demographic.

**sessionStorage:**
Cleared on tab close. Same persistence problem as in-memory storage. Also readable by JavaScript, so the XSS vector remains.

---

### Consequences

**Positive:**
- XSS attacks cannot steal the access token. Any JavaScript on the page — including injected malicious scripts — cannot read `kridha_access`.
- The refresh token is scoped to `Path=/api/auth`. The browser never sends it to `/api/products` or `/api/orders`. A vulnerability in the product search endpoint cannot expose the refresh token.
- Tokens persist correctly across page refreshes and browser restarts.

**Negative:**
- CSRF protection is now required. HttpOnly cookies are sent automatically on any same-origin request, including cross-site requests that satisfy `SameSite=Lax`. Mutation endpoints use a double-submit CSRF token: a random value in a non-HttpOnly cookie, echoed in `X-CSRF-Token`, validated in middleware.
- Mobile native clients (React Native, planned Stage 2) cannot use browser cookie jars in the same way. They will need an explicit cookie-handling strategy or a parallel auth flow.

---

### Tradeoffs Accepted

Cookie auth trades CSRF surface for XSS resistance. On a shared-device user demographic where XSS from supply-chain compromise is the more realistic threat than a targeted CSRF attack, this is the correct trade. CSRF is mitigated by the double-submit mechanism; XSS resistance from HttpOnly is not mitigable by any application-layer mechanism.

---

### Revisit Trigger

When a React Native mobile client is introduced (Stage 2), evaluate whether a separate token-in-body flow for native clients, gated by `X-Client-Type: mobile` + a shared secret, is preferable to teaching the native client to manage cookies explicitly.

---

### Interview Questions This Enables

- "Why did you choose cookies over localStorage for JWT storage?"
- "What is an XSS attack and how does cookie-based auth mitigate it?"
- "If HttpOnly cookies prevent XSS token theft, what new attack surface do they introduce?"
- "How does your CSRF protection work? What is a double-submit cookie?"
- "Why is the refresh token scoped to `/api/auth` specifically?"

---

## ADR-002 — Token Family Rotation over Simple Refresh Rotation

**Status:** Accepted
**Date:** February 2026
**Decider:** Abhishek Kumar

---

### Context

Refresh token rotation (issuing a new refresh token on every use and invalidating the old one) is better than long-lived non-rotating refresh tokens. But simple rotation has a silent failure mode: if an attacker steals the refresh token and uses it before the legitimate user, the legitimate user's next attempt fails (their token is now invalid). They may attribute it to a session expiry, log in again, and the attacker's session continues undetected.

---

### Decision

Implement token family rotation. Each refresh token belongs to a family tracked in `UserSession`. When a refresh token is used, a new token is issued and the used token's hash becomes `parentHash`. If a token whose hash appears as a `parentHash` (already rotated) is presented again, the system detects this as reuse: it revokes all tokens in the family, fires a GlitchTip alert at fatal severity, and returns 401.

---

### Alternatives Considered

**Long-lived non-rotating refresh tokens:**
Simple to implement. A stolen token remains valid until expiry (7 days). Theft is never detected. Rejected.

**Simple rotation without family tracking:**
Issues a new refresh token on each use, invalidates the old one. Better than non-rotating. The silent failure mode: theft only triggers a visible problem for the legitimate user after the attacker has already used the token. No alert fires. No detection mechanism exists.

**Session-based auth (server-stored sessions, session ID in cookie):**
Eliminates stateless JWT complexity. Session validation requires a DB read on every authenticated request. With 61 endpoints and potentially high concurrent traffic, adding a DB read to every middleware check adds latency and connection pool pressure. JWTs allow stateless validation using the signing key alone.

---

### Consequences

**Positive:**
- Token theft is detectable at the moment the legitimate user next refreshes. Both parties are logged out simultaneously.
- The GlitchTip fatal alert on reuse gives the operator immediate visibility into active session theft attempts.

**Negative:**
- More complex client-side refresh logic. The `api.ts` interceptor must deduplicate concurrent refresh requests — if two API calls fail with 401 simultaneously, only one refresh should fire, and both callers should wait for its result. The queue-based deduplication (`isRefreshing` flag + `refreshQueue`) is implemented in `src/lib/api.ts`.
- The `UserSession` table grows over time with expired and revoked sessions that are never deleted. A retention sweep is deferred (see Known Limitations in DESIGN.md).

---

### Tradeoffs Accepted

Implementation complexity (client-side deduplication, server-side family management, session table growth) against security posture (detectable theft with immediate response). For a marketplace handling financial transactions, the security benefit justifies the complexity.

---

### Revisit Trigger

If the `UserSession` table growth becomes operationally significant (>10M rows), implement a weekly retention sweep that deletes sessions where `revokedAt < NOW() - 30 days` or `expiresAt < NOW() - 7 days`.

---

### Interview Questions This Enables

- "What is token family rotation and how does it differ from simple refresh token rotation?"
- "How do you detect a stolen refresh token?"
- "What happens when a user's refresh request is sent twice due to a slow network?"
- "Why do you revoke all sessions instead of just the stolen one when you detect reuse?"

---

## ADR-003 — PostgreSQL over MongoDB

**Status:** Accepted
**Date:** January 2026
**Decider:** Abhishek Kumar

---

### Context

Kridha's data is inherently relational: orders reference products reference sellers reference pickup windows. Financial integrity requires atomic multi-table writes. Location search requires spatial indexing. Several architecture discussions raised MongoDB for its flexible schema and horizontal write scaling.

---

### Decision

Use PostgreSQL 17 with PostGIS extension via Supabase. Use Prisma as the ORM with raw `$queryRaw` for spatial queries that Prisma cannot construct.

---

### Alternatives Considered

**MongoDB with Mongoose:**
MongoDB's document model allows embedding related data (order items inside an order document). At small scale this reduces join complexity. The problems for Kridha specifically:

1. **Transactions.** MongoDB multi-document transactions since 4.0 are significantly more complex to use correctly than Postgres ACID transactions. `SELECT FOR UPDATE` equivalent in MongoDB does not exist natively — optimistic locking with version fields is the standard pattern, which is unsuitable for hot-SKU inventory (see ADR-005).

2. **Spatial queries.** MongoDB has `$geoWithin` but PostGIS's `ST_DWithin` with a GIST index on a `geography` column is more mature, more accurate (WGS-84 ellipsoid vs flat geometry), and more controllable.

3. **Financial data.** MongoDB's `Double` type is floating-point. `0.1 + 0.2 = 0.30000000000000004`. PostgreSQL's `DECIMAL` type handles exact arithmetic. For monetary amounts, this is not optional.

4. **Schema enforcement.** MongoDB's flexible schema is a feature for exploratory data with unknown shape. Kridha's data model is well-defined. Schema flexibility creates the risk of missing fields, inconsistent types, and undetected data corruption that only surfaces at read time. Prisma schema generates TypeScript types — a schema mismatch is a compile error.

**PlanetScale (MySQL-compatible):**
Foreign key enforcement is emulated by default, not enforced by the engine. Kridha's correctness guarantees depend on FK enforcement at the DB level.

---

### Consequences

**Positive:**
- ACID transactions with native `SELECT FOR UPDATE` — essential for inventory management.
- PostGIS GIST index for O(log n) radius search.
- `DECIMAL` type for monetary amounts — exact arithmetic.
- `pg_trgm` GIN index for `ILIKE` product search without a separate search service.
- Schema enforcement at DB level drives TypeScript types via Prisma.

**Negative:**
- PostGIS spatial queries require raw SQL — Prisma cannot construct `ST_DWithin` predicates for `geography` columns. This adds a maintenance surface in `src/lib/postgis.ts`.
- Vertical scaling only (without read replicas). At high write volume, a single Postgres primary is the bottleneck.

---

### Tradeoffs Accepted

PostgreSQL's strict schema and ACID properties are features, not limitations, for a financial marketplace. MongoDB's horizontal scaling story is better at very large write volumes — but that scale requires infrastructure and complexity unjustified until write throughput is a proven bottleneck.

---

### Revisit Trigger

At 1M+ products with complex relevance-ranked text search requirements, evaluate OpenSearch/Elasticsearch for the search path specifically. The transactional and spatial capabilities remain in Postgres regardless.

---

### Interview Questions This Enables

- "Why did you choose PostgreSQL over MongoDB for this use case?"
- "What is ACID and which properties matter most for a payment system?"
- "Can you do atomic multi-document transactions in MongoDB? How does it compare to Postgres?"
- "What is the `NUMERIC` vs `DOUBLE` difference and why does it matter for money?"

---

## ADR-004 — PostGIS over Application-Level Distance Math

**Status:** Accepted
**Date:** January 2026
**Decider:** Abhishek Kumar

---

### Context

Product discovery requires finding all products within N km of the buyer's location, sorted by distance. The naive implementation computes distance in application code: load all products, compute Haversine distance per product, filter, sort. This does not scale beyond a few hundred products.

---

### Decision

Use PostgreSQL's PostGIS extension with a `geography(Point, 4326)` column and a GIST index. Use `ST_DWithin` for radius filtering and `<->` KNN operator for distance-ordered results. Use `prisma.$queryRaw` with `Prisma.sql` tagged templates for all spatial queries.

---

### Alternatives Considered

**Haversine in application code:**
Load all active products, compute `haversine(buyerLat, buyerLng, productLat, productLng)` per product, filter by radius, sort. Problems: O(n) computation per request regardless of result count; not indexable; inaccurate at India's latitudes (1° longitude ≈ 99km at 26°N, not a fixed distance).

**Bounding-box SQL filter (`WHERE ABS(lat - $lat) < delta`):**
Approximates a circle with a square. Not indexable via standard B-Tree indexes. Geometrically inaccurate (produces elliptical search regions). Rejected.

**Elasticsearch (self-hosted or Elastic Cloud):**
Handles both `geo_distance` filter and full-text search well. Problems at current scale: (1) separate service requiring sync from Postgres — every product write must propagate to Elasticsearch, introducing eventual consistency between DB and search index; (2) Elastic Cloud smallest tier ≈ $16/month, conflicting with ₹0/month infrastructure goal; (3) operational overhead (index mapping, reindexing) disproportionate to a solo-engineer build.

**Typesense or Meilisearch:**
Same category as Elasticsearch. Same sync-complexity and separate-service problems. Rejected for the same reasons.

---

### Consequences

**Positive:**
- Zero additional infrastructure. Search runs on the same Postgres instance as all other data.
- No sync complexity. Postgres is always the source of truth and the search index simultaneously.
- `ST_DWithin` with GIST index: O(log n) radius filtering. `<->` KNN operator: distance-ordered results without computing distance for every row.
- `pg_trgm` GIN index on `nameEn` and `nameHi` accelerates `ILIKE` text search from full table scan to GIN index lookup.

**Negative:**
- Text search relevance is basic. `ILIKE` matches substrings but has no stemming, synonym expansion, or relevance ranking. A search for "wheat flour" will not match "atta" (the Hindi equivalent used in product names).
- Both search capabilities share the same Postgres instance — a spike in search load is not isolated from write load.

---

### Tradeoffs Accepted

Zero-infrastructure, zero-sync-complexity benefit of PostGIS + pg_trgm outweighs basic relevance limitation at current product catalog scale. The synonym problem is a real known limitation (see DESIGN.md §26).

---

### Production Lesson

The `GENERATED ALWAYS AS` geography column rejected inserts via Prisma's default ORM path during seeding — Prisma's `product.create()` includes the `location` column in the INSERT, conflicting with the generated expression. Fixed with raw SQL via `DIRECT_URL`. The `COALESCE(p.location, ST_SetSRID(ST_MakePoint(...)))` guard in queries exists specifically for this: rows inserted before the fix still resolve correctly from raw `latitude`/`longitude` columns.

---

### Revisit Trigger

When product catalog exceeds ~500k products or when text search relevance becomes a measurable conversion problem (synonym matching, Hindi-English cross-search). At that point, introduce a search service (Typesense for low operational overhead, or OpenSearch for richer features) with a write-through sync from Postgres.

---

### Interview Questions This Enables

- "When would you use Elasticsearch over PostgreSQL for search?"
- "What is the tradeoff between a separate search service and using the database for search?"
- "How does a GIST index work for geospatial queries?"
- "What is the difference between `ST_DWithin` and a naive lat/lng bounding box filter?"
- "What is eventual consistency and when does it create problems in search?"

---

## ADR-005 — Pessimistic Locking over Optimistic Locking

**Status:** Accepted
**Date:** February 2026
**Decider:** Abhishek Kumar

---

### Context

Two buyers can simultaneously add the same product to their carts and proceed to checkout. Without concurrency control, both transactions read `available = 1`, both decrement, and `available` becomes `-1` — violating the `CHECK (available >= 0)` constraint and creating an order that cannot be fulfilled. This is the oversell problem.

---

### Decision

Use `SELECT FOR UPDATE` inside `prisma.$transaction()`. The transaction acquires a Postgres row-level write lock on the Product row before reading `available`. The second concurrent transaction waits for the first to commit, then reads the updated value.

---

### Alternatives Considered

**Optimistic locking with version counter:**
Each `Product` row has a `version: Int` column. To decrement stock:
```sql
UPDATE "Product" SET available = available - N, version = version + 1
WHERE id = $id AND version = $currentVersion AND available >= N
```
If the update affects 0 rows (another transaction changed `version` first), the application detects the failure and retries.

Rejected for Kridha's use case. Hot SKUs are highly contested — a mill selling the last 50 kg of Mustard Oil at market close may have 15–20 buyers checking out simultaneously. Under optimistic locking, 14 of 15 transactions fail their version check on the first attempt. Each retry re-reads the row and retries. Under high contention, most retries fail again. The retry storm produces exponentially worse tail latency under exactly the conditions where correct behavior matters most.

**Redis-based distributed lock (`SET NX EX`):**
Before decrementing stock, acquire `SET product:{id}:lock 1 EX 5 NX`. If the SET fails, the lock is held — wait or fail. If it succeeds, proceed with the DB update, then `DEL product:{id}:lock`.

Rejected because: (1) Redis failure means no lock can be acquired — all concurrent checkouts for locked products fail; (2) if the DB update takes longer than the lock TTL (5s), the lock expires while the transaction is still running — two transactions can now simultaneously hold the "lock"; (3) Postgres row locks are enforced by the transaction engine and released atomically on commit or rollback. Redis locks require explicit release and are advisory.

---

### Consequences

**Positive:**
- Exactly one transaction modifies the stock row at a time. The second waits — it does not fail and retry.
- No application-level retry logic. The result is deterministic: succeed or fail, never "retry and hope."
- Lock is held only for the duration of the transaction. Postgres releases it automatically on commit, rollback, or client disconnect.

**Negative:**
- Lock contention directly impacts throughput. If 50 buyers are checking out the same product simultaneously, they serialize through the lock. Throughput for that product is bounded by how fast a single transaction can complete.
- A slow transaction (e.g., slow subsequent API call) would block all concurrent checkout transactions for that product. Mitigation: the Razorpay call happens *after* the Postgres transaction commits — the lock is never held while waiting for an external API.

---

### Tradeoffs Accepted

For a marketplace with hot SKUs where "first come, first served" is the correct semantics, pessimistic locking is the right choice. The throughput ceiling is bounded by real-world pickup capacity — a mill that can process 20 orders per day cannot generate 50 concurrent checkouts of the same product under realistic conditions.

---

### Deadlock Prevention

Stock decrements are grouped and locked in consistent order (by productId, ascending) within a transaction. Consistent lock ordering eliminates the circular dependency that causes deadlocks. Postgres detects and resolves deadlocks when they occur by killing one transaction — the service wraps this as `INTERNAL_ERROR`.

---

### Revisit Trigger

At very high write concurrency on the same SKU (>100 concurrent checkouts on a single product), consider decoupling inventory into a separate `Inventory` table with finer-grained locking, allowing product metadata to be read-cached while inventory rows are write-locked.

---

### Interview Questions This Enables

- "What is the difference between optimistic and pessimistic locking?"
- "When would optimistic locking perform better than pessimistic locking?"
- "What is a retry storm and why does it happen with optimistic locking under high contention?"
- "What happens if the Postgres client disconnects while holding a SELECT FOR UPDATE lock?"
- "Why can't you use a Redis SETNX lock to solve the oversell problem reliably?"

---

## ADR-006 — Lazy Expiry over Frequent Cron

**Status:** Accepted
**Date:** March 2026
**Decider:** Abhishek Kumar

---

### Context

When a buyer creates an order, stock is decremented immediately. The buyer has 15 minutes to pay the advance. If the advance is never paid, the SubOrder should transition to CANCELLED and stock should be restored. The naive implementation is a cron job running every 5–15 minutes sweeping for expired PENDING orders.

Vercel Hobby allows exactly one cron execution per day. A frequent cron is architecturally impossible on the current infrastructure.

---

### Decision

Release expired stock lazily — triggered on the next relevant API request rather than on a timer:
1. `productRepo.findNearby` calls `releaseAllExpiredPendingOrders()` (fire-and-forget) before computing `available` counts.
2. `cartService.addItem` calls `releaseExpiredHoldsForProduct(productId)` before the advisory stock check.
3. `GET /api/orders/[id]/advance` returns `410 Gone` if the payment window has expired.
4. A single daily cron at 2 AM sweeps anything the lazy release missed.

---

### Alternatives Considered

**Frequent cron (every 5 minutes):**
Not possible on Vercel Hobby. Would be the correct approach on infrastructure that supports it.

**BullMQ delayed jobs:**
At order creation, schedule a BullMQ job to run in 15 minutes. If the advance is not paid, the job cancels the order and releases stock. Architecturally clean. Requires a persistent worker process (Railway, Render) — not available on the current ₹0/month infrastructure. Planned for Stage 2.

**Redis TTL-based expiry:**
Store the `subOrderId` as a Redis key with a 15-minute TTL. On key expiry, a Redis keyspace notification fires, triggering stock release. Problems: keyspace notifications are advisory, not transactional. A Redis restart or configuration issue silently drops expiry events. Stock would remain locked indefinitely with no detection mechanism.

**Client-initiated expiry:**
The frontend detects the 15-minute window and calls an expiry endpoint. The client cannot be trusted to call this endpoint. A buyer with a pending order might not use the app for 24 hours.

---

### Consequences

**Positive:**
- Zero additional infrastructure or cost.
- Stock release is demand-driven: it happens when another buyer looks at the same products — exactly when accurate availability matters most.
- The correctness guarantee is maintained: `releaseAllExpiredPendingOrders()` runs before `available` counts are shown.

**Negative:**
- Stock is not released instantaneously after the 15-minute window expires. It is released on the next product feed request. In a low-traffic period, a product's stock might remain locked until the daily cron runs.
- `releaseAllExpiredPendingOrders()` is called on every product feed request. Under high concurrent load, multiple instances run simultaneously. A Redis distributed lock (`SET NX EX 30`) would prevent concurrent sweeps — not yet applied (see Known Limitations).

---

### Tradeoffs Accepted

The lazy expiry approach converts "when does stock release?" into "when does the next buyer browse?". For Kridha's B2B use case where orders are placed during business hours, the next browse event for a popular product is typically within minutes of the expiry window.

---

### Revisit Trigger

When infrastructure moves to Railway or a persistent server: replace lazy expiry with BullMQ delayed jobs scheduled at order creation. Lazy expiry becomes a safety net, not the primary mechanism.

---

### Interview Questions This Enables

- "How do you release inventory locks when a payment never arrives?"
- "What are the tradeoffs between cron-based and event-driven stock expiry?"
- "Why is Redis keyspace notification unreliable for critical stock release events?"
- "How would you change this architecture if you had persistent infrastructure?"
- "What is the worst-case stock lock duration with your current implementation?"

---

## ADR-007 — Order/SubOrder Decomposition

**Status:** Accepted
**Date:** January 2026
**Decider:** Abhishek Kumar

---

### Context

Kridha supports multi-seller checkouts. A buyer adds products from three different sellers and checks out once. The checkout must produce: one atomic payment event (Razorpay processes one advance covering all sellers) and three independent fulfillment contracts (each seller manages their own pickup window, OTP, payment link, and payout).

---

### Decision

Decompose into two levels: `Order` (financial unit — one per checkout, holds the Razorpay reference, no status) and `SubOrder` (per-seller contract — one per seller per checkout, independent state machine, OTP, payment link, payout, and cancellation).

---

### Alternatives Considered

**Single `Order` table with seller-specific JSONB columns:**
`Order.sellers: [{sellerId, status, items, otp}]`. Simpler schema. Problems: JSONB fields cannot be indexed for queries that matter — `WHERE sellerId = ?` to find a seller's incoming orders requires a JSONB extraction scan; state machine enforcement on array elements requires application-level guards; `WHERE status = PENDING AND createdAt < cutoff` for expiry sweeps requires per-element extraction.

**Flat `Order` with numbered seller columns (`seller1Id`, `seller1Status`, ...):**
Breaks at any number of sellers beyond the hardcoded maximum. Schema migration required to support more sellers per order. Rejected immediately.

**Separate `SellerOrder` table:**
Essentially the SubOrder model under a different name. The distinction from the chosen design is minimal — this is the SubOrder model described differently.

---

### Consequences

**Positive:**
- Seller A cancelling sets `SubOrder[A].status = CANCELLED`. `SubOrder[B]` is unaffected.
- Per-seller payout calculation is natural: `payout = SubOrder.totalAmount - SubOrder.platformFee`.
- Per-seller state machine is isolated. `SubOrder[A]` transitioning to `AWAITING_PAYMENT` does not affect `SubOrder[B].status`.
- Stock locking is per-seller group — Seller A's `SELECT FOR UPDATE` does not block Seller B's concurrent checkout on different product rows.

**Negative:**
- Join complexity. Any query needing order + suborder data requires a join. `orderRepo.findSubOrderById` joins across 5 tables.
- The overall "order status" is derived (not stored) — requires aggregating SubOrder statuses on every read.

---

### Tradeoffs Accepted

Join complexity in the data access layer in exchange for operational independence between sellers. Join complexity is in the repository layer (the correct place for it). Business logic (services) sees clean domain objects.

---

### Revisit Trigger

If the derived order status aggregation becomes a performance issue at scale, add a Postgres trigger maintaining a denormalized `Order.derivedStatus` column, updated whenever any `SubOrder.status` changes.

---

### Interview Questions This Enables

- "How do you model a multi-seller checkout in a database?"
- "Why doesn't a single Order table work for independent seller fulfillment?"
- "How do you calculate the 'overall status' of an order when each seller has an independent state?"
- "How does your stock locking work when a buyer orders from multiple sellers at once?"
- "Walk me through what happens when Seller A cancels but Seller B doesn't."

---

## ADR-008 — Redis Cache-Aside with Fail-Open

**Status:** Accepted
**Date:** February 2026
**Decider:** Abhishek Kumar

---

### Context

The product search endpoint (`GET /api/products`) runs a PostGIS radius query with 5-table joins. Under concurrent load, running this query on every request saturates the Postgres connection pool. Most product feed requests at steady state have nearly identical parameters (same city, same radius, same page).

---

### Decision

Cache product feed results in Redis using cache-aside (lazy loading) with a 60s TTL. Key includes lat/lng rounded to 3 decimal places (~111m precision). All cache operations are fail-open — a Redis error is a cache miss, never a request failure.

---

### Alternatives Considered

**No cache:**
Every request hits Postgres. Under concurrent load this saturates the free-tier connection pool (60 connections). Not viable above moderate traffic.

**Write-through cache:**
On every product write, update both the DB and the cache simultaneously. Cache key invalidation for product listings is complex — a product listing key encodes lat/lng, radius, and filters; when a product is updated, all listing keys containing it must be invalidated. Write-through does not simplify this problem; it adds the complexity of keeping two stores in sync on every write without solving the listing-key explosion.

**Read-through cache (cache as primary read path):**
Application reads only from cache; cache populates itself from DB on miss. Redis is not a durable store — data can be evicted under memory pressure. Making Redis the primary read path risks serving stale data after eviction with no DB fallback.

**CDN caching:**
Product listings are personalized (filtered by buyer location, seller exclusion). CDN cache keys would need to encode full query parameters, producing near-zero hit rates for a geographically distributed user base.

---

### Consequences

**Positive:**
- Cache hits return in ~20ms (Upstash HTTP) vs ~100ms (PostGIS query). P95 on the product feed drops significantly under warm cache.
- DB connection pool pressure decreases at steady state.
- Fail-open means Redis being unavailable never causes user-facing errors.

**Negative:**
- A product becoming out-of-stock is still shown as available in cached responses for up to 60 seconds. This is acceptable because the hard availability guarantee is enforced at checkout (`SELECT FOR UPDATE`), not at browse time.
- Pattern-based cache invalidation (`SCAN products:*` + `DEL`) is O(n) in matching key count — a known performance concern at scale.

---

### Tradeoffs Accepted

Cache-aside's "miss populates cache" behavior is correct for Kridha's read-heavy product discovery pattern. The 60-second TTL accepts up to 60 seconds of stale availability data in browse results — explicitly acceptable because the checkout path enforces hard availability independently.

---

### Revisit Trigger

At high cache key count (>50k geographic cache entries), switch from pattern-delete to tag-based invalidation. At high cache miss concurrency on the same key, implement a short-lived lock key before the DB fetch (cache stampede prevention).

---

### Interview Questions This Enables

- "What is cache-aside and how does it differ from write-through caching?"
- "How do you handle cache invalidation when a product is updated?"
- "What does fail-open mean in the context of a cache? Why is it important?"
- "A buyer sees a product as available, adds it to cart, and then checkout fails with INSUFFICIENT_STOCK. How does your cache contribute to this, and is that acceptable?"
- "What is a cache stampede and how would you prevent it?"

---

## ADR-009 — Webhook Idempotency via Unique Constraint

**Status:** Accepted
**Date:** February 2026
**Decider:** Abhishek Kumar

---

### Context

Razorpay retries webhook delivery on any non-200 response, and occasionally redelivers the same event during its own failover events. The same `payment.captured` event can arrive 2, 5, or 100 times. Processing it multiple times would create multiple Payment rows, double-confirm orders, and in the worst case trigger duplicate payouts.

---

### Decision

Use `WebhookLog.razorpayPaymentId @unique` combined with the log insert and the resulting state transition inside one `prisma.$transaction()`. Concurrent duplicate deliveries race at the database level; exactly one `INSERT INTO WebhookLog` wins, all others fail the `@unique` constraint with `P2002`, and their transactions roll back. Always return 200.

---

### Alternatives Considered

**Application-level duplicate check (`findFirst` before insert):**
```typescript
const existing = await prisma.webhookLog.findFirst({ where: { razorpayPaymentId } });
if (existing) return; // duplicate
await prisma.webhookLog.create({ ... });
await processPayment();
```
Rejected. The gap between `findFirst` and `create` is a race window. Two concurrent handlers both pass the `findFirst` check and both proceed to insert — producing two Payment rows and two state transitions. The `@unique` constraint eliminates this race because constraint enforcement is atomic at the DB level.

**Idempotency key from client:**
Applies to buyer-initiated requests, not to Razorpay webhook deliveries. The buyer does not control when Razorpay fires a webhook.

**Event sourcing with deduplication:**
Store all raw webhook events in an append-only event log, process asynchronously with a deduplication step. Architecturally clean. Requires a persistent worker process and event store — out of scope for current infrastructure.

---

### Consequences

**Positive:**
- 100 concurrent identical webhook deliveries produce exactly one `WebhookLog` row and one `Payment` row. Verified with k6 `shared-iterations` test (100 VUs, 100 iterations, same `razorpayPaymentId`).
- The idempotency guarantee is enforced at the database level, not the application level. Application bugs cannot bypass it.
- Always returning 200 prevents Razorpay retry storms on invalid signatures or processing failures.

**Negative:**
- The webhook idempotency test used a synthetic `razorpayPaymentId` with no matching SubOrder — it tested the "unknown event" path, not the "duplicate real payment" path. The true idempotency test requires a real PENDING SubOrder (see Known Limitations in DESIGN.md).

---

### Tradeoffs Accepted

The `@unique` constraint approach is the simplest correct implementation of webhook idempotency. It requires no additional infrastructure, no additional tables, and no additional application logic beyond catching the `P2002` error. The correctness guarantee is as strong as the database's transaction isolation.

---

### Revisit Trigger

If webhook event types expand to include events where `razorpayPaymentId` is not available as the natural idempotency key, introduce a composite key or a separate idempotency key field on `WebhookLog`.

---

### Interview Questions This Enables

- "What is idempotency and why does it matter for payment webhooks?"
- "What is a TOCTOU race condition? Give me an example from your webhook handler."
- "Why does your webhook always return 200, even on errors?"
- "How does a unique constraint provide stronger idempotency than an application-level check?"
- "Walk me through what happens when 100 identical webhooks arrive simultaneously."

---

## ADR-010 — Next.js API Routes over a Separate Backend

**Status:** Accepted
**Date:** January 2026
**Decider:** Abhishek Kumar

---

### Context

Kridha requires a React/Next.js frontend and a Node.js backend API. The standard production architecture separates these into two deployments: a Next.js frontend and an Express/Fastify API server. This is what most production teams at medium-to-large scale use.

---

### Decision

Use Next.js 16 App Router API routes (`src/app/api/**`) for all backend logic. A single Next.js deployment on Vercel handles the frontend, all 61 API endpoints, cron jobs, and webhook handling.

---

### Alternatives Considered

**Express.js on a separate server:**
Full control over server configuration, middleware ordering, connection keep-alive, WebSocket support. Two deployments to manage, two sets of environment variables, two domains (or a reverse proxy), two monitoring setups, CORS configuration between frontend and backend. For a solo developer at ₹0/month, the operational overhead is disproportionate to the capability gain.

**Fastify on a separate server:**
Better performance than Express. Same operational overhead arguments apply.

**NestJS:**
Full-featured backend framework with dependency injection, decorators, and modules. Well-structured for large teams. For a solo developer building in 45 days, NestJS's learning curve and boilerplate cost outweigh its benefits. The module/controller/service/repository pattern is implemented manually in Kridha without the framework overhead.

**tRPC with Next.js:**
Type-safe API layer that co-locates frontend types with backend implementations. Excellent for full-stack TypeScript. Problem: tRPC is primarily designed for direct frontend-to-backend calls. Razorpay webhooks, cron endpoints, and third-party integrations require standard HTTP endpoints — a hybrid of tRPC for frontend calls and plain API routes for webhooks adds complexity without simplifying the common case.

---

### Consequences

**Positive:**
- Single deployment. One set of environment variables, one monitoring setup, one domain, zero CORS configuration.
- Shared TypeScript types between frontend and backend. `ProductWithRelations` from `product.repo.ts` is directly importable in frontend components.
- Vercel cron jobs are first-class: `vercel.json` cron entries call Next.js API routes directly.

**Negative:**
- Vercel Hobby 10-second function timeout. Any API request taking longer than 10 seconds fails. Constrains seed and migration operations — these use `DIRECT_URL` outside the function environment.
- No persistent connections. No WebSocket support. No Server-Sent Events. Real-time order status updates use polling.
- Cold starts (200–800ms) on first request after inactivity. Mitigated by `withRetry` for the Supabase-side consequence.
- Frontend and backend scale together, not independently.

---

### Tradeoffs Accepted

For a solo developer at MVP stage on ₹0/month infrastructure, Next.js API routes are correct. The constraints (10-second timeout, no persistent connections) are known and worked around. The migration path to a separate API server is straightforward when the constraints become binding.

---

### Revisit Trigger

When BullMQ workers are introduced (Stage 2 trigger: synchronous notifications/payouts measurably affecting checkout latency), evaluate whether to extract the API layer to its own deployment (Express/Fastify on Railway) alongside the Next.js frontend, or keep Next.js as the single entry point with Railway workers handling async jobs only.

---

### Interview Questions This Enables

- "Why did you use Next.js API routes instead of a separate Express server?"
- "What are the limitations of serverless functions for a backend API?"
- "How do you handle the 10-second Vercel timeout constraint in your checkout flow?"
- "What is a cold start and how does it affect your API latency?"
- "When would you migrate to a separate backend service?"

---

*For system-level consequences of these decisions, see [ARCHITECTURE.md](./ARCHITECTURE.md).*
*For implementation detail of each decision, see [DESIGN.md](./DESIGN.md).*
*For the product narrative that contextualizes these decisions, see [CASE_STUDY.md](./CASE_STUDY.md).*
