# CASE_STUDY.md — Kridha: From Industrial Systems to Backend Architecture

---

## Background: Why a Mechanical Engineer Builds Distributed Systems

At Vedanta Aluminium, I was responsible for the Pneumatic Ash Handling System
at the 1200 MW Jharsuguda captive power plant — a ₹95 Cr infrastructure that
moved fly ash from ESP hoppers to storage silos across 2.4 km of pressurised
pipelines. The system ran 24/7. A valve misfire at 4 AM meant ash overflow,
environmental violation, and potential unit shutdown.

That environment taught me three things that directly shaped how I architect
software:

**1. Edge-failure design is not optional.**
A pneumatic conveying system has 140+ solenoid valves, each a failure point.
You do not design for the happy path — you design for the invariant: "ash must
never back-flow into the boiler." Every sequence had interlocks. Every actuator
had a fallback. I carry this as: *every state transition must be validated
before it executes, and terminal states must be immutable.*

This became `validateTransition(from, to)` in `src/lib/state-machine.ts`.
`COMPLETED` and `CANCELLED` SubOrders have empty edge arrays. No endpoint,
cron, or webhook can re-open them — the same way a closed isolation valve
cannot be re-opened by a downstream signal after a trip condition.

**2. Deterministic workflows over optimistic retry.**
Ash conveying sequences are deterministic: blow valve → pressurize → open
outlet → convey → close outlet → vent. Skipping a step or retrying mid-sequence
produces unpredictable results. The PLC enforces sequencing — not the operator.

This became pessimistic locking (`SELECT FOR UPDATE` inside
`prisma.$transaction()`) for stock decrement. Two buyers racing for the last
10 kg of mustard oil must produce exactly one `201` and one `409` —
deterministically, at the DB layer, not by application retry logic.

**3. Instrumentation is not overhead — it is the product.**
A plant without SCADA telemetry is ungovernable. You cannot tune a conveying
line you cannot observe. At Vedanta I built DCS tag hierarchies for 300+
instruments. At Kridha I built structured Pino logging with `redact` for 14
sensitive fields, `withLogger(handler, action)` wrapping every route, and
GlitchTip error tracking with `tracesSampleRate: 0.1` in production. The log
format matches what Vercel's log drain expects — structured JSON, not
`console.log`.

---

## The Problem

Udaan requires 50 kg+ minimum orders. A kirana owner needing 8 kg of mustard
oil from a mill 3 km away has no platform — he calls, negotiates, pays cash.
Zero payment protection, zero order history.

The constraint is not demand. The kirana owner wants the product. The mill has
the product. The constraint is delivery economics: no platform can profitably
route a 3-person delivery team for an 8 kg order.

**The insight:** remove delivery entirely. Buyers self-pickup. Suppliers serve
micro-orders without logistics overhead. The platform handles discovery,
payment protection, and trust — nothing else.

---

## Positioning vs Udaan

| Dimension | Udaan | Kridha |
|-----------|-------|--------|
| Model | B2B delivery | B2B + B2C self-pickup |
| Minimum order | 50 kg+ | ₹1,000 per seller |
| Language | English | Hindi-first |
| Supplier type | Large distributors | Farmers, mills, local manufacturers |
| Payment model | Credit-heavy, net-30 | Advance (booking) + remaining (at pickup) |
| Target geography | Pan-India urban | Tier-2/3 UP — Gorakhpur, Deoria, Basti |
| Auth model | OAuth / email | Phone + 4-digit PIN |

The PIN choice is deliberate. UP Tier-2 kirana owners have Android phones, not
Gmail accounts. PIN entry is 3 seconds. OAuth redirects are 20 seconds and
require mobile data. For a buyer standing at a supplier's counter inspecting
goods, the auth flow must not be the bottleneck.

---

## SME Ownership: Payment and Inventory Modules

I shipped 61 API endpoints across 14 resource groups in 45 days as a solo
full-stack engineer, acting as the Subject Matter Expert for two of the three
most complex modules:

### Payment Module — Two-Phase Razorpay Architecture

The payment architecture has two distinct phases because the business logic
demands it:

**Phase 1 — Advance (booking confirmation):**
`MIN(₹500, MAX(₹100, 5% of order total))` collected before the order confirms.
This is not a deposit — it is a commitment mechanism. A buyer who pays ₹120
advance for a ₹2,400 mustard oil order has skin in the game. No-shows drop.
The advance is calculated server-side only (`calcAdvance()` in
`src/lib/pricing.ts`) — the client never sends an amount.

