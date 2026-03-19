# Kridha — API Contract

> **Version:** 1.0.0-beta
> **Last updated:** March 2026
> **Author:** Abhishek · DevWithAbhishek

---

## Base URLs

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:3000` |
| Production | `https://kridha.vercel.app` |

---

## Response Envelope

Every response — success or error — follows this shape:
```json
// Success with data
{ "success": true, "data": { } }

// Success with message
{ "success": true, "message": "..." }

// Error
{ "success": false, "code": "MACHINE_READABLE_CODE", "message": "Human readable." }
```

---

## Authentication

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

Access tokens expire in **15 minutes**.
Use `POST /api/auth/refresh` to get a new pair silently.

---

## Table of Contents

- [Auth](#auth)
  - [POST /api/auth/signup](#post-apiauthsignup)
  - [POST /api/auth/login](#post-apiauthlogin)
  - [POST /api/auth/refresh](#post-apiauthrefresh)
  - [POST /api/auth/logout](#post-apiauthlogout)
  - [POST /api/auth/logout-all](#post-apiauthlogout-all)
- [Products — Buyer](#products--buyer)
  - [GET /api/products](#get-apiproducts)
  - [GET /api/products/:id](#get-apiproductsid)
- [Products — Seller](#products--seller)
  - [GET /api/products/mine](#get-apiproductsmine)
  - [POST /api/products](#post-apiproducts)
  - [PATCH /api/products/:id](#patch-apiproductsid)
  - [DELETE /api/products/:id](#delete-apiproductsid)
- [Upload](#upload)
  - [POST /api/upload/sign](#post-apiuploadsign)
- [Orders](#orders)
  - [POST /api/orders](#post-apiorders)
  - [GET /api/orders](#get-apiorders)
  - [GET /api/orders/:id](#get-apiordersid)
  - [PATCH /api/orders/:id/cancel](#patch-apiordersidcancel)
  - [POST /api/orders/:id/advance](#post-apiordersidadvance)
  - [POST /api/orders/:id/request-payment](#post-apiordersidrequest-payment)
  - [POST /api/orders/:id/verify-otp](#post-apiordersidverify-otp)
- [Payments](#payments)
  - [POST /api/webhooks/razorpay](#post-apiwebhooksrazorpay)
- [Notifications](#notifications)
  - [GET /api/notifications](#get-apinotifications)
  - [GET /api/notifications/:id](#get-apinotificationsid)
  - [PATCH /api/notifications/:id](#patch-apinotificationsid)
  - [PATCH /api/notifications/read-all](#patch-apinotificationsread-all)
  - [DELETE /api/notifications/:id](#delete-apinotificationsid)
- [Error Code Reference](#error-code-reference)
- [System Invariants](#system-invariants)

---

## Auth

### POST /api/auth/signup

Create a new account. Does not issue tokens.
Explicit login required after signup.
```
Auth:    None
Body:    {
  phone:   string   required — 10-digit Indian mobile number
  pin:     string   required — exactly 4 digits
  name:    string   required — display name
}
```

**Success**
```
201: {
  "success": true,
  "message": "Account created. Login to continue."
}
```

**Errors**
```
422:  VALIDATION_FAILED   — "phone must be 10 digits. PIN must be 4 digits."
409:  PHONE_EXISTS        — "Phone already registered. Please login."
429:  RATE_LIMITED        — "Too many attempts. Try again in 30 minutes."
```

---

### POST /api/auth/login

Authenticate with phone and PIN.
Returns a JWT access + refresh token pair.
```
Auth:    None
Body:    {
  phone:   string   required
  pin:     string   required
}
```

**Success**
```
200: {
  "success": true,
  "data": {
    "accessToken":  string   — JWT, expires in 15 minutes
    "refreshToken": string   — JWT, expires in 7 days
  }
}
```

**Errors**
```
401:  INVALID_CREDENTIALS  — "Invalid phone or PIN."
429:  PIN_LOCKED           — "Too many attempts. Try again in 10 minutes."
```

> Both wrong phone and wrong PIN return the same `401 INVALID_CREDENTIALS`.
> This prevents phone number enumeration attacks.

---

### POST /api/auth/refresh

Exchange a valid refresh token for a new access + refresh token pair.
Both tokens rotate on every call — the old refresh token is immediately revoked.
```
Auth:    None
         (refreshToken in body is the credential — no Bearer header)
Body:    {
  refreshToken:   string   required
}
```

**Success**
```
200: {
  "success": true,
  "data": {
    "accessToken":  string   — new JWT, expires in 15 minutes
    "refreshToken": string   — new JWT, old refresh token revoked
  }
}
```

**Errors**
```
401:  REFRESH_TOKEN_INVALID — "Session expired or invalid. Please login."
```

> Reusing an already-rotated refresh token invalidates the entire token
> family — all sessions for that user are revoked. This detects token theft.

---

### POST /api/auth/logout

Revoke the current device session.
All other active sessions remain unaffected.
```
Auth:    Bearer
Body:    {
  refreshToken:   string   required — revokes this specific session
}
```

**Success**
```
200: {
  "success": true,
  "message": "Logged out successfully."
}
```

**Errors**
```
401:  REFRESH_TOKEN_INVALID — "Invalid or expired token."
```

---

### POST /api/auth/logout-all

Revoke all sessions across every device.
User must re-login on every device after this call.
```
Auth:    Bearer
Body:    None
```

**Success**
```
200: {
  "success": true,
  "message": "Logged out from all devices."
}
```

**Errors**
```
401:  UNAUTHENTICATED — "Invalid or expired token."
```

---

## Products — Buyer

### GET /api/products

Fetch nearby products filtered by location and optional criteria.
Results are paginated. Default sort is by distance (nearest first).
```
Auth:    None (Public)
Body:    None

Query params:
  lat           Float    required — buyer's current latitude
  lng           Float    required — buyer's current longitude
  radius        Int      optional — km, default: 10, max: 50
  category      String   optional — see category enum below
  minPrice      Decimal  optional — filter by minimum pricePerUnit
  maxPrice      Decimal  optional — filter by maximum pricePerUnit
  isBranded     Boolean  optional — true | false
  dealActive    Boolean  optional — true returns only products with
                                    active deal (dealExpiresAt in future)
  sortBy        String   optional — price_asc | price_desc | distance
                                    default: distance
  page          Int      optional — default: 1
  limit         Int      optional — default: 20, max: 50
```

**Success**
```
200: {
  "success": true,
  "data": {
    "products": [
      {
        "id":                   string,
        "name":                 string,
        "nameHi":               string | null,
        "description":          string | null,
        "category":             string,
        "isBranded":            boolean,
        "unit":                 string,
        "unitIncrement":        number,
        "minOrderQty":          number,
        "maxOrderQty":          number | null,
        "priceTiers": [
          {
            "minQty":           number,
            "maxQty":           number | null,
            "pricePerUnit":     number
          }
        ],
        "available":            number,
        "imageUrls":            string[],
        "blurHash":             string | null,
        "dealDiscountPercent":  number | null,
        "dealExpiresAt":        string | null,
        "distance_km":          number,
        "pickupWindows": [
          {
            "id":               string,
            "label":            string,
            "labelHi":          string,
            "startTime":        string,
            "endTime":          string,
            "daysActive":       string[]
          }
        ],
        "seller": {
          "id":                 string,
          "name":               string,
          "storeName":          string,
          "reliabilityScore":   number,
          "verificationBadges": string[]
        }
      }
    ],
    "meta": {
      "page":     number,
      "limit":    number,
      "total":    number,
      "hasMore":  boolean
    }
  }
}
```

**Errors**
```
None
```

> Zero results returns `200` with `products: []` and `total: 0`.
> Empty results are never a `404`.

---

### GET /api/products/:id

Fetch full detail of a single product by ID.
```
Auth:    None (Public)
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "product": { }   — same shape as individual item in GET /api/products
  }
}
```

**Errors**
```
404:  PRODUCT_NOT_FOUND   — "Product not found or no longer available."
```

---

## Products — Seller

### GET /api/products/mine

Fetch all products belonging to the authenticated seller.
Includes operational fields not exposed to buyers.
```
Auth:    Bearer (SELLER only)
Body:    None

Query params:
  page      Int      optional — default: 1
  limit     Int      optional — default: 20
  category  String   optional
  status    String   optional — ACTIVE | DELETED, default: ACTIVE
```

**Success**
```
200: {
  "success": true,
  "data": {
    "products": [
      {
        ...full product object,
        "available":    number,
        "totalOrders":  number,
        "dealActive":   boolean
      }
    ],
    "meta": {
      "page":    number,
      "limit":   number,
      "total":   number,
      "hasMore": boolean
    }
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED — "Invalid or expired token."
403:  FORBIDDEN       — "You don't have access to this resource."
```

> Zero products returns `200` with `products: []`. Never `404`.

---

### POST /api/products

Create a new product listing.
Upload images to Cloudinary first via `POST /api/upload/sign` —
only the returned URLs are sent here.
```
Auth:    Bearer (SELLER only)
Body:    {
  name:                 string    required
  nameHi:               string    optional
  description:          string    optional
  category:             enum      required
                        GRAINS | DAIRY | OIL | SPICES | VEGETABLES |
                        FRUITS | PULSES | FLOUR | BEVERAGES | OTHER
  isBranded:            boolean   optional, default: false
  imageUrls:            string[]  optional, max 5 Cloudinary URLs
  blurHash:             string    optional, for hero image (imageUrls[0])
  available:            number    required, must be > 0
  minOrderQty:          number    required, must be > 0
  maxOrderQty:          number    optional
  unit:                 enum      required
                        KG | GRAM | LITRE | ML | PIECE |
                        DOZEN | QUINTAL | TON | BUNDLE
  unitIncrement:        number    required, must be > 0
  priceTiers:           array     required, min 1 entry
    [{
      minQty:           number    required, must be > 0
      maxQty:           number    optional
      pricePerUnit:     number    required, must be > 0
    }]
  latitude:             number    required, India bounds: 8 to 37
  longitude:            number    required, India bounds: 68 to 98
  dealDiscountPercent:  number    optional, 0 to 100
  dealExpiresAt:        DateTime  optional
                        required if dealDiscountPercent is provided
}
```

**Success**
```
201: {
  "success": true,
  "data": {
    "product": { }   — full product object, same shape as GET /api/products
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED  — "Please login to continue."
403:  FORBIDDEN        — "You don't have access to this resource."
422:  VALIDATION_FAILED — { "fields": [{ "path": "...", "message": "..." }] }
```

> `imageUrls[0]` is the hero/cover image shown in the product feed.
> Client controls display order by controlling array order.

---

### PATCH /api/products/:id

Update any fields on an existing product.
Send only the fields being changed — all others remain unchanged.

**Image management via this endpoint:**
- Add image — append new Cloudinary URL to existing array
- Delete image — omit that URL from the array
- Reorder — send reordered array (`imageUrls[0]` = new hero image)
```
Auth:    Bearer (SELLER — own product only)
Body:    {
  name?:                string
  nameHi?:              string
  description?:         string
  category?:            enum
  isBranded?:           boolean
  imageUrls?:           string[]   full replacement array
  blurHash?:            string     update when hero image changes
  available?:           number
  minOrderQty?:         number
  maxOrderQty?:         number
  unit?:                enum
  unitIncrement?:       number
  priceTiers?:          array
  dealDiscountPercent?: number
  dealExpiresAt?:       DateTime
}
```

**Success**
```
200: {
  "success": true,
  "data": {
    "product": { }
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
403:  FORBIDDEN         — "You can only edit your own products."
404:  PRODUCT_NOT_FOUND — "Product not found."
422:  VALIDATION_FAILED — { "fields": [{ "path": "...", "message": "..." }] }
```

---

### DELETE /api/products/:id

Soft delete a product. Sets `deletedAt` timestamp — DB row is retained.
Product disappears from buyer feed immediately.
Existing orders referencing this product are unaffected.
```
Auth:    Bearer (SELLER — own product only)
Body:    None
```

**Success**
```
200: {
  "success": true,
  "message": "Product deleted."
}
```

**Errors**
```
401:  UNAUTHENTICATED     — "Please login to continue."
403:  FORBIDDEN           — "You can only delete your own products."
404:  PRODUCT_NOT_FOUND   — "Product not found."
```

---

## Upload

### POST /api/upload/sign

Generate a signed Cloudinary upload credential.
The client uploads directly to Cloudinary using this signature —
files never pass through Kridha's servers.
`CLOUDINARY_API_SECRET` never leaves the server.
```
Auth:    Bearer (SELLER only)
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "signature":  string   — HMAC of (timestamp + folder)
    "timestamp":  number   — Unix timestamp, valid for 1 hour
    "cloudName":  string   — Cloudinary cloud name (public)
    "apiKey":     string   — Cloudinary API key (public)
    "folder":     string   — "kridha/products"
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED     — "Please login to continue."
403:  FORBIDDEN     — "Only sellers can upload product images."
```

**Client upload flow:**
```
1.  POST /api/upload/sign
    → receive { signature, timestamp, cloudName, apiKey, folder }

2.  POST https://api.cloudinary.com/v1_1/{cloudName}/image/upload
    FormData: { file, signature, timestamp, api_key, folder }
    → receive { secure_url }

3.  POST /api/products  or  PATCH /api/products/:id
    Body: { imageUrls: [secure_url] }
```

**Constraints enforced by Cloudinary:**
```
Max file size:    5 MB
Allowed formats:  jpg, jpeg, png, webp
Auto transform:   f_auto, q_auto, w_1200 applied on upload
```

---


## 5. Orders

### POST /api/orders
Create a new order. Calculates price server-side from PriceTier — client
never sends price. Decrements stock atomically inside a single
`prisma.$transaction()` with `SELECT FOR UPDATE`. Creates Razorpay advance
order in the same flow.
```
Auth:    Bearer (BUYER only)
Body:    {
  items: [
    {
      productId:      string    required — cuid
      quantity:       number    required — positive, multiple of unitIncrement
      pickupWindowId: string    required — cuid
      pickupDate:     string    required — DateTime, must be future date
                                           within seller's active days
    }
  ]
  cartSessionId?:   string    optional — if placing multi-seller cart order
}
```

**Success**
```
201: {
  "success": true,
  "data": {
    "order": {
      "id":               string,
      "shortId":          string,
      "status":           "PENDING",
      "totalAmount":      number,
      "advanceAmount":    number,
      "remainingAmount":  number,
      "platformFeeAmount": number,
      "items": [
        {
          "productId":    string,
          "productName":  string,
          "quantity":     number,
          "unitPrice":    number,
          "subtotal":     number
        }
      ],
      "pickupWindow": {
        "id":             string,
        "label":          string,
        "labelHi":        string,
        "startTime":      string,
        "endTime":        string,
        "date":           string
      },
      "seller": {
        "id":             string,
        "name":           string,
        "storeName":      string
      }
    },
    "advance": {
      "razorpayOrderId":  string,
      "amount":           number,
      "currency":         "INR"
    }
  }
}
```

**Errors**
```
400:  BELOW_MINIMUM_ORDER   — "Order total is below the minimum order amount."
                               meta: { minimum: 1000, current: number }
400:  WINDOW_UNAVAILABLE    — "This pickup window is unavailable."
400:  INVALID_PICKUP_DATE   — "Pickup date is invalid or in the past."
401:  UNAUTHENTICATED   — "Please login to continue."
403:  FORBIDDEN             — "Only buyers can place orders."
409:  INSUFFICIENT_STOCK    — "Not enough stock available."
                               meta: { productId, productName,
                                       requested, available }
409:  DUPLICATE_ORDER       — "An active order already exists for this
                               product and pickup window."
422:  VALIDATION_FAILED     — { "fields": [{ "path", "message" }] }
502:  RAZORPAY_ERROR        — "Payment service error. Please retry."
```

> **Price is always calculated server-side** from PriceTier + quantity.
> Never trust client-supplied price. Client sends quantity only.
>
> **Stock decrement** happens inside `prisma.$transaction()` with
> `SELECT FOR UPDATE`. Two concurrent buyers for the last item —
> exactly one gets 201, one gets 409 INSUFFICIENT_STOCK.
>
> **Advance formula:** `MIN(₹500, MAX(₹100, total × 5%))`
> ₹1000 order → ₹100 advance. ₹5000 order → ₹250. ₹10000+ → ₹500.

---

### GET /api/orders
List orders for the authenticated user. BUYER sees orders they placed.
SELLER sees orders placed with them. Same endpoint — role determines
the DB filter.
```
Auth:    Bearer (BUYER or SELLER)
Body:    None

Query params:
  status    String    optional — PENDING | CONFIRMED | AWAITING_PAYMENT |
                                 READY_FOR_OTP_VERIFICATION | COMPLETED |
                                 CANCELLED | DISPUTED
  page      Int       optional — default: 1
  limit     Int       optional — default: 20
  sortBy    String    optional — created_asc | created_desc
                                 default: created_desc
```

**Success**
```
200: {
  "success": true,
  "data": {
    "orders": [
      {
        "id":             string,
        "shortId":        string,
        "status":         string,
        "totalAmount":    number,
        "advanceAmount":  number,
        "pickupDate":     string,
        "pickupWindow": {
          "label":        string,
          "labelHi":      string,
          "startTime":    string,
          "endTime":      string
        },
        "items": [
          {
            "productName": string,
            "quantity":    number
          }
        ],
        "seller": {
          "name":         string,
          "storeName":    string
        },
        "buyer": {
          "name":         string
        }
      }
    ],
    "meta": {
      "page":     number,
      "limit":    number,
      "total":    number,
      "hasMore":  boolean
    }
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
```

> Zero orders returns `200` with `orders: []` and `total: 0`. Never `404`.
>
> BUYER response includes `seller` field.
> SELLER response includes `buyer` field.
> Both always present in response — client decides which to display.

---

### GET /api/orders/:id
Fetch full detail of a single order including complete status history.
```
Auth:    Bearer
Rule:    req.user.id must equal order.buyerId
         OR req.user.id must equal order.sellerId
         OR req.user.role must equal ADMIN
         Anyone else receives 403 even with a valid token.
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "order": {
      "id":                 string,
      "shortId":            string,
      "status":             string,
      "totalAmount":        number,
      "advanceAmount":      number,
      "remainingAmount":    number,
      "platformFeeAmount":  number,
      "paymentMode":        string,
      "advanceStatus":      string,
      "items": [
        {
          "productId":      string,
          "productName":    string,
          "quantity":       number,
          "unitPrice":      number,
          "subtotal":       number
        }
      ],
      "statusHistory": [
        {
          "status":         string,
          "timestamp":      string,
          "note":           string | null
        }
      ],
      "pickupWindow": {
        "id":               string,
        "label":            string,
        "labelHi":          string,
        "startTime":        string,
        "endTime":          string,
        "date":             string
      },
      "buyer": {
        "id":               string,
        "name":             string
      },
      "seller": {
        "id":               string,
        "name":             string,
        "storeName":        string,
        "reliabilityScore": number
      }
    }
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
403:  FORBIDDEN       — "You are not authorized to view this order."
404:  ORDER_NOT_FOUND — "Order not found."
```

---

### PATCH /api/orders/:id/cancel
Cancel an order. Refund amount depends on how far the cancellation is
from the scheduled pickup time.
```
Auth:    Bearer (BUYER or SELLER)
Rule:    BUYER  can cancel: PENDING, CONFIRMED
         SELLER can cancel: PENDING, CONFIRMED
                            buyer receives 100% refund
                            seller reliabilityScore −15
         NEITHER can cancel: AWAITING_PAYMENT, READY_FOR_OTP_VERIFICATION,
                             COMPLETED, CANCELLED, DISPUTED
Body:    {
  reason?:  string   optional
}
```

**Refund tiers**
```
Cancel before advance paid           → no charge
Cancel 24h+ before pickup            → 100% advance refunded to buyer
Cancel 2–24h before pickup           → 50% to buyer, 50% to seller
Cancel within 2h or on inspection    → 0% to buyer, 100% to seller
Seller cancels at any point          → 100% to buyer, seller score −15
```

**Success**
```
200: {
  "success": true,
  "data": {
    "order": {
      "id":       string,
      "status":   "CANCELLED"
    },
    "refundAmount":  number,
    "refundStatus":  "INITIATED" | "NOT_APPLICABLE"
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED          — "Please login to continue."
403:  FORBIDDEN                — "You are not authorized to cancel this order."
404:  ORDER_NOT_FOUND          — "Order not found."
409:  INVALID_TRANSITION       — "Order cannot be cancelled in its current status."
                                  meta: { currentStatus, cancellableStatuses }
```

---

### POST /api/orders/:id/advance
Retry the advance payment flow. Used when buyer closes the Razorpay
modal before completing payment and needs to reopen it.
```
Auth:    Bearer (BUYER — own order only)
Rule:    Order status must be PENDING
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "razorpayOrderId":  string,
    "amount":           number,
    "currency":         "INR"
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED     — "Please login to continue."
403:  FORBIDDEN           — "Only the buyer can retry advance payment."
404:  ORDER_NOT_FOUND     — "Order not found."
409:  INVALID_TRANSITION  — "Advance payment only available for PENDING orders."
502:  RAZORPAY_ERROR      — "Payment service error. Please retry."
```

---

### POST /api/orders/:id/request-payment
Seller requests a Razorpay payment link for the remaining order amount.
Called after buyer has arrived, inspected goods, and is ready to pay.
Transitions order from CONFIRMED → AWAITING_PAYMENT.
```
Auth:    Bearer (SELLER — own order only)
Rule:    Order status must be CONFIRMED
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "paymentLinkUrl":   string,
    "paymentLinkId":    string,
    "expiresAt":        string,
    "remainingAmount":  number
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED     — "Please login to continue."
403:  FORBIDDEN           — "Only the seller can request payment."
404:  ORDER_NOT_FOUND     — "Order not found."
409:  INVALID_TRANSITION  — "Payment can only be requested for CONFIRMED orders."
502:  RAZORPAY_ERROR      — "Payment link creation failed. Please retry."
```

> **Side effect:** order transitions CONFIRMED → AWAITING_PAYMENT immediately.
> Payment link expires in 30 minutes. After expiry seller must call this
> endpoint again to generate a new link.

---

### POST /api/orders/:id/verify-otp
Seller enters the OTP read aloud by the buyer to complete the order.
OTP is generated when order reaches CONFIRMED status and delivered
to buyer via in-app notification.
```
Auth:    Bearer (SELLER — own order only)
Rule:    Order status must be READY_FOR_OTP_VERIFICATION
Body:    {
  otp:  string   required — 4 digits
}
```

**Success**
```
200: {
  "success": true,
  "data": {
    "order": {
      "id":     string,
      "status": "COMPLETED"
    }
  }
}
```

**Errors**
```
400:  INVALID_OTP         — "Invalid or expired OTP."
401:  UNAUTHENTICATED     — "Please login to continue."
403:  FORBIDDEN           — "Only the seller can verify OTP."
404:  ORDER_NOT_FOUND     — "Order not found."
409:  INVALID_TRANSITION  — "OTP verification only available for orders in
                             READY_FOR_OTP_VERIFICATION status."
429:  OTP_ATTEMPTS        — "Too many incorrect attempts."
```

> **Side effects on COMPLETED:**
> - `deliveryOtp` set to `null` immediately — never stored beyond use (INV-06)
> - Payout record created for seller (amount = total − platformFee)
> - In-app notification fires for buyer and seller
> - After 3 wrong attempts order moves to DISPUTED status

---

## 6. Payments

### POST /api/webhooks/razorpay
Receives payment event callbacks from Razorpay. HMAC signature verified
on every request. Always returns 200 — Razorpay retries on any non-200
response which causes double-processing.
```
Auth:    None — Razorpay calls this directly
         HMAC signature verified server-side using RAZORPAY_WEBHOOK_SECRET
         Signature failure → log to Sentry → return 200 silently
Body:    Razorpay webhook payload (received from Razorpay)
         {
           event:    string,
           payload:  { payment: { entity: { id, amount, ... } } }
         }
```

**Events handled**
```
payment.captured →
  Idempotency check: WebhookLog.razorpayPaymentId @unique
  If already processed → return 200 immediately (no reprocessing)
  If new →
    order: PENDING → CONFIRMED
    generate deliveryOtp (4 digits)
    insert into WebhookLog atomically
    fire notification → buyer (OTP + pickup window)
    fire notification → seller (new order confirmed)

payment_link.paid →
  Idempotency check: WebhookLog.razorpayPaymentId @unique
  If already processed → return 200 immediately
  If new →
    order: AWAITING_PAYMENT → READY_FOR_OTP_VERIFICATION
    insert into WebhookLog atomically
    fire notification → buyer (show OTP to seller)
    fire notification → seller (buyer is ready, request OTP)

All other events →
  Log event type
  Return 200 (ignore safely — do not error)
```

**Success**
```
200: { "success": true, "received": true }
```

> **Always returns 200. No exceptions.**
> Signature failure, processing error, duplicate event —
> all return 200. Errors are logged to Sentry, never exposed
> to Razorpay. This prevents Razorpay retry storms.
>
> This is INV-03: payment webhook processed exactly once.
> `WebhookLog.razorpayPaymentId @unique` enforces idempotency at DB level.

---

## 7. Notifications

### GET /api/notifications
Fetch all notifications for the authenticated user.
Both BUYER and SELLER use the same endpoint —
results are automatically filtered to `req.user.id`.
```
Auth:    Bearer (BUYER or SELLER)
Body:    None

Query params:
  status    String    optional — READ | UNREAD
                                 omit to return all
  page      Int       optional — default: 1
  limit     Int       optional — default: 20, max: 50
  sortBy    String    optional — created_asc | created_desc
                                 default: created_desc
```

**Success**
```
200: {
  "success": true,
  "data": {
    "notifications": [
      {
        "id":          string,
        "title":       string,
        "body":        string,
        "type":        string,
        "read":        boolean,
        "orderId":     string | null,
        "createdAt":   string
      }
    ],
    "unreadCount": number,
    "meta": {
      "page":     number,
      "limit":    number,
      "total":    number,
      "hasMore":  boolean
    }
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
```

> Zero notifications returns `200` with `notifications: []` and
> `total: 0`. Never returns `404`.
>
> `unreadCount` is always returned regardless of status filter —
> used to render the bell badge in the UI.

---

### GET /api/notifications/:id
Fetch a single notification by ID.
```
Auth:    Bearer (BUYER or SELLER)
Rule:    req.user.id must equal notification.userId
         Anyone else receives 403 even with a valid token.
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "notification": {
      "id":          string,
      "title":       string,
      "body":        string,
      "type":        string,
      "read":        boolean,
      "orderId":     string | null,
      "createdAt":   string
    }
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED        — "Please login to continue."
403:  FORBIDDEN              — "You cannot access this notification."
404:  NOTIFICATION_NOT_FOUND — "Notification not found."
```

---

### PATCH /api/notifications/:id
Mark a single notification as read.
```
Auth:    Bearer (BUYER or SELLER)
Rule:    req.user.id must equal notification.userId
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "notification": {
      "id":    string,
      "read":  true
    }
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED        — "Please login to continue."
403:  FORBIDDEN              — "You cannot access this notification."
404:  NOTIFICATION_NOT_FOUND — "Notification not found."
```

> Calling this on an already-read notification returns `200` —
> idempotent, no error.

---

### PATCH /api/notifications/read-all
Mark all notifications as read for the authenticated user.
```
Auth:    Bearer (BUYER or SELLER)
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "updated": number
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
```

> If zero unread notifications exist returns
> `200` with `{ updated: 0 }`. Never an error.

---

### DELETE /api/notifications/:id
Permanently delete a notification.
Hard delete — row is removed from DB.
```
Auth:    Bearer (BUYER or SELLER)
Rule:    req.user.id must equal notification.userId
Body:    None
```

**Success**
```
200: {
  "success": true,
  "message": "Notification deleted."
}
```

**Errors**
```
401:  UNAUTHENTICATED        — "Please login to continue."
403:  FORBIDDEN              — "You cannot access this notification."
404:  NOTIFICATION_NOT_FOUND — "Notification not found."
```



## Error Code Reference

| Code | HTTP | When it occurs |
|------|------|----------------|
| `VALIDATION_FAILED` | 422 | Zod schema validation failed. Returns `fields` array with path and message per field. |
| `UNAUTHENTICATED` | 401 | Missing, invalid, or expired Bearer token. |
| `FORBIDDEN` | 403 | Valid token but wrong role or not the resource owner. |
| `RATE_LIMITED` | 429 | Too many requests to this endpoint. |
| `PHONE_EXISTS` | 409 | Phone number already registered on signup. |
| `INVALID_CREDENTIALS` | 401 | Wrong phone or PIN on login. |
| `PIN_LOCKED` | 429 | Too many consecutive failed login attempts. |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token expired, revoked, or already rotated. |
| `PRODUCT_NOT_FOUND` | 404 | Product does not exist or has been soft-deleted. |  
| `ORDER_NOT_FOUND` | 404 | Order does not exist. |
| `INSUFFICIENT_STOCK` | 409 | Requested quantity exceeds `product.available`. |
| `BELOW_MINIMUM_ORDER` | 400 | Order total below platform minimum of ₹1000. |
| `WINDOW_UNAVAILABLE` | 400 | Pickup window is closed or does not exist. |
| `INVALID_PICKUP_DATE` | 400 | Pickup date is in the past or outside seller active days. |
| `DUPLICATE_ORDER` | 409 | Active order already exists for this product and window. |
| `CANCELLATION_NOT_ALLOWED` | 400 | Order cannot be cancelled at this stage. |
| `INVALID_OTP` | 400 | OTP is incorrect or has already been cleared. |
| `OTP_ATTEMPTS` | 429 | Too many consecutive wrong OTP attempts. |
| `INVALID_TRANSITION` | 409 | Order state machine rejected this status transition. |
| `RAZORPAY_ERROR` | 502 | Razorpay API call failed. Retryable. |
| `NOT_YOUR_PRODUCT` | 403 | Product exists but belongs to a different seller. |
| `DEAL_CONFIG_INVALID` | 400 | `dealExpiresAt` missing when `dealDiscountPercent` is set. |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification does not exist. |
| `NOT_YOUR_NOTIFICATION` | 403 | Notification belongs to a different user. |
---

## System Invariants

Correctness guarantees enforced at both DB and application layer.
Violating any of these is a bug, not a missing feature.

| # | Invariant | Enforcement |
|---|-----------|-------------|
| INV-01 | `product.available` never goes negative | DB `CHECK (available >= 0)` + `SELECT FOR UPDATE` inside `prisma.$transaction()` |
| INV-02 | COMPLETED or CANCELLED order status cannot change | State machine validates every transition before writing. Terminal states have no outgoing edges. |
| INV-03 | Payment webhook processed exactly once | `WebhookLog.razorpayPaymentId @unique` — duplicate returns `200` without reprocessing. |
| INV-04 | BUYER cannot access seller-only routes | `authorize('SELLER')` middleware on all seller routes. Returns `403`. |
| INV-05 | User sees only their own orders | `orderRepo` checks `buyerId` or `sellerId` matches `req.user.id` before returning data. Admins exempt. |
| INV-06 | Delivery OTP cleared after verification | `deliveryOtp` set to `null` on COMPLETED. Never stored beyond its use. |
| INV-07 | Phone number is the unique user identifier | `phone @unique` enforced at DB level. Duplicate returns `409 PHONE_EXISTS`. |
| INV-08 | Seller store name + address must be unique | `@@unique([storeName, storeAddress])` enforced at DB level. |
| INV-09 | Deal price reverts to original after expiry | Vercel Cron nullifies `dealDiscountPercent` after `dealExpiresAt`. Buyers see original `PriceTier` prices. |
| INV-10 |Order total must be >= `PlatformConfig.minOrderAmount (₹1000)` | orderService checks before creating Razorpay advance. Returns 400 `BELOW_MINIMUM_ORDER` if violated. | 
| INV-11 | Order status cannot move from PENDING to CONFIRMED unless advance payment is captured. | Only the Razorpay webhook (payment.captured event), triggers `PENDING → CONFIRMED`. No manual confirmation endpoint. | 
| INV-12 | Order status cannot move to COMPLETED unless remaining payment is captured AND `OTP` is verified. | State machine requires `READY_FOR_OTP_VERIFICATION` status (set by webhook on payment_link.paid) before verify-otp endpoint is callable.|
| INV-13 | Refund amount is calculated server-side based on time between cancellation and pickupDeadline. Client never sends refundAmount. Server owns this calculation. `Tiers: 24h+ → 100%, 2-24h → 50%, <2h → 0%.` | Enforcement: cancelOrderService computes from Order.pickupDeadline and DateTime.now(). |

---