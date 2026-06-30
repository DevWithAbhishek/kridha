# ARCHITECTURE.md — Kridha

This document explains *why* Kridha is built the way it is. It is not implementation documentation — for that, read the code, or [API.md](./API.md). It is not a decision log — for full ADRs with rejected alternatives, read [DECISIONS.md](./DECISIONS.md). This document sits between those two: the reasoning that connects principle to decision.

**Audience:** CTO, senior backend engineer.

---

## Table of Contents

1. [Engineering Principles](#1-engineering-principles)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Request Lifecycle](#3-request-lifecycle)
4. [Authentication](#4-authentication)
5. [Order Architecture](#5-order-architecture)
6. [Inventory Reservation](#6-inventory-reservation)
7. [Payment Processing](#7-payment-processing)
8. [Webhook Idempotency](#8-webhook-idempotency)
9. [Caching](#9-caching)
10. [Rate Limiting](#10-rate-limiting)
11. [Observability](#11-observability)
12. [Deployment](#12-deployment)
13. [Scaling Constraints](#13-scaling-constraints)
14. [Architecture Decisions](#14-architecture-decisions)
15. [Known Limitations](#15-known-limitations)
16. [Future Evolution](#16-future-evolution)

---

## 1. Engineering Principles

Four principles recur throughout this document — every section below is an application of one or more of these, not an isolated choice.

**Correctness enforced at the database layer, not just the application layer.** Stock locking, webhook idempotency, and financial calculations all have their hard guarantee at the Postgres level (constraints, row locks) rather than relying solely on application code to behave correctly under concurrency.

**Fail open on availability, fail closed on money.** Rate limiting and caching degrade gracefully if Redis disappears — legitimate users are never blocked by infrastructure failure. Payment and refund calculations never trust client input and never degrade silently.

**Constraints drive design, not defaults.** Every non-obvious decision below — lazy expiry, the Order/SubOrder split, two-phase payment — traces back to a real constraint (Vercel's cron limits, multi-seller fulfillment, an unfamiliar-counterparty marketplace), not a tutorial pattern applied by default.

**A monolith is a decision, not a limitation.** Kridha runs as a single deployment deliberately. [Section 16](#16-future-evolution) explains exactly what would change that, and why none of those triggers have been hit yet.

---

## 2. High-Level Architecture

```
Browser / Mobile PWA
        │
        ▼
┌─────────────────────────────────┐
│   proxy.ts — Middleware Layer   │
│   Rate limiting → CSRF →        │
│   JWT verify → Role check       │
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│         Route Handlers          │
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│   Service Layer (business rules)│
└──────┬──────────────┬───────────┘
       ▼              ▼
┌────────────┐  ┌─────────────────┐
│ Repository │  │  External APIs   │
│   Layer    │  │  Razorpay        │
└─────┬──────┘  │  Cloudinary      │
      ▼         │  GlitchTip       │
┌─────────────────────────────────┐
│  PostgreSQL + PostGIS · Redis    │
└─────────────────────────────────┘
```

One Next.js deployment serves the frontend, all 61 API endpoints, cron jobs, and webhook handling. This is addressed directly in [Section 12](#12-deployment) and [Section 16](#16-future-evolution) — it is a scale-appropriate choice, revisited on specific triggers, not an oversight.

---

## 3. Request Lifecycle

Every request — buyer, seller, or admin — passes through the same middleware sequence before reaching a route handler: **rate limiting → CSRF validation → JWT verification → role enforcement.** Centralizing these in `proxy.ts` means no route handler can accidentally skip a security check; the check happens before the handler is invoked at all, not as a per-route opt-in.

Webhooks are the one exception — they enter through a separate path with HMAC signature verification instead of JWT, since Razorpay cannot present a cookie. This separation is intentional: webhook trust and user trust are different threat models and should never share a verification path.

---

## 4. Authentication

**HttpOnly cookies, not localStorage.** Kridha's users are kirana owners on shared Android devices. `localStorage` is readable by any JavaScript on the page — one XSS bug in any dependency silently exfiltrates the session. HttpOnly cookies remove that attack surface entirely; the cost is CSRF protection, implemented as a double-submit token validated in the middleware layer.

**Token family rotation, not simple rotation.** Simple refresh rotation only fails safe for the legitimate user — it doesn't *detect* theft, it just eventually locks the real user out. Family rotation adds one invariant: presenting an already-rotated token immediately revokes every session for that user and fires a security alert. The one real engineering challenge this introduces — a slow connection retrying a refresh request and triggering a false-positive theft signal — is handled by deduplicating concurrent refresh calls client-side before they ever reach the server.

**PIN over OTP or password.** SMS delivery to Tier-2 feature phones is unreliable; passwords add recovery infrastructure and friction for a user base accustomed to PIN-based banking UX. Argon2-hashed 4-digit PINs with progressive lockout match the threat model and the user.

**A fully separate admin surface.** Different signing secret, different cookie path, a `type: "admin"` claim that a user token can never satisfy — even if a secret were somehow shared, the token shape itself is rejected.

→ Full rationale and rejected alternatives: [DECISIONS.md — ADR-001, ADR-002](./DECISIONS.md)

---

## 5. Order Architecture

A multi-seller checkout needs two things that conflict in a single-table design: **one atomic payment** (the buyer pays once, covering every seller in that checkout) and **independent per-seller fulfillment** (Seller A cancelling must never affect Seller B's order).

`Order` is the financial unit — it holds the total, the advance, and the Razorpay reference. It has no status of its own; its state is derived from its SubOrders, not stored redundantly. `SubOrder` is the per-seller contract — independent pickup window, OTP, payment link, payout, and state machine. Two alternatives were rejected explicitly: a JSONB seller array (unindexable for the queries that actually matter — "find this seller's pending orders") and flat numbered seller columns (breaks at any hardcoded seller limit).

Stock locking is scoped to this same per-seller boundary — see [Section 6](#6-inventory-reservation).

→ Full rationale: [DECISIONS.md — ADR-007](./DECISIONS.md)

---

## 6. Inventory Reservation

Concurrent checkouts on the same product are resolved with **`SELECT FOR UPDATE`** inside the transaction, not optimistic version-checking. Hot SKUs in a small marketplace are highly contested; optimistic locking would produce a retry storm — most of 20 concurrent buyers fail their version check, retry, fail again. Pessimistic locking serializes at the database layer instead: the second transaction waits, reads the updated count, and gets a clean `409` with no retry.

A Redis-based distributed lock was considered and rejected — if Redis is unavailable, the lock layer disappears entirely with no fallback, and a lock TTL expiring mid-transaction can let two transactions hold the "lock" simultaneously. A Postgres row lock has no equivalent failure mode: it's enforced by the database engine and released automatically on transaction commit, rollback, or client disconnect.

**On deadlocks:** stock decrements are grouped and locked in a consistent order (by seller, then by product ID) specifically to avoid the classic deadlock pattern where two transactions lock the same two rows in opposite order. Postgres would detect and resolve a deadlock if one occurred — the transaction catch block surfaces this as a typed `INTERNAL_ERROR` rather than crashing the request — but the ordering convention is the primary prevention.

The stock check in the cart (before checkout) is advisory only — it filters obvious impossibilities to reduce unnecessary lock contention. The hard guarantee is exclusively the `SELECT FOR UPDATE` inside the transaction.

→ Full rationale: [DECISIONS.md — ADR-005](./DECISIONS.md)

---

## 7. Payment Processing

Buyers are paying suppliers they've often never dealt with before. Full upfront payment removes all buyer leverage if the goods don't match the listing. Kridha uses a **two-phase model**: a small advance (₹100–500, calculated server-side, never client-supplied) confirms the booking; the remaining balance is paid after the buyer inspects the goods in person.

The harder engineering problem is what happens when the advance payment's Razorpay order creation fails *after* the Postgres transaction has already committed stock decrements — Razorpay cannot participate in that transaction, so this gap is real. A **compensating transaction** restores stock and cancels the SubOrder immediately on failure. The one case this doesn't cover — Razorpay's response is lost in transit but the order was actually created — is documented honestly in [Section 15](#15-known-limitations) rather than papered over.

→ Full rationale: [DECISIONS.md — ADR-004 (PostgreSQL transactional guarantees)](./DECISIONS.md)

---

## 8. Webhook Idempotency

Razorpay retries webhook delivery on any non-200 response, and occasionally redelivers the same event regardless. The webhook handler **always returns 200** — a non-200 on a bad signature causes retry storms, not improved security.

Duplicate processing is prevented by a `@unique` constraint on `WebhookLog.razorpayPaymentId`, with the log insert and the resulting state transition inside one transaction. Concurrent duplicate deliveries race at the database level; exactly one insert wins, the rest fail the constraint and are treated as already-handled. An application-level "check then insert" was rejected explicitly — the gap between the check and the insert is exactly where two concurrent duplicates would both pass.

HMAC signature verification uses `crypto.timingSafeEqual()` rather than standard string comparison, which short-circuits on the first mismatched byte and can leak signature bytes through response-time measurement.

→ Full rationale: [DECISIONS.md — ADR-009](./DECISIONS.md)

---

## 9. Caching

Product search results are cached cache-aside in Redis, keyed by lat/lng rounded to 3 decimal places (~111m precision — tight enough that nearby buyers share a cache entry, loose enough that GPS noise doesn't fragment the cache). The cache is never authoritative: a Redis failure is a cache miss, never an error, and falls straight through to Postgres.

**Known gap, stated honestly:** a sudden traffic spike on a single popular listing can cause many concurrent cache misses to all fire the same expensive query simultaneously — a cache stampede. This is not yet mitigated (the fix is a short-lived lock key set before the fetch) and is listed explicitly in [Section 15](#15-known-limitations).

---

## 10. Rate Limiting

Three independent layers, each defeating a different attack: per-IP sliding window (defeats naive single-source brute force), per-account using the phone number as key (defeats IP rotation — a botnet with 1,000 IPs still hits the per-account ceiling), and a global platform ceiling (caps total auth throughput regardless of distribution). All three fail open — a Redis outage degrades to no rate limiting rather than blocking every legitimate login.

→ Full rationale: [DECISIONS.md — ADR-002 (related to token/session security)](./DECISIONS.md)

---

## 11. Observability

Structured JSON logging (Pino) with a `requestId` on every line means a production incident can be traced by filtering one ID, not by reading interleaved `console.log` output from concurrent requests. Fourteen sensitive fields — PINs, OTPs, tokens, financial identifiers — are redacted before any log line is serialized, never after.

GlitchTip and Pino serve different jobs: Pino is the complete operational record of every request; GlitchTip captures only exceptions and five specific security events (token theft, credential stuffing, IP change on refresh, rate-limit violations, unhandled 5xx) and is what triggers an alert.

The uptime check deliberately hits a *shallow* health endpoint that never touches the database — a functional endpoint would mean uptime monitoring competes with real users for a connection pool slot on a free-tier Postgres instance, which is a worse outcome than not monitoring database health automatically at all.

---

## 12. Deployment

Vercel + Supabase + Upstash is a deliberate choice for current traffic, not a budget constraint accepted reluctantly. The real constraints this introduces — a 10-second function timeout, no persistent connections, cold starts — are named explicitly in [Section 13](#13-scaling-constraints) rather than discovered by surprise later.

---

## 13. Scaling Constraints

| Bottleneck | Trigger to watch | Mitigation |
|---|---|---|
| Postgres connection pool (currently `max=15`) | Sustained connection wait time appearing in logs | PgBouncer / Supabase Pro pooling |
| Vercel cold starts under burst traffic | P99 latency spikes correlated with traffic bursts | Reduce via Vercel Pro, or move to a persistent server |
| Lazy expiry running concurrently on every product request | Expiry sweep query share rising in slow-query logs | Redis distributed lock (`SET NX EX 30`) around the sweep |
| Synchronous notification/payout work inside request handlers | Checkout latency increasing under load | Move to BullMQ workers on a persistent process |

What does **not** scale-break at these levels: the state machine (pure in-memory), the webhook idempotency mechanism (enforced at the Postgres index level, not application concurrency), and JWT verification (stateless, no DB dependency).

---

## 14. Architecture Decisions

This document explains reasoning. Full ADRs — with every rejected alternative, consequence, and "what I'd reconsider" — live in [DECISIONS.md](./DECISIONS.md):

- ADR-001 — HttpOnly cookies over localStorage
- ADR-002 — Token family rotation
- ADR-003 — PostgreSQL over MongoDB
- ADR-004 — PostGIS over Elasticsearch
- ADR-005 — Pessimistic over optimistic locking
- ADR-006 — Lazy expiry over frequent cron
- ADR-007 — Order/SubOrder decomposition
- ADR-008 — Redis cache-aside
- ADR-009 — Webhook idempotency via unique constraint
- ADR-010 — Next.js API routes over a separate backend

---

## 15. Known Limitations

Stated here, unprompted, rather than left for a reviewer to find:

- **The race condition test design is flawed.** The current k6 test shares a single JWT across 50 virtual users, which exercises cart-layer concurrency, not the stock-layer `SELECT FOR UPDATE` path. The lock itself is correct; the test that's supposed to prove it isn't testing the right thing yet.
- **No unit tests on the service layer.** Integration behavior is covered by k6; the compensating-transaction path specifically has never been exercised in a controlled test.
- **Cache stampede is not mitigated.** A traffic spike on one listing can cause many concurrent cache misses to hit Postgres simultaneously.
- **The orphaned-Razorpay-order edge case is unresolved.** If a Razorpay order is created but the success response is lost before the compensating transaction logic runs, the order can exist on Razorpay's side with no matching live SubOrder. Documented, rare, requires manual reconciliation if it occurs.
- **Lazy expiry sweeps run without a concurrency guard.** Many simultaneous product requests currently trigger many simultaneous expiry sweeps; a distributed lock is the known fix, not yet applied.

---

## 16. Future Evolution

Each step below is gated by a specific trigger, not a calendar date or a vague notion of "scale."

- **Enforce modular boundaries within the monolith** (lint rules preventing one domain from importing another's internals) — trigger: a second engineer joins, *before* any coupling accumulates.
- **Extract Notifications as a separate service** — trigger: not required by load; chosen first specifically because it's the lowest-risk way to gain real two-deployment operational experience.
- **Introduce BullMQ workers on a persistent process** — trigger: synchronous notification or payout work measurably affecting checkout latency under real traffic.
- **Move to Postgres read replicas** — trigger: read query load (search, order history) measurably contending with write latency on the same connection pool.
- **Consider selective microservices for Payments** — trigger: payment volume reaching roughly 5,000+ events/day, or a compliance requirement demanding isolation independent of volume.

Nothing above is planned on a timeline. Each is a response to a measured condition that has not yet occurred.

---

*For implementation detail, read the code directly — `src/services/order.service.ts`, `src/lib/state-machine.ts`, `src/app/api/webhooks/razorpay/route.ts`.*
*For the full decision log, see [DECISIONS.md](./DECISIONS.md).*
*For the product narrative, see [CASE_STUDY.md](./CASE_STUDY.md).*












┌─────────────────────┐
│  Browser / PWA       │
└──────────┬───────────┘
           ▼
┌─────────────────────────────┐        ┌──────────────┐
│  proxy.ts                    │        │  Razorpay     │
│  • Rate limiting (3 layers)  │        └──────┬───────┘
│  • CSRF validation            │               ▼
│  • JWT auth (cookie)          │        ┌──────────────┐
│  • Role enforcement           │        │ Webhook Route │
└──────────┬───────────────────┘        │ HMAC Verify   │
           ▼                             └──────┬───────┘
┌─────────────────────────────┐               │
│      Service Layer            │◄─────────────┘
│  order · cart · auth · payment│
└──────────┬───────────────────┘
           ▼
   ┌───────────────┬───────────────┐
   │  PostgreSQL    │     Redis      │
   │  writes/txns   │ cache/limits   │
   └───────────────┴───────────────┘