**Phase 2 — Remaining (at pickup, after inspection):**
The seller generates a Razorpay payment link after the buyer arrives and
inspects the goods. This transitions the SubOrder from `CONFIRMED →
AWAITING_PAYMENT`. The buyer pays. The webhook transitions to
`READY_FOR_OTP_VERIFICATION`. The seller verifies the OTP. `COMPLETED`.

Why two phases instead of full payment upfront? Because the buyer has the
right to inspect before committing full payment. A kirana owner buying 100 kg
of wheat from an unknown supplier needs the ability to reject on inspection.
Full upfront payment removes that leverage. The two-phase model preserves
buyer protection while giving the seller advance confirmation.

**Zero-mismatch reconciliation record:**
The webhook handler for `payment.captured` and `payment_link.paid` performs
idempotent processing via `WebhookLog.razorpayPaymentId @unique`. The
application-level duplicate check plus the DB `@unique` constraint creates two
independent guards. In 45 days of development and testing across multiple
Razorpay retry scenarios, zero duplicate charges were processed. The financial
ledger — `Payment`, `Payout`, `Refund` rows — maintained exact consistency
with Razorpay's dashboard on every reconciliation check.

The refund calculation (`calcRefundAmount` in `src/lib/refund.ts`) is
server-side only. The client never sends `refundAmount`. Tiers are computed
from `SubOrder.pickupDeadline` — a stored column, not a computed expression,
specifically because Vercel Cron needs `WHERE pickupDeadline < NOW()` to be
index-scannable.

### Inventory Module — Atomic Stock Decrement

The core problem: two buyers simultaneously checkout the last 10 kg of a
product. Without concurrency control, both succeed and `available` goes
negative — violating the `CHECK (available >= 0)` DB constraint and the
platform's trust model.

I chose pessimistic locking (`SELECT FOR UPDATE` inside
`prisma.$transaction()`) over optimistic locking (version counter + retry) for
one reason: **hot SKUs in a small-town marketplace are highly contested.**

A mill selling 50 kg of Mustard Oil in Gorakhpur may have 15 kirana owners
checking the same listing. Optimistic locking produces a retry storm — 14 of
15 transactions fail their version check, retry, fail again. Latency tail
explodes. Pessimistic locking serialises all 15 at the DB layer. The first N
(where N ≤ available) succeed deterministically. The rest get `409
INSUFFICIENT_STOCK` immediately. First come, first served — no ambiguity, no
retries, no partial failures.

**3x query performance with Prisma 7 + GIST spatial index:**

Product discovery switched from a Prisma ORM `findMany` with lat/lng arithmetic
(table scan, O(n)) to a raw `$queryRaw` PostGIS query using `ST_DWithin` on
a GIST-indexed `geography(Point, 4326)` column (O(log n) index pages + O(k)
matching rows). On a 500-product dataset at 10 km radius:

- Before: ~180ms average (lat/lng bounding box, no spatial index)
- After: ~55ms average (`ST_DWithin` + GIST, `<->` KNN for distance sort)

The `<->` KNN operator uses the GIST index to return rows in nearest-first
order without computing distance for non-results. `ORDER BY ST_Distance()`
(the naive alternative) computes distance for every post-filter row. At 500
products, that is 500 distance computations vs. O(log n) index traversals.

Prisma 7's `@prisma/adapter-neon` (WebSocket-based serverless driver) further
reduced cold-path connection overhead by ~40ms per request on Neon compared to
the HTTP-based fallback — the adapter maintains a persistent WebSocket for the
duration of a Vercel function invocation rather than establishing a new TCP
connection per query.

---

## Technical Decisions — The 'Why'

### PostGIS over Elasticsearch for Search

Elasticsearch would add a second infrastructure dependency (cost, ops overhead)
for a problem PostgreSQL already solves. `pg_trgm` GIN index handles
`ILIKE '%query%'` on `nameEn` and `nameHi` with trigram acceleration. PostGIS
handles radius search. Both run on the same Neon instance. Zero additional
cost. Zero additional failure domain.

Elasticsearch makes sense at 10M+ products where full-text ranking, faceting,
and cross-field boosting matter. At 500–50,000 products in a geographic cluster,
PostGIS + `pg_trgm` is the correct tool.

### Hindi-First i18n — Resolved at Creation

Notification strings are resolved at the time of creation using
`user.preferredLang` from the DB, not at render time:

```typescript
const copy = notifStrings.orderConfirmed[user.preferredLang](shortId, otp);
await prisma.notification.create({ data: { title: copy.title, body: copy.body } });
```

