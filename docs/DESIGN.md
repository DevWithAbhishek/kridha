# DESIGN.md — Kridha Architecture Decisions

## Patterns Used

### 1. State Machine (Order Lifecycle)
SubOrder.status transitions are explicit. validateTransition(from, to) throws
INVALID_TRANSITION before any DB write. Terminal states (COMPLETED, CANCELLED,
DISPUTED) have empty edges — no transition out. Applied everywhere status changes.

### 2. Repository Pattern (Data Access)
productRepo, orderRepo — only these files import prisma for their domain.
Services import repos, never prisma directly. Swap ORM = 1 file per model.

### 3. Idempotency (Webhook Processing)
WebhookLog.razorpayPaymentId @unique (INV-03). Handler checks BEFORE processing.
Duplicate → 200, no reprocessing. Insert + status update in one $transaction.

### 4. Unit of Work (Order Placement)
prisma.$transaction() + SELECT FOR UPDATE for stock decrement. Two buyers,
one item — exactly one 201, one 409 INSUFFICIENT_STOCK. Guaranteed by DB.

### 5. Cache-Aside (Product Feed) — Phase 2
productRepo.findNearby checks Redis first. Cache miss → DB → write back.
Key: products:{lat}:{lng}:{radius}:{category}:{page}. TTL 60s.
Invalidated on product create/update/delete.

## Key Technical Decisions

### Cookie-only Auth
HttpOnly + SameSite=Strict. XSS-proof. No localStorage. kridha_lang NOT HttpOnly
because next-intl client needs it — it contains only "hi"/"en", no secret.

### Phone-only Identity
No Google OAuth, no Truecaller for Phase 1. Phone + PIN is the fastest path
for UP Tier-2 kirana owners. Silent signup prevents enumeration.

### Hindi-first i18n
Notifications resolved at creation per user.preferredLang. No runtime translation.
next-intl for frontend UI. Backend uses i18n-strings.ts — no external library.

### Separate Deal Entity
Deal history valuable for analytics. One ACTIVE deal per product enforced at
service layer. GET /products/deals/mine?status=expired for seller analytics.

### pickupDeadline Stored (Not Computed)
Vercel Cron needs WHERE pickupDeadline < now(). Cannot index computed expressions.
Stored at SubOrder creation = pickupDate + window.endTime.

## Scale Upgrade Path
- 10x: DB read replica for product listing. Redis cache TTL + category invalidation.
- 100x: BullMQ workers on Railway (cron becomes a queue). Razorpay Route for payouts.
- PostGIS GIST index already in place — no spatial change needed for 10x.