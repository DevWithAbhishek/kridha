# Kridha — API Contract

> **Version:** 2.0.0  
> **Last updated:** April 25, 2026  
> **Author:** Abhishek · DevWithAbhishek

---

## Base URLs

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:3000` |
| Production | `https://kridha.vercel.app` |

---

## Response Envelope

```json
{ "success": true,  "data": { } }
{ "success": true,  "message": "..." }
{ "success": false, "code": "MACHINE_READABLE_CODE", "message": "Human readable.", "meta": { } }
```

---

## Authentication — Cookie-Only Architecture

Kridha uses **100% HttpOnly cookie-based auth**. No `Authorization` header, no JWT in response body, no `localStorage`.

### Cookie Reference

| Cookie | Path | Max-Age | HttpOnly | SameSite | Purpose |
|--------|------|---------|----------|----------|---------|
| `kridha_access` | `/` | 900s (15 min) | ✅ | Lax | JWT access token. Sent on every request. Route handlers verify via `getUser(req)` / `requireRole(req, Role)` which call `req.cookies.get("kridha_access")` and `jwt.verify()` directly. |
| `kridha_refresh` | `/api/auth` | 604800s (7 days) | ✅ | Lax | Rotation-chain refresh token. Path-scoped — browser **never** sends to `/api/products`, `/api/orders`, etc. SHA-256 hash stored in `RefreshToken` table. |
| `kridha_lang` | `/` | 31536000s (1 year) | ❌ | Lax | `"hi"` or `"en"`. Not HttpOnly — next-intl client-side reads it. Contains no secret. |
| `kridha_access_exp` | `/` | 900s (15 min) | ❌ | Strict | Unix timestamp of access token expiry. JS scheduler reads it for proactive refresh before the 401 cycle. |

### Set-Cookie Headers on Login
Set-Cookie: kridha_access=<jwt>;   HttpOnly; Secure; SameSite=Lax; Path=/;         Max-Age=900
Set-Cookie: kridha_refresh=<hash>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=604800
Set-Cookie: kridha_lang=hi;                  Secure; SameSite=Lax; Path=/;         Max-Age=31536000
Set-Cookie: kridha_access_exp=<unix>;        Secure; SameSite=Strict; Path=/;      Max-Age=900

### Silent Refresh Flow — Interceptor Logic

The client Axios instance (`api.ts`) intercepts `401` responses:

1. If the failing request is an auth endpoint (`/auth/login`, `/auth/signup`, `/auth/refresh`) → reject immediately. Never refresh on auth endpoints — prevents infinite loops.
2. If `_retry` flag is already set → reject immediately. Prevents double-retry.
3. If another refresh is in-flight → queue the request. On refresh success, all queued requests replay. On failure, all queued requests reject.
4. Fire `POST /api/auth/refresh` using a **clean `refreshClient`** — a separate Axios instance with no interceptor. This prevents the refresh call itself from triggering another refresh on 401, which would recurse infinitely.
5. On refresh success → replay original request. On refresh failure → `window.location.href = "/login"`.
Client 401 → interceptor
├─ auth endpoint?        → reject (no refresh)
├─ _retry already set?   → reject (no double retry)
├─ refresh in flight?    → queue request, await
└─ start refresh
├─ POST /api/auth/refresh (clean client, no interceptor)
│    ├─ success → flush queue, replay original
│    └─ failure → reject queue, redirect /login
└─ release lock

### Token Family Rotation (Theft Detection)

Every `POST /api/auth/refresh` issues a new `kridha_refresh` token and revokes the old one. If an attacker reuses a rotated (already-consumed) token, the server detects it and revokes **all** `RefreshToken` rows for that user — invalidating every active session across all devices. This makes stolen refresh tokens single-use and self-expiring after detection.

### Admin Auth Surface

Completely separate. Admin routes (`/api/admin/*`) use:
- Cookie: `kridha_admin` (HttpOnly, `path=/api/admin`, separate `ADMIN_JWT_SECRET`)
- Payload must include `type: "admin"` — user JWTs are rejected even if somehow signed with the same secret
- `getAdmin(req)` / `requireSuperAdmin(req)` in `src/lib/getAdmin.ts` — analogous to `getUser` / `requireRole`
- Audit log written on every admin action: `AdminAuditLog.adminId`, `.action`, `.targetType`, `.targetId`, `.metadata`

---

## Idempotent Webhook Processing
Razorpay fires payment.captured
│
▼
POST /api/webhooks/razorpay
│
├─ 1. Verify HMAC signature with RAZORPAY_WEBHOOK_SECRET
│      failure → log, return 200 silently (no retry storm)
│
├─ 2. Extract razorpayPaymentId from payload
│
├─ 3. SELECT WebhookLog WHERE razorpayPaymentId = $id
│      found → return 200 immediately (duplicate, no reprocessing)
│
└─ 4. prisma.$transaction([
subOrder.update(status → CONFIRMED),
webhookLog.create(razorpayPaymentId),   ← @unique constraint
orderStatusHistory.create(),
])
If two concurrent webhooks race → second INSERT violates @unique → transaction rolls back → 200

`WebhookLog.razorpayPaymentId @unique` is the idempotency key enforced at the database layer. Application-level duplicate checks alone are insufficient under concurrent webhook delivery — the DB constraint is the final guard. The handler always returns `200` regardless of outcome to prevent Razorpay's exponential retry backoff from creating duplicate charges.

---

## Error Code Reference