Why? If the user changes `preferredLang` after the order is placed, the
historical notification must still reflect the language at the time of the
event. A Hindi notification for a Hindi-preferring user at order time is
correct even if the user later switches to English. Resolution at creation is
also simpler — no template system, no runtime translation service, no
translation cache invalidation.

### Cookie-Only Auth — Why Not JWT in Headers

UP Tier-2 users access Kridha on shared Android devices. `localStorage` is
accessible to any JavaScript running in the same origin — a XSS vulnerability
in any dependency exposes the token. `HttpOnly` cookies are inaccessible to
JavaScript by definition. `SameSite=Lax` prevents CSRF on cross-site form
submissions. The combination is strictly safer for a user population that does
not control their device environment.

The `kridha_refresh` token is scoped to `path=/api/auth`. The browser never
sends it to `/api/products` or `/api/orders` — a stolen refresh token cannot
be replayed against non-auth endpoints, limiting blast radius.

### Order → SubOrder: The Decomposition Rationale

Multi-seller checkout requires one atomic financial event (the advance payment)
and N independent operational tracks (one per seller). Conflating them into a
single `Order` with seller-specific fields would produce a table that mixes
financial and logistics concerns — violating separation of responsibility and
making per-seller cancellation, payout calculation, and OTP management
structurally awkward.

`Order` = atomic financial transaction (one Razorpay advance, one receipt).
`SubOrder` = independent seller contract (OTP, pickup window, payment link,
payout, cancellation, status history).

Stock decrement inside `prisma.$transaction()` is grouped per seller — Seller
A's `SELECT FOR UPDATE` does not block Seller B's concurrent checkout. The
transaction boundary is the seller, not the order.

---

## Stage 1 Outcome

| Metric | Value |
|--------|-------|
| API endpoints | 61 across 14 resource groups |
| Prisma models | 22 |
| System invariants | 19 (DB + application layer) |
| Error codes | 39 typed, machine-readable |
| Infrastructure cost | ₹0/month |
| Payment reconciliation mismatches | 0 |
| Query performance improvement (spatial) | ~3x (180ms → 55ms) |
| Build time | 45 days, solo |

---

## Next: FixMitraa — Multi-Actor State Machine Design

FixMitraa is a home services marketplace (plumbing, electrical, carpentry) —
currently in **finalized LLD and system design phase**. Implementation is
pending, but the architecture decisions are complete:

**Multi-Actor State Machine:**
Unlike Kridha's two-actor model (buyer + seller), FixMitraa has four actors:
Customer, Technician, Supervisor, and Platform. Each actor has a different
view of the same job state and different permitted transitions. A Technician
can transition `ASSIGNED → IN_PROGRESS`. A Supervisor can transition
`DISPUTED → RESOLVED`. A Customer can transition `COMPLETED → REVIEWED`.
The state machine is parameterised by actor role — `validateTransition(from,
to, actorRole)` — preventing cross-actor state pollution.

**Key design decisions already finalised:**

- **Job escrow model:** platform holds full payment in escrow at booking.
  Technician is paid on Customer approval (OTP, same pattern as Kridha) or
  auto-released after 24h dispute window.
- **Technician geofencing:** job assignment only to technicians within 8 km,
  ranked by `reliabilityScore DESC`. PostGIS `ST_DWithin` + `<->` KNN —
  same spatial architecture as Kridha product discovery.
- **Supervisor escalation path:** disputes unresolved by either party for 48h
  auto-escalate to Supervisor. Supervisor resolution is the only path out of
  `DISPUTED` — no self-service resolution.
- **Multi-tier pricing:** base rate + parts cost + complexity tier. Parts cost
  submitted by Technician, approved by Customer before job starts — prevents
  bill shock (same two-phase commit pattern as Kridha's advance + remaining).

The LLD phase produced: 14 Prisma models, 8 state machine actors, 23 defined
transitions, 12 system invariants, and a PostGIS-based assignment algorithm.
Implementation begins after Kridha's pilot phase.

---

## Why This Matters for a Backend Role

The progression from Vedanta → Kridha → FixMitraa is not a pivot — it is the
same engineering discipline applied at different abstraction levels:

- Vedanta: interlocks and sequencing on physical systems with ₹95 Cr downside.
- Kridha: state machines and atomic writes on financial systems with payment
  integrity requirements.
- FixMitraa: multi-actor coordination on trust-dependent service delivery.

Edge-failure design, deterministic workflows, and instrumentation-first
thinking are not framework-specific skills. They are how I approach any system
where correctness costs more to recover than to guarantee upfront.