39 typed error codes. All errors follow: `{ "success": false, "code": "...", "message": "...", "meta": {} }`.

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHENTICATED` | 401 | Cookie missing, malformed, or expired |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token expired, revoked, or reuse detected |
| `INVALID_CREDENTIALS` | 401 | Wrong phone or PIN |
| `PHONE_EXISTS` | 409 | Phone already registered (signup, non-silent path) |
| `PHONE_NOT_FOUND` | 404 | No account with this phone (reset-pin flow only) |
| `PIN_LOCKED` | 429 | Too many consecutive failed login attempts |
| `RATE_LIMITED` | 429 | Upstash sliding window exceeded |
| `FORBIDDEN` | 403 | Valid token, wrong role or not resource owner |
| `VALIDATION_FAILED` | 422 | Zod parse failed — `meta` carries `err.issues[]` |
| `STORE_EXISTS` | 409 | Store name + street already registered (INV-08) |
| `STORE_IMAGE_LIMIT` | 400 | Maximum 5 store images already uploaded |
| `PICKUP_WINDOW_NOT_FOUND` | 404 | Pickup window does not exist |
| `LAST_PICKUP_WINDOW` | 400 | Cannot delete the only active pickup window |
| `PICKUP_WINDOW_LIMIT` | 400 | Maximum 7 pickup windows |
| `INVALID_TIME_RANGE` | 409 | Window start/end time invalid |
| `PICKUP_WINDOW_OVERLAP` | 409 | Overlaps with existing window |
| `PRODUCT_NOT_FOUND` | 404 | Product does not exist or soft-deleted |
| `DEAL_EXISTS` | 409 | Active deal already on this product |
| `NO_ACTIVE_DEAL` | 400 | No active deal to update/delete |
| `INVALID_EXPIRY_TIME` | 400 | Deal expiry in the past |
| `CART_EMPTY` | 400 | Checkout with empty cart |
| `CART_ITEM_NOT_FOUND` | 404 | Cart item does not exist |
| `ALREADY_SAVED` | 409 | Product already in this saved list |
| `SAVED_PRODUCT_NOT_FOUND` | 404 | Saved item does not exist |
| `ORDER_NOT_FOUND` | 404 | Parent Order does not exist |
| `SUBORDER_NOT_FOUND` | 404 | SubOrder does not exist |
| `INSUFFICIENT_STOCK` | 409 | Requested qty > `product.available` — `meta: { productId, requested, available }` |
| `BELOW_MINIMUM_ORDER` | 400 | Order total < ₹1,000 — `meta: { minimum, current }` |
| `WINDOW_UNAVAILABLE` | 400 | Pickup window closed or inactive on chosen day |
| `INVALID_PICKUP_DATE` | 400 | Pickup date in past or outside active days |
| `DUPLICATE_ORDER` | 409 | Active order already exists for this product + window |
| `INVALID_TRANSITION` | 409 | State machine rejected this status change — `meta: { currentStatus, attemptedStatus, allowedTransitions }` |
| `INVALID_OTP` | 400 | OTP wrong or already cleared (INV-06) |
| `OTP_ATTEMPTS` | 429 | 3 consecutive wrong OTP attempts → SubOrder → DISPUTED |
| `ACCOUNT_HAS_ACTIVE_ORDERS` | 409 | Cannot delete account with PENDING/CONFIRMED/AWAITING_PAYMENT orders |
| `REVIEW_ALREADY_EXISTS` | 409 | Review already submitted for this SubOrder + product (INV-16) |
| `REVIEW_NOT_FOUND` | 404 | Review does not exist |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification does not exist |
| `NOT_YOUR_NOTIFICATION` | 403 | Notification belongs to a different user |
| `RAZORPAY_ERROR` | 502 | Razorpay API call failed — retryable |

**Enumeration-Safe Auth (Silent Signup):**  
`POST /api/auth/signup` never returns `PHONE_EXISTS`. If the phone is already registered, the response is still `201` with `"Account created. Login to continue."` — indistinguishable from a genuine new registration. This prevents an attacker from probing which phone numbers are registered by calling signup. Only `POST /api/auth/reset-pin-request` returns `PHONE_NOT_FOUND` because that flow requires the user to have an account — no enumeration risk since the attacker must also control the phone to complete the reset. Similarly, `INVALID_CREDENTIALS` is returned for both wrong phone and wrong PIN — the error does not reveal which field failed.

---

## Table of Contents

- [Auth](#auth)
- [User Profile](#user-profile)
- [Seller Profile](#seller-profile)
- [Pickup Windows](#pickup-windows)
- [Products — Buyer](#products--buyer)
- [Products — Seller](#products--seller)
- [Saved Products](#saved-products)
- [Upload](#upload)
- [Cart](#cart)
- [Reviews](#reviews)
- [Orders](#orders)
- [Payments / Webhooks](#payments--webhooks)
- [Notifications](#notifications)
- [Admin](#admin)
- [Cron](#cron)
- [System Invariants](#system-invariants)

---

## Auth

### POST /api/auth/signup

Create a new account. Does not issue tokens. Explicit login required after signup.
Auth:  None
Body:  { phone: string (10-digit), pin: string (4-digit), name: string }

201: { "success": true, "message": "Account created. Login to continue." }
422: VALIDATION_FAILED
429: RATE_LIMITED

> Duplicate phone always returns `201` — enumeration prevention. `PHONE_EXISTS` is never thrown here.

---

### POST /api/auth/login
Auth:  None
Body:  { phone: string, pin: string }

200: {
"success": true,
"data": { "user": { "id": string, "name": string, "roles": string[] } }
}
Set-Cookie: kridha_access=<jwt>;   HttpOnly; Secure; SameSite=Lax; Path=/;         Max-Age=900
Set-Cookie: kridha_refresh=<hash>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=604800
Set-Cookie: kridha_lang=<hi|en>;            Secure; SameSite=Lax; Path=/;         Max-Age=31536000
Set-Cookie: kridha_access_exp=<unix>;       Secure; SameSite=Strict; Path=/;      Max-Age=900
401: INVALID_CREDENTIALS
429: PIN_LOCKED

---

### POST /api/auth/refresh

Exchange `kridha_refresh` cookie for a new token pair. Both tokens rotate. Old refresh token revoked immediately.
Auth:  None — kridha_refresh cookie (path-scoped, sent automatically)
Body:  None

200: { "success": true }
Set-Cookie: kridha_access=<new-jwt>;   HttpOnly; Secure; SameSite=Lax; Path=/;         Max-Age=900
Set-Cookie: kridha_refresh=<new-hash>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=604800
Set-Cookie: kridha_access_exp=<unix>;           Secure; SameSite=Strict; Path=/;      Max-Age=900
401: REFRESH_TOKEN_INVALID

> Reusing a rotated refresh token revokes all sessions for that user (token family theft detection).

---

### POST /api/auth/logout

Revokes current device session. Other sessions unaffected.
Auth:  Cookie (kridha_access)
Body:  None

200: { "success": true, "message": "Logged out successfully." }
Set-Cookie: kridha_access=;  Max-Age=0; Path=/
Set-Cookie: kridha_refresh=; Max-Age=0; Path=/api/auth
Set-Cookie: kridha_lang=;    Max-Age=0; Path=/
401: UNAUTHENTICATED

---

### POST /api/auth/logout-all

Revokes all sessions across all devices. All `RefreshToken` rows for this user are marked `revoked = true`.
Auth:  Cookie (kridha_access)
Body:  None

200: { "success": true, "message": "Logged out from all devices." }
401: UNAUTHENTICATED

---

### POST /api/auth/reset-pin-request

Initiate PIN reset. OTP sent to registered phone (Twilio in production; console-logged in dev).
Auth:  None
Body:  { phone: string }

200: { "success": true, "message": "OTP sent to your registered mobile number." }
404: PHONE_NOT_FOUND
429: RATE_LIMITED
422: VALIDATION_FAILED

---

### POST /api/auth/reset-pin

Verify OTP and set new PIN. Revokes all existing sessions.
Auth:  None
Body:  { phone: string, otp: string (4-digit), newPin: string (4-digit), confirmPin: string }

200: { "success": true, "message": "PIN reset successfully. Login to continue." }
400: INVALID_OTP
404: PHONE_NOT_FOUND
422: VALIDATION_FAILED — includes pin mismatch
429: OTP_ATTEMPTS

---

### POST /api/auth/register-as-seller

Upgrade BUYER account to also hold SELLER role. Creates `SellerProfile`. Account enters PENDING verification.
Auth:  Cookie (kridha_access — BUYER role required)
Body:  {
storeName: string, street: string, line2?: string, landmark?: string,
city: string, state: string, pincode: string (6-digit),
businessType: INDIVIDUAL | PROPRIETORSHIP | PARTNERSHIP | PVT_LTD,
gstNo?: string, panNo: string,
accountHolderName: string, accountNumber: string, ifscCode: string, bankName: string,
pickupWindows: [{
labelEn: string, labelHi: string,
startTime: string (HH:MM), endTime: string (HH:MM),
daysActive: string[] (MON|TUE|WED|THU|FRI|SAT|SUN)
}]  — min 1
}

201: {
"success": true,
"message": "Application submitted. Verification takes 12–48 hours.",
"data": { "status": "PENDING", "bankVerified": false }
}
New kridha_access + kridha_refresh issued with updated roles (token rotation on role change)
401: UNAUTHENTICATED
409: STORE_EXISTS
422: VALIDATION_FAILED

> Roles updated to `[BUYER, SELLER]` immediately. New tokens issued in same response — no re-login required.

---

## User Profile

### GET /api/users/me
Auth:  Cookie (kridha_access)

200: {
"success": true,
"data": {
"id": string, "name": string,
"phone": string,          — masked: +91 XXXXX X1234
"city": string|null, "state": string|null,
"street": string|null, "line2": string|null, "landmark": string|null,
"profileImageUrl": string|null,
"preferredLang": "hi"|"en",
"roles": string[],
"reliabilityScore": number,
"noShowCount": number,
"creditBalance": number,
"isFlagged": boolean,
"createdAt": string
}
}
401: UNAUTHENTICATED

---

### PATCH /api/users/me
Auth:  Cookie (kridha_access)
Body:  { name?: string, street?: string, line2?: string, landmark?: string, city?: string, state?: string, preferredLang?: "hi"|"en" }

200: { "success": true, "data": { id, name, street, line2, landmark, city, state, preferredLang, updatedAt } }
401: UNAUTHENTICATED
422: VALIDATION_FAILED

---

### POST /api/users/me/avatar

Upload to Cloudinary first via `POST /api/upload/sign`, then send URL here. Old avatar deleted from Cloudinary automatically.
Auth:  Cookie (kridha_access)
Body:  { profileImageUrl: string, profileImagePublicId: string }

200: { "success": true, "message": "Profile picture updated successfully." }
401: UNAUTHENTICATED
422: VALIDATION_FAILED

---

### DELETE /api/users/me/avatar
Auth:  Cookie (kridha_access)

200: { "success": true, "message": "Profile picture removed." }
401: UNAUTHENTICATED
404: NOT_FOUND

---

### DELETE /api/users/me

Soft delete. Sets `User.deletedAt`. Blocked by active orders.
Auth:  Cookie (kridha_access)

200: { "success": true, "message": "Account deleted successfully." }
401: UNAUTHENTICATED
409: ACCOUNT_HAS_ACTIVE_ORDERS

---

## Seller Profile

### GET /api/sellers/profile
Auth:  Cookie (kridha_access — SELLER)

200: {
"success": true,
"data": {
"storeName": string, "street": string, "line2": string|null, "landmark": string|null,
"city": string, "state": string, "pinCode": string,
"storeImages": [{ "url": string, "publicId": string }],
"latitude": number|null, "longitude": number|null,
"businessType": string, "gstNumber": string|null, "panNumber": string,
"accountHolderName": string,
"accountNumber": string,   — masked: XXXXXXXXXXXX1234 (INV-17)
"ifscCode": string, "bankName": string, "bankVerified": boolean,
"kycStatus": PENDING|VERIFIED|REJECTED,
"profileStatus": PENDING|VERIFIED|DEACTIVATED,
"sellerRating": number, "sellerRatingCount": number, "reliabilityScore": number,
"pickupWindows": [{ id, labelEn, labelHi, startTime, endTime, daysActive }]
}
}
401: UNAUTHENTICATED
403: FORBIDDEN
404: NOT_FOUND

---

### PATCH /api/sellers/profile

Changing KYC/bank fields resets `kycStatus = PENDING`, `profileStatus = PENDING`, `bankVerified = false`.
Auth:  Cookie (kridha_access — SELLER)
Body:  {
storeName?: string, street?: string, line2?: string, landmark?: string,
city?: string, state?: string, pinCode?: string,
businessType?: enum, gstNo?: string, panNo?: string,
accountHolderName?: string, accountNumber?: string, ifscCode?: string, bankName?: string
}

200: { "success": true, "data": { ...updated profile, accountNumber: masked } }
401: UNAUTHENTICATED
403: FORBIDDEN
409: STORE_EXISTS
422: VALIDATION_FAILED

> Changes to `accountNumber`, `ifscCode`, `bankName`, `businessType`, `panNo` are blocked if the seller has active orders or pending payouts.

---

### POST /api/sellers/profile/images
Auth:  Cookie (kridha_access — SELLER)
Body:  { images: [{ url: string, publicId: string }] }

200: { "success": true, "data": { "storeImages": [{ url, publicId }] } }
400: STORE_IMAGE_LIMIT
401: UNAUTHENTICATED
422: VALIDATION_FAILED

---

### DELETE /api/sellers/profile/images/:publicId
Auth:  Cookie (kridha_access — SELLER)

200: { "success": true, "message": "Store image removed." }
401: UNAUTHENTICATED
404: NOT_FOUND

---

### DELETE /api/sellers/profile

Deactivate seller account. User retains BUYER role. Blocked by active seller orders.
Auth:  Cookie (kridha_access — SELLER)

200: { "success": true, "message": "Seller profile deactivated. Your buyer account remains active." }
401: UNAUTHENTICATED
403: FORBIDDEN
409: ACCOUNT_HAS_ACTIVE_ORDERS

---

## Pickup Windows

### GET /api/pickup-windows
Auth:  Cookie (kridha_access — SELLER)

200: {
"success": true,
"data": { "pickupWindows": [{ id, labelEn, labelHi, startTime, endTime, daysActive: string[] }] }
}

---

### POST /api/pickup-windows
Auth:  Cookie (kridha_access — SELLER)
Body:  { labelEn: string, labelHi: string, startTime: string (HH:MM), endTime: string (HH:MM), daysActive: string[] }

201: { "success": true, "data": { "pickupWindow": { id, labelEn, labelHi, startTime, endTime, daysActive } } }
400: PICKUP_WINDOW_LIMIT | INVALID_TIME_RANGE | PICKUP_WINDOW_OVERLAP
422: VALIDATION_FAILED

---

### PATCH /api/pickup-windows/:id
Auth:  Cookie (kridha_access — SELLER, own window)
Body:  { labelEn?: string, labelHi?: string, startTime?: string, endTime?: string, daysActive?: string[] }

200: { "success": true, "data": { "pickupWindow": { ... } } }
400: INVALID_TIME_RANGE | PICKUP_WINDOW_OVERLAP
404: PICKUP_WINDOW_NOT_FOUND
403: FORBIDDEN

---

### DELETE /api/pickup-windows/:id
Auth:  Cookie (kridha_access — SELLER, own window)

200: { "success": true, "message": "Pickup window removed." }
400: LAST_PICKUP_WINDOW
403: FORBIDDEN
404: PICKUP_WINDOW_NOT_FOUND

---

## Products — Buyer

### GET /api/products

PostGIS radius search. `location` GIST index + `<->` KNN operator for distance sort. `pg_trgm` GIN for `q` search. Price computed at `minOrderQuantity` against qualifying price tier (not `MIN(pricePerUnit)`) — deal discount applied if active.
Auth:  None (public). Optional cookie — if present and valid, own products excluded (INV-14).
Query: lat (required), lng (required), radius? (km, default 10, max 50),
category? (GRAINS|DAIRY|OIL|SPICES|VEGETABLES|FRUITS|PULSES|FLOUR|BEVERAGES|OTHER),
q? (nameEn/nameHi search), isBranded? (bool), dealActive? (bool),
minPrice? (decimal), maxPrice? (decimal),
sortBy? (distance|price_asc|price_desc, default distance),
page? (default 1), limit? (default 20, max 50)

200: {
"success": true,
"data": {
"products": [{
"id": string, "nameEn": string, "nameHi": string|null,
"description": string|null, "category": string, "isBranded": boolean,
"unit": string, "unitIncrement": number,
"minOrderQuantity": number, "maxOrderQuantity": number|null,
"priceTiers": [{ "minQty": number, "maxQty": number|null, "pricePerUnit": number }],
"available": number,
"imageUrls": string[], "blurHash": string|null,
"dealDiscountPercent": number|null, "dealExpiresAt": string|null,
"distance_km": number,
"min_price": number|null,   — effective price at minOrderQuantity after deal
"pickupWindows": [{ id, labelEn, labelHi, startTime, endTime, daysActive }],
"seller": { "id": string, "name": string, "storeName": string, "reliabilityScore": number, "sellerRating": number }
}],
"meta": { "page": number, "limit": number, "total": number, "hasMore": boolean }
}
}
422: VALIDATION_FAILED — lat/lng missing

> Zero results returns `200` with `products: []`. Never `404`.

---

### GET /api/products/:id
Auth:  None (public)

200: { "success": true, "data": { "product": { ...same shape as list item } } }
404: PRODUCT_NOT_FOUND

---

### GET /api/products/deals

All products with active, non-expired deals. Same shape as `GET /api/products`.
Auth:  None (public)
Query: lat (required), lng (required), category?, sortBy?, page?, limit?

200: { "success": true, "data": { "products": [...], "meta": { ... } } }
422: VALIDATION_FAILED

---

## Products — Seller

### GET /api/products/mine
Auth:  Cookie (kridha_access — SELLER)
Query: page?, limit?, category?, status? (ACTIVE|DELETED, default ACTIVE)

200: {
"success": true,
"data": {
"products": [{
...full product, "available": number, "totalOrders": number, "dealActive": boolean
}],
"meta": { page, limit, total, hasMore }
}
}

---

### GET /api/products/mine/:id
Auth:  Cookie (kridha_access — SELLER, own product)

200: { "success": true, "data": { "product": { ...full fields + totalOrders + dealUpdatedAt } } }
403: FORBIDDEN
404: PRODUCT_NOT_FOUND

---

### POST /api/products

Seller must be `kycStatus = VERIFIED` and `profileStatus = VERIFIED`. Upload images to Cloudinary first.
Auth:  Cookie (kridha_access — SELLER)
Body:  {
nameEn: string, nameHi?: string, description?: string,
category: enum, isBranded?: boolean,
imageUrls?: string[] (max 5), blurHash?: string,
available: number (>0), minOrderQty: number (>0), maxOrderQty?: number,
unit: KG|GRAM|LITRE|ML|PIECE|DOZEN|QUINTAL|TON|BUNDLE,
unitIncrement: number (>0),
priceTiers: [{ minQty: number, maxQty?: number, pricePerUnit: number }],  — min 1
latitude: number (8–37), longitude: number (68–98)
}

201: { "success": true, "data": { "product": { ... } } }
403: FORBIDDEN — not VERIFIED
422: VALIDATION_FAILED

---

### PATCH /api/products/:id
Auth:  Cookie (kridha_access — SELLER, own product)
Body:  Partial of POST body — send only fields being changed

200: { "success": true, "data": { "product": { ... } } }
403: FORBIDDEN
404: PRODUCT_NOT_FOUND
422: VALIDATION_FAILED

> Sending `priceTiers` replaces all existing tiers atomically (`deleteMany` + `create` in one operation).

---

### DELETE /api/products/:id

Soft delete — sets `deletedAt`, `productStatus = DELETED`. Disappears from buyer feed immediately.
Auth:  Cookie (kridha_access — SELLER, own product)

200: { "success": true, "message": "Product deleted." }
403: FORBIDDEN
404: PRODUCT_NOT_FOUND

---

### POST /api/products/:id/deal
Auth:  Cookie (kridha_access — SELLER, own product)
Body:  { discountPercent: number (0–100), expiresAt: string (ISO DateTime, future) }

201: { "success": true, "data": { "deal": { discountPercent, expiresAt, status: "ACTIVE" } } }
400: INVALID_EXPIRY_TIME
403: FORBIDDEN
404: PRODUCT_NOT_FOUND
409: DEAL_EXISTS

---

### PATCH /api/products/:id/deal
Auth:  Cookie (kridha_access — SELLER, own product)
Body:  { discountPercent?: number, expiresAt?: string }

200: { "success": true, "data": { "deal": { ... } } }
400: NO_ACTIVE_DEAL | INVALID_EXPIRY_TIME
403: FORBIDDEN
404: PRODUCT_NOT_FOUND

---

### DELETE /api/products/:id/deal
Auth:  Cookie (kridha_access — SELLER, own product)

200: { "success": true, "message": "Deal removed. Original pricing restored." }
400: NO_ACTIVE_DEAL
403: FORBIDDEN
404: PRODUCT_NOT_FOUND

---

### GET /api/products/deals/mine
Auth:  Cookie (kridha_access — SELLER)
Query: status? (active|expired|all, default all), page?, limit?

200: {
"success": true,
"data": {
"deals": [{ id, nameEn, nameHi, category, available, imageUrls, discountPercent, expiresAt, dealActive }],
"meta": { page, limit, total, hasMore }
}
}

---

## Saved Products

### GET /api/saved
Auth:  Cookie (kridha_access — BUYER)
Query: type? (FAVOURITE|SAVED_FOR_LATER), page?, limit?

200: {
"success": true,
"data": {
"saved": [{
"id": string,            — SavedProduct id (use for DELETE)
"type": string,
"product": { ...full product shape with priceTiers, deals, seller }
}],
"meta": { page, limit, total, hasMore }
}
}

---

### POST /api/saved
Auth:  Cookie (kridha_access — BUYER)
Body:  { productId: string, type: FAVOURITE|SAVED_FOR_LATER }

201: { "success": true, "data": { "saved": { id, type, productId } } }
404: PRODUCT_NOT_FOUND
409: ALREADY_SAVED

---

### DELETE /api/saved/:id

`:id` is `SavedProduct.id`, not `Product.id`.
Auth:  Cookie (kridha_access — BUYER, own item)

200: { "success": true, "message": "Removed from list." }
403: FORBIDDEN
404: SAVED_PRODUCT_NOT_FOUND

---

## Upload

### POST /api/upload/sign

Client uploads directly to Cloudinary using this signature — files never pass through Vercel. `CLOUDINARY_API_SECRET` never leaves the server.
Auth:  Cookie (kridha_access — SELLER)
Body:  { folder?: string }

200: {
"success": true,
"data": { "signature": string, "timestamp": number, "cloudName": string, "apiKey": string, "folder": string }
}

**Client upload flow:**

POST /api/upload/sign → { signature, timestamp, cloudName, apiKey, folder }
POST https://api.cloudinary.com/v1_1/{cloudName}/image/upload
FormData: { file, signature, timestamp, api_key, folder }
→ { secure_url, public_id }
POST /api/products  or  PATCH /api/sellers/profile
Body: { imageUrls: [secure_url] }  or  { images: [{ url, publicId }] }


---

## Cart

One active `CartSession` per user. Cart expires 30 min after last activity (extended on every add/update). At checkout, CartItems convert to `SubOrder`s — one per (seller × pickupWindow × pickupDate).

### GET /api/cart
Auth:  Cookie (kridha_access — BUYER)

200: {
"success": true,
"data": {
"cart": {
"id": string|null, "expiresAt": string|null,
"items": [{
"id": string,                — CartItem id (PATCH/DELETE target)
"productId": string,
"productNameEn": string, "productNameHi": string|null,
"category": string, "imageUrls": string[], "blurHash": string|null,
"unit": string, "unitIncrement": number, "available": number,
"dealDiscountPercent": number|null, "dealExpiresAt": string|null,
"quantity": number, "unitPrice": number, "lineTotal": number,
"pickupWindowId": string,
"pickupWindow": { labelEn, labelHi, startTime, endTime },
"pickupDate": string,
"seller": { "id": string, "name": string, "storeName": string }
}],
"summary": { "totalItems": number, "totalAmount": number, "totalAdvance": number, "sellerCount": number }
}
}
}

> Empty cart: `200` with `cart: null`. Never `404`.

---

### POST /api/cart
Auth:  Cookie (kridha_access — BUYER)
Body:  { productId: string, quantity: number, pickupWindowId: string, pickupDate: string (ISO DateTime, future) }

201: { "success": true, "data": { "cartItem": { id, productId, quantity, pickupWindowId, pickupDate } } }
400: WINDOW_UNAVAILABLE | INVALID_PICKUP_DATE
404: PRODUCT_NOT_FOUND
409: INSUFFICIENT_STOCK
422: VALIDATION_FAILED

---

### PATCH /api/cart/:itemId
Auth:  Cookie (kridha_access — BUYER, own cart)
Body:  { quantity: number }

200: { "success": true, "data": { "cartItem": { id, quantity, unitPrice, lineTotal } } }
403: FORBIDDEN
404: CART_ITEM_NOT_FOUND
409: INSUFFICIENT_STOCK

---

### DELETE /api/cart/:itemId
Auth:  Cookie (kridha_access — BUYER, own cart)

200: { "success": true, "message": "Item removed from cart." }
403: FORBIDDEN
404: CART_ITEM_NOT_FOUND

---

### DELETE /api/cart

Clear entire cart. Idempotent — empty cart returns `200` with `{ removed: 0 }`.
Auth:  Cookie (kridha_access — BUYER)

200: { "success": true, "message": "Cart cleared.", "data": { "removed": number } }

---

### POST /api/cart/checkout

No body — server reads `CartSession` from DB by `userId` (INV-19). Stock decremented atomically via `prisma.$transaction()` + `SELECT FOR UPDATE` per seller group.
Auth:  Cookie (kridha_access — BUYER)
Body:  None

201: {
"success": true,
"data": {
"orderId": string,
"subOrders": [{
"id": string, "shortId": string, "sellerId": string, "sellerName": string, "storeName": string,
"totalAmount": number, "advanceAmount": number, "remainingAmount": number,
"status": "PENDING"
}],
"advance": { "razorpayOrderId": string, "amount": number, "currency": "INR" }
}
}
400: CART_EMPTY | BELOW_MINIMUM_ORDER
409: INSUFFICIENT_STOCK
502: RAZORPAY_ERROR

---

## Reviews

### GET /api/reviews
Auth:  None (public)
Query: productId? (string), sellerId? (string), page?, limit?

200: {
"success": true,
"data": {
"reviews": [{
"id": string, "rating": number (1–5), "comment": string|null,
"createdAt": string, "updatedAt": string|null,
"buyer": { "name": string },
"product": { "id": string, "nameEn": string, "nameHi": string|null, "imageUrls": string[] }
}],
"averageRating": number, "totalCount": number,
"meta": { page, limit, total, hasMore }
}
}

---

### POST /api/reviews

One review per product per SubOrder (INV-16). SubOrder must be COMPLETED and owned by caller (INV-15).
Auth:  Cookie (kridha_access — BUYER)
Body:  { subOrderId: string, productId: string, rating: number (1–5), comment?: string (max 500 chars) }

201: { "success": true, "data": { "review": { id, rating, comment, createdAt } } }
403: FORBIDDEN
404: ORDER_NOT_FOUND | PRODUCT_NOT_FOUND
409: REVIEW_ALREADY_EXISTS
422: VALIDATION_FAILED

---

### PATCH /api/reviews/:id
Auth:  Cookie (kridha_access — BUYER, own review)
Body:  { rating?: number, comment?: string }

200: { "success": true, "data": { "review": { id, rating, comment, updatedAt } } }
403: FORBIDDEN
404: REVIEW_NOT_FOUND

---

### DELETE /api/reviews/:id
Auth:  Cookie (kridha_access — BUYER, own review)

200: { "success": true, "message": "Review deleted successfully." }
403: FORBIDDEN
404: REVIEW_NOT_FOUND

---

## Orders

All order endpoints use `:id` = **`SubOrder.id`** except `POST /api/orders` which returns both.

### POST /api/orders

Direct order (not via cart). Price calculated server-side — client sends quantity only (INV-18).
Auth:  Cookie (kridha_access — BUYER)
Body:  {
items: [{ productId: string, quantity: number, pickupWindowId: string, pickupDate: string }],
cartSessionId?: string
}

201: {
"success": true,
"data": {
"order": { "id": string, "totalAmount": number, "advanceAmount": number, "platformFee": number },
"subOrders": [{
"id": string, "shortId": string, "status": "PENDING",
"totalAmount": number, "advanceAmount": number, "remainingAmount": number,
"items": [{ productId, productNameEn, quantity, unitPrice, subtotal }],
"pickupWindow": { id, labelEn, labelHi, startTime, endTime, date },
"seller": { id, name, storeName }
}],
"advance": { "razorpayOrderId": string, "amount": number, "currency": "INR" }
}
}
400: BELOW_MINIMUM_ORDER | WINDOW_UNAVAILABLE | INVALID_PICKUP_DATE
401: UNAUTHENTICATED
409: INSUFFICIENT_STOCK | DUPLICATE_ORDER
502: RAZORPAY_ERROR

---

### GET /api/orders

BUYER sees placed orders. SELLER sees received orders. Same endpoint — role determines DB filter.
Auth:  Cookie (kridha_access — BUYER or SELLER)
Query: status? (PENDING|CONFIRMED|AWAITING_PAYMENT|READY_FOR_OTP_VERIFICATION|COMPLETED|CANCELLED|DISPUTED),
page? (default 1), limit? (default 20), sortBy? (created_asc|created_desc, default created_desc)

200: {
"success": true,
"data": {
"orders": [{
"id": string, "shortId": string, "orderId": string, "status": string,
"totalAmount": number, "advanceAmount": number,
"pickupDate": string, "createdAt": string,
"pickupWindow": { labelEn, labelHi, startTime, endTime },
"orderItems": [{ productNameEn, quantity }],   — max 5 shown
"seller": { "storeName": string },
"buyer": { "name": string }
}],
"meta": { page, limit, total, hasMore }
}
}

> Zero orders: `200` with `orders: []`. Never `404`.

---

### GET /api/orders/:id

Full SubOrder detail including complete status history.
Auth:  Cookie (kridha_access — buyerId or sellerId or ADMIN)

200: {
"success": true,
"data": {
"subOrder": {
"id": string, "shortId": string, "orderId": string, "status": string,
"totalAmount": number, "advanceAmount": number, "remainingAmount": number, "platformFee": number,
"pickupDate": string, "pickupDeadline": string,
"deliveryOtp": string|null,   — present only for buyer when status = READY_FOR_OTP_VERIFICATION
"otpAttempts": number,
"paymentLinkUrl": string|null, "paymentLinkExpiresAt": string|null,
"orderItems": [{ productId, productNameEn, quantity, unitPrice, subtotal }],
"statusHistory": [{ fromStatus, toStatus, timestamp, note }],
"pickupWindow": { id, labelEn, labelHi, startTime, endTime },
"buyer": { "id": string, "name": string },
"seller": { "id": string, "name": string, "storeName": string, "reliabilityScore": number }
}
}
}
403: FORBIDDEN
404: SUBORDER_NOT_FOUND

---

### PATCH /api/orders/:id/cancel
Auth:  Cookie (kridha_access — buyer or seller of this SubOrder)
Body:  { reason?: string }

**Cancellable states:** `PENDING`, `CONFIRMED`

**Refund:** calculated server-side from `pickupDeadline` (INV-13). Client never sends `refundAmount`.

**Seller cancel:** buyer gets 100% refund + `seller.reliabilityScore -= 15`.
200: {
"success": true,
"data": {
"subOrder": { "id": string, "status": "CANCELLED" },
"refundAmount": number, "refundStatus": "INITIATED"|"NOT_APPLICABLE"
}
}
403: FORBIDDEN
404: SUBORDER_NOT_FOUND
409: INVALID_TRANSITION

---

### POST /api/orders/:id/advance

Retry advance payment for a PENDING SubOrder. Used when buyer closes Razorpay modal before completing.
Auth:  Cookie (kridha_access — buyer of this SubOrder)
Body:  None

200: { "success": true, "data": { "razorpayOrderId": string, "amount": number, "currency": "INR" } }
403: FORBIDDEN
404: SUBORDER_NOT_FOUND
409: INVALID_TRANSITION — status must be PENDING
502: RAZORPAY_ERROR

---

### POST /api/orders/:id/request-payment

Seller requests Razorpay payment link for remaining amount. Transitions `CONFIRMED → AWAITING_PAYMENT`.
Auth:  Cookie (kridha_access — SELLER, own SubOrder)
Body:  None

200: {
"success": true,
"data": { "paymentLinkUrl": string, "paymentLinkId": string, "expiresAt": string, "remainingAmount": number }
}
403: FORBIDDEN
404: SUBORDER_NOT_FOUND
409: INVALID_TRANSITION — status must be CONFIRMED
502: RAZORPAY_ERROR

> Payment link expires in 30 minutes. Seller calls this endpoint again for a new link.

---

### POST /api/orders/:id/verify-otp

Seller enters OTP read aloud by buyer. Transitions `READY_FOR_OTP_VERIFICATION → COMPLETED`. OTP set to `null` immediately (INV-06). Payout record created.
Auth:  Cookie (kridha_access — SELLER, own SubOrder)
Body:  { otp: string (4-digit) }

200: {
"success": true,
"data": { "id": string, "shortId": string, "status": "COMPLETED" },
"payoutId": string
}
400: INVALID_OTP
403: FORBIDDEN
404: SUBORDER_NOT_FOUND
409: INVALID_TRANSITION — status must be READY_FOR_OTP_VERIFICATION
429: OTP_ATTEMPTS — 3rd wrong attempt transitions to DISPUTED

---

## Payments / Webhooks

### POST /api/webhooks/razorpay

HMAC signature verified on every request using `RAZORPAY_WEBHOOK_SECRET`. Always returns `200` — prevents Razorpay retry storms.
Auth:  None — HMAC verified server-side
Body:  Razorpay webhook payload

**Events handled:**

| Event | Action |
|-------|--------|
| `payment.captured` | Idempotency check → `PENDING → CONFIRMED` → generate `deliveryOtp` → notify buyer + seller |
| `payment_link.paid` | Idempotency check → `AWAITING_PAYMENT → READY_FOR_OTP_VERIFICATION` → notify buyer + seller |
| All others | Log event type → `200` (ignored safely) |

**Idempotency:** `WebhookLog.razorpayPaymentId @unique` — if the same `paymentId` appears twice (Razorpay retry), the second webhook finds the existing `WebhookLog` row and returns `200` immediately without reprocessing. The DB `@unique` constraint is the final guard under concurrent delivery — application-level checks alone are insufficient.
200: { "success": true, "received": true }

---

## Notifications

### GET /api/notifications
Auth:  Cookie (kridha_access — BUYER or SELLER)
Query: status? (READ|UNREAD), page?, limit? (max 50), sortBy? (created_asc|created_desc)

200: {
"success": true,
"data": [{
"id": string, "title": string, "body": string,
"type": string, "read": boolean, "subOrderId": string|null, "createdAt": string
}],
"unreadCount": number,   — always returned regardless of status filter (bell badge)
"meta": { page, limit, total, hasMore }
}

---

### GET /api/notifications/:id
Auth:  Cookie (kridha_access — owner)

200: { "success": true, "data": { "notification": { id, title, body, type, read, subOrderId, createdAt } } }
403: NOT_YOUR_NOTIFICATION
404: NOTIFICATION_NOT_FOUND

---

### PATCH /api/notifications/:id

Mark single notification as read. Idempotent.
Auth:  Cookie (kridha_access — owner)

200: { "success": true, "data": { "notification": { "id": string, "read": true } } }
403: NOT_YOUR_NOTIFICATION
404: NOTIFICATION_NOT_FOUND

---

### PATCH /api/notifications/read-all
Auth:  Cookie (kridha_access — BUYER or SELLER)

200: { "success": true, "data": { "updated": number } }

---

### DELETE /api/notifications/:id

Soft delete — sets `Notification.deletedAt`.
Auth:  Cookie (kridha_access — owner)

200: { "success": true, "message": "Notification deleted." }
403: NOT_YOUR_NOTIFICATION
404: NOTIFICATION_NOT_FOUND

---

## Admin

All admin routes use `kridha_admin` cookie (separate `ADMIN_JWT_SECRET`, payload `type: "admin"`). Enforced by middleware before `getAdmin()` / `requireSuperAdmin()` in route handlers. Every mutating action appends a row to `AdminAuditLog`.

### POST /api/admin/auth/login
Auth:  None — rate limited: 2 req/min per IP (hardest limit)
Body:  { email: string, password: string }

200: { "success": true, "data": { "admin": { id, email, name, role } } }
Set-Cookie: kridha_admin=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800
401: ADMIN_INVALID_CREDENTIALS
403: ADMIN_ACCOUNT_LOCKED

---

### POST /api/admin/auth/logout
Auth:  Cookie (kridha_admin)

200: { "success": true }
Set-Cookie: kridha_admin=; Max-Age=0; Path=/api/admin

---

### GET /api/admin/sellers
Auth:  Cookie (kridha_admin)
Query: status? (PENDING|VERIFIED|DEACTIVATED), page?, limit?

200: {
"success": true,
"data": {
"sellers": [{
"userId": string, "storeName": string, "city": string, "state": string,
"profileStatus": string, "kycStatus": string,
"sellerRating": number, "reliabilityScore": number, "createdAt": string,
"user": { "name": string, "phone": string }
}],
"total": number, "page": number, "limit": number, "hasMore": boolean
}
}

---

### GET /api/admin/sellers/:userId

Returns full seller profile including **unmasked** bank details (INV-17 — admin only).
Auth:  Cookie (kridha_admin)

200: {
"success": true,
"data": {
"seller": {
...full SellerProfile fields,
"accountNumber": string,   — UNMASKED
"user": { "name": string, "phone": string, "createdAt": string }
}
}
}
404: SELLER_NOT_FOUND

---

### PATCH /api/admin/sellers/:userId

Verify, reject, or suspend a seller. Action written to `AdminAuditLog`.
Auth:  Cookie (kridha_admin)
Body:  { action: VERIFY|REJECT|SUSPEND, note?: string }

200: { "success": true, "data": { "seller": { userId, profileStatus, kycStatus } } }
404: SELLER_NOT_FOUND
409: SELLER_ALREADY_VERIFIED | SELLER_ALREADY_SUSPENDED

---

### GET /api/admin/audit-log
Auth:  Cookie (kridha_admin — SUPER_ADMIN only)
Query: targetId?, adminId?, limit? (default 50)

200: {
"success": true,
"data": [{
"id": string, "action": string, "targetType": string, "targetId": string,
"note": string|null, "metadata": object|null, "createdAt": string,
"admin": { "name": string, "email": string }
}]
}
403: ADMIN_FORBIDDEN

---

## Cron

All cron routes verify `Authorization: Bearer <CRON_SECRET>`. Vercel sets this automatically. Any other caller returns `401`.

### GET /api/cron/expire-deals

Sets `Deal.status = EXPIRED` for all deals where `expiresAt < NOW() AND status = ACTIVE`. Enforces INV-09.
Auth:  Bearer CRON_SECRET (Vercel automatic)
Schedule: 0 1 * * * (01:00 UTC daily)

200: { "success": true, "data": { "expired": number } }
401: UNAUTHENTICATED

---

### GET /api/cron/expire-orders

Cancels PENDING SubOrders past `pickupDeadline`. Applies no-show penalty (`reliabilityScore -= 15`, `noShowCount++`, `creditBalance -= 20`). Fires `NO_SHOW_PENALTY` notification.
Auth:  Bearer CRON_SECRET
Schedule: 0 2 * * * (02:00 UTC daily)

200: { "success": true, "data": { "cancelled": number, "penaltiesApplied": number } }

---

### GET /api/cron/transfer-advances

Processes COMPLETED SubOrders with PENDING payouts → PROCESSING → initiates Razorpay bank transfer.
Auth:  Bearer CRON_SECRET
Schedule: 0 3 * * * (03:00 UTC = 08:30 IST daily)

200: { "success": true, "data": { "processed": number, "failed": number } }

---

## System Invariants

| # | Invariant | Enforcement Node |
|---|-----------|-----------------|
| INV-01 | `product.available` never goes negative | `DB CHECK (available >= 0)` + `SELECT FOR UPDATE` in `src/services/order.service.ts` |
| INV-02 | COMPLETED/CANCELLED status cannot change | `src/lib/state-machine.ts` → `validateTransition()` — terminal states have empty edge arrays |
| INV-03 | Payment webhook processed exactly once | `WebhookLog.razorpayPaymentId @unique` + `prisma.$transaction` in `src/app/api/webhooks/razorpay/route.ts` |
| INV-04 | BUYER cannot access seller routes | `src/lib/get-user.ts` → `requireRole(req, Role.SELLER)` reads `kridha_access` cookie |
| INV-05 | User sees only own orders | `src/lib/get-user.ts` + `src/repo/order.repo.ts` — `OR [buyerId, sellerId]` filter |
| INV-06 | OTP cleared after verification | `src/services/payment.service.ts` → `verifyOtp()` sets `deliveryOtp = null` in same transaction |
| INV-07 | Phone is unique user identifier | `prisma/schema.prisma` → `phone @unique`. Silent signup in `src/services/auth.service.ts` |
| INV-08 | Seller store name + address unique | `prisma/schema.prisma` → `@@unique([storeName, street])` |
| INV-09 | Deal price reverts after expiry | `src/app/api/cron/expire-deals/route.ts` + `src/lib/postgis.ts` — JOIN only `ACTIVE AND expiresAt > NOW()` |
| INV-10 | Order total ≥ ₹1,000 | `src/services/order.service.ts` checks `PlatformConfig.minOrderAmountPerSeller` |
| INV-11 | Order cannot confirm without captured advance | `src/app/api/webhooks/razorpay/route.ts` only — no manual promotion endpoint |
| INV-12 | Order cannot complete without payment AND OTP | `src/lib/state-machine.ts` — `READY_FOR_OTP_VERIFICATION` required before `verifyOtp()` |
| INV-13 | Refund calculated server-side only | `src/lib/refund.ts` → `calcRefundAmount(advance, pickupDeadline, cancelledBy)` |
| INV-14 | Seller cannot see own products in feed | `src/lib/postgis.ts` → `buildWhereClause()` appends `AND p."sellerId" != $userId` |
| INV-15 | Review only after COMPLETED SubOrder | `src/services/review.service.ts` verifies `status === COMPLETED` and `buyerId === userId` |
| INV-16 | One review per order per product | `prisma/schema.prisma` → `Review.@@unique([subOrderId, productId])` |
| INV-17 | Bank details masked in non-admin responses | `src/app/api/sellers/profile/route.ts` masks; `src/repo/admin.repo.ts` returns unmasked |
| INV-18 | Client never sends status transitions | `src/schemas/index.ts` — Zod schemas omit `status` field entirely |
| INV-19 | Cart checkout reads from server state only | `src/app/api/cart/checkout/route.ts` takes no body — reads `CartSession` by `userId` from DB |You said: Convert above API.Convert above API.md content into a editable file.22:17Read docx skillRead docx skillSonnet 4.6Session: 100% · resets in 3h 23mWeekly: 30% · resets in 13h 43m