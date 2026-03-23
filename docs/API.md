# Kridha — API Contract

> **Version:** 1.1.0-beta
> **Last updated:** March 22, 2026
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
  - [POST /api/auth/reset-pin-request](#post-apiauthresent-pin-request)
  - [POST /api/auth/reset-pin](#post-apiauthresent-pin)
  - [POST /api/auth/register-as-seller](#post-apiauthregister-as-seller)
- [User Profile](#user-profile)
  - [GET /api/users/me](#get-apiusersme)
  - [PATCH /api/users/me](#patch-apiusersme)
  - [POST /api/users/me/avatar](#post-apiusersmeavatar)
  - [DELETE /api/users/me/avatar](#delete-apiusersmeavatar)
  - [DELETE /api/users/me](#delete-apiusersme)
- [Seller Profile](#seller-profile)
  - [GET /api/sellers/profile](#get-apisellersprofile)
  - [PATCH /api/sellers/profile](#patch-apisellersprofile)
  - [POST /api/sellers/profile/images](#post-apisellersprofileimages)
  - [DELETE /api/sellers/profile/images/:publicId](#delete-apisellersprofileimagespublicid)
  - [DELETE /api/sellers/profile](#delete-apisellersprofile)
- [Pickup Windows](#pickup-windows)
  - [GET /api/pickup-windows](#get-apipickup-windows)
  - [POST /api/pickup-windows](#post-apipickup-windows)
  - [PATCH /api/pickup-windows/:id](#patch-apipickup-windowsid)
  - [DELETE /api/pickup-windows/:id](#delete-apipickup-windowsid)
- [Products — Buyer](#products--buyer)
  - [GET /api/products](#get-apiproducts)
  - [GET /api/products/:id](#get-apiproductsid)
  - [GET /api/products/deals](#get-apiproductsdeals)
- [Products — Seller](#products--seller)
  - [GET /api/products/mine](#get-apiproductsmine)
  - [POST /api/products](#post-apiproducts)
  - [PATCH /api/products/:id](#patch-apiproductsid)
  - [DELETE /api/products/:id](#delete-apiproductsid)
  - [POST /api/products/:id/deal](#post-apiproductsiddeal)
  - [PATCH /api/products/:id/deal](#patch-apiproductsiddeal)
  - [DELETE /api/products/:id/deal](#delete-apiproductsiddeal)
- [Saved Products](#saved-products)
  - [GET /api/saved](#get-apisaved)
  - [POST /api/saved](#post-apisaved)
  - [PATCH /api/saved/:id](#patch-apisavedid)
  - [DELETE /api/saved/:id](#delete-apisavedid)
- [Upload](#upload)
  - [POST /api/upload/sign](#post-apiuploadsign)
- [Cart](#cart)
  - [GET /api/cart](#get-apicart)
  - [POST /api/cart](#post-apicart)
  - [PATCH /api/cart/:itemId](#patch-apicartitemid)
  - [DELETE /api/cart/:itemId](#delete-apicartitemid)
  - [DELETE /api/cart](#delete-apicart)
  - [POST /api/cart/checkout](#post-apicartcheckout)
- [Reviews](#reviews)
  - [GET /api/reviews](#get-apireviews)
  - [POST /api/reviews](#post-apireviews)
  - [PATCH /api/reviews/:id](#patch-apireviewsid)
  - [DELETE /api/reviews/:id](#delete-apireviewsid)
- [Orders](#orders)
  - [POST /api/orders](#post-apiorders) — creates Order + SubOrders
  - [GET /api/orders](#get-apiorders) — lists SubOrders
  - [GET /api/orders/:id](#get-apiordersid) — SubOrder detail
  - [PATCH /api/orders/:id/cancel](#patch-apiordersidcancel) — cancel SubOrder
  - [POST /api/orders/:id/advance](#post-apiordersidadvance) — retry advance on SubOrder
  - [POST /api/orders/:id/request-payment](#post-apiordersidrequest-payment) — seller requests payment
  - [POST /api/orders/:id/verify-otp](#post-apiordersidverify-otp) — seller verifies OTP
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
Auth:    None (refreshToken in body is the credential — no Bearer header)
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

### POST /api/auth/reset-pin-request

Initiate PIN reset by requesting an OTP on the registered phone.
In development this is a dummy — OTP is logged to console, not sent via SMS.
```
Auth:    None
Body:    {
  phone:   string   required — 10-digit Indian mobile number
}
```

**Success**
```
200: {
  "success": true,
  "message": "OTP sent to your registered mobile number."
}
```

**Errors**
```
404:  PHONE_NOT_FOUND  — "No account found with this phone number."
429:  RATE_LIMITED     — "Too many attempts. Try again in 30 minutes."
422:  VALIDATION_FAILED
```

> In production: OTP sent via SMS (Twilio — Phase 2).
> In development: OTP logged to server console.
> OTP expires in 10 minutes. Stored in OtpRequest table, not User.

---

### POST /api/auth/reset-pin

Verify OTP and set a new PIN.
```
Auth:    None
Body:    {
  phone:      string   required
  otp:        string   required — 4 digits
  newPin:     string   required — exactly 4 digits
  confirmPin: string   required — must match newPin
}
```

**Success**
```
200: {
  "success": true,
  "message": "PIN reset successfully. Login to continue."
}
```

**Errors**
```
400:  INVALID_OTP       — "Invalid or expired OTP."
422:  VALIDATION_FAILED — includes pin mismatch: "newPin and confirmPin must match"
404:  PHONE_NOT_FOUND   — "No account found with this phone number."
429:  OTP_ATTEMPTS      — "Too many incorrect attempts."
```

> newPin ≠ confirmPin returns 422 VALIDATION_FAILED (field-level error),
> not a new error code. This is caught by Zod before hitting the service.

---

### POST /api/auth/register-as-seller

Upgrade an existing BUYER account to also have SELLER role.
Creates a SellerProfile with store and bank details.
Account goes into PENDING verification — seller cannot list products until VERIFIED.
```
Auth:    Bearer (BUYER)
Body:    {
  storeName:          string   required
  street:             string   required
  line2:              string   optional
  landmark:           string   optional
  city:               string   required
  state:              string   required
  pincode:            string   required — 6 digits
  businessType:       enum     required
                      INDIVIDUAL | PROPRIETORSHIP |
                      PARTNERSHIP | PVT_LTD
  gstNo:              string   optional
  panNo:              string   required
  accountHolderName:  string   required
  accountNumber:      string   required
  ifscCode:           string   required
  bankName:           string   required
  pickupWindows:      array    required — min 1
    [{
      labelEn:          string   required
      labelHi:        string   required
      startTime:      string   required — "HH:MM"
      endTime:        string   required — "HH:MM"
      daysActive:     string[] required — ["MON","TUE",...]
    }]
}
```

**Success**
```
201: {
  "success": true,
  "message": "Application submitted. Verification takes 12–48 hours.",
  "data": {
    "status":       "PENDING",
    "bankVerified": false
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
409:  STORE_EXISTS      — "A store with this name and address already exists."
422:  VALIDATION_FAILED
```

> User roles updated to [BUYER, SELLER] immediately.
> Seller cannot list products until kycStatus = VERIFIED.
> Bank details stored encrypted at application layer.
> accountNumber masked in all GET responses (last 4 digits only).

---

## User Profile

### GET /api/users/me

Fetch the authenticated user's profile.
```
Auth:    Bearer (BUYER or SELLER)
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "id":               string,
    "name":             string,
    "phone":            string,   — masked: +91 XXXXX X1234
    "city":             string | null,
    "state":            string | null,
    "street":           string | null,
    "line2":            string | null,
    "landmark":         string | null,
    "profileImageUrl":  string | null,
    "preferredLang":    string,   — "hi" | "en"
    "roles":            string[],
    "reliabilityScore": number,
    "noShowCount":      number,
    "creditBalance":    number,
    "isFlagged":        boolean,
    "createdAt":        string
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED — "Please login to continue."
```

---

### PATCH /api/users/me

Update profile fields. Send only fields being changed.
```
Auth:    Bearer (BUYER or SELLER)
Body:    {
  name?:          string
  street?:        string
  line2?:         string
  landmark?:      string
  city?:          string
  state?:         string
  preferredLang?: string   — "hi" | "en"
}
```

**Success**
```
200: {
  "success": true,
  "message": "Profile updated successfully."
}
```

**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
422:  VALIDATION_FAILED
```

---

### POST /api/users/me/avatar

Upload or replace profile picture.
Upload image to Cloudinary first via POST /api/upload/sign — send URL here.
```
Auth:    Bearer (BUYER or SELLER)
Body:    {
  profileImageUrl:      string   required — Cloudinary URL
  profileImagePublicId: string   required — Cloudinary public ID
                                            (needed for deletion)
}
```

**Success**
```
200: {
  "success": true,
  "message": "Profile picture updated successfully."
}
```

**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
422:  VALIDATION_FAILED
```

---

### DELETE /api/users/me/avatar

Remove profile picture.
```
Auth:    Bearer (BUYER or SELLER)
Body:    None
```

**Success**
```
200: {
  "success": true,
  "message": "Profile picture removed."
}
```

**Errors**
```
401:  UNAUTHENTICATED — "Please login to continue."
404:  NOT_FOUND       — "No profile picture to remove."
```

---

### DELETE /api/users/me

Permanently delete account.
Blocked if active orders (PENDING, CONFIRMED, AWAITING_PAYMENT) exist.
```
Auth:    Bearer
Body:    None
```

**Success**
```
200: {
  "success": true,
  "message": "Account deleted successfully."
}
```

**Errors**
```
401:  UNAUTHENTICATED          — "Please login to continue."
409:  ACCOUNT_HAS_ACTIVE_ORDERS — "Resolve all active orders before
                                   deleting your account."
```

> Soft delete — sets User.deletedAt.
> If user has SELLER role: all products soft-deleted, SellerProfile deactivated.
> RefreshTokens deleted — all sessions immediately invalidated.

---

## Seller Profile

### GET /api/sellers/profile

Fetch the authenticated seller's store profile.
```
Auth:    Bearer (SELLER)
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "storeName":          string,
    "street":             string,
    "line2":              string | null,
    "landmark":           string | null,
    "city":               string,
    "state":              string,
    "pincode":            string,
    "storeImages": [
      {
        "url":            string,
        "publicId":       string
      }
    ],
    "businessType":       string,
    "gstNo":              string | null,
    "panNo":              string,
    "accountHolderName":  string,
    "accountNumber":      string,   — masked: XXXXXXXXXXXX1234
    "ifscCode":           string,
    "bankName":           string,
    "bankVerified":       boolean,
    "status":             string,   — PENDING | VERIFIED | DEACTIVATED
    "reliabilityScore":   number,
    "sellerRating":       number,
    "sellerRatingCount":  number
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED — "Please login to continue."
403:  FORBIDDEN       — "Only sellers can access this."
404:  NOT_FOUND       — "Seller profile not found."
```

---

### PATCH /api/sellers/profile

Update store profile fields. Send only fields being changed.
Pickup windows are managed separately via /api/pickup-windows.
```
Auth:    Bearer (SELLER)
Body:    {
  storeName?:         string
  street?:            string
  line2?:             string
  landmark?:          string
  city?:              string
  state?:             string
  pincode?:           string
  businessType?:      enum     INDIVIDUAL | PROPRIETORSHIP | PARTNERSHIP | PVT_LTD
  gstNo?:             string
  panNo?:             string
  accountHolderName?: string
  accountNumber?:     string
  ifscCode?:          string
  bankName?:          string
}
```

**Success**
```
200: {
  "success": true,
  "message": "Store profile updated successfully."
}
```

**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
403:  FORBIDDEN         — "Only sellers can access this."
409:  STORE_EXISTS      — "A store with this name and address already exists."
422:  VALIDATION_FAILED
```

> Updating bank details resets bankVerified to false.
> Admin must re-verify before payouts resume.

---

### POST /api/sellers/profile/images

Add one or more store images.
Upload to Cloudinary first via POST /api/upload/sign.
Maximum 5 store images total.
```
Auth:    Bearer (SELLER)
Body:    {
  images: [
    {
      url:      string   required — Cloudinary URL
      publicId: string   required — Cloudinary public ID
    }
  ]
}
```

**Success**
```
200: {
  "success": true,
  "message": "Store images added successfully.",
  "data": {
    "storeImages": [{ "url": string, "publicId": string }]
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED        — "Please login to continue."
403:  FORBIDDEN              — "Only sellers can access this."
400:  STORE_IMAGE_LIMIT      — "Maximum 5 store images allowed."
422:  VALIDATION_FAILED
```

---

### DELETE /api/sellers/profile/images/:publicId

Remove a specific store image by its Cloudinary public ID.
```
Auth:    Bearer (SELLER)
Body:    None
```

**Success**
```
200: {
  "success": true,
  "message": "Store image removed."
}
```

**Errors**
```
401:  UNAUTHENTICATED — "Please login to continue."
403:  FORBIDDEN       — "Only sellers can access this."
404:  NOT_FOUND       — "Image not found."
```

---

### DELETE /api/sellers/profile

Deactivate seller account. User remains as BUYER.
Blocked if active orders exist on any seller order.
```
Auth:    Bearer (SELLER)
Body:    None
```

**Success**
```
200: {
  "success": true,
  "message": "Seller profile deactivated. Your buyer account remains active."
}
```

**Errors**
```
401:  UNAUTHENTICATED          — "Please login to continue."
403:  FORBIDDEN                — "Only sellers can access this."
409:  ACCOUNT_HAS_ACTIVE_ORDERS — "Resolve all active seller orders first."
```

> Removes SELLER from User.roles[]. User retains BUYER role.
> All products soft-deleted. SellerProfile.status set to DEACTIVATED.
> Existing COMPLETED orders and payouts are preserved.

---

## Pickup Windows
 
Seller manages available pickup times. Minimum 1, maximum 7 active windows.
`daysActive` uses string abbreviations: `MON | TUE | WED | THU | FRI | SAT | SUN`.
 
### GET /api/pickup-windows
 
Fetch all pickup windows for the authenticated seller.
```
Auth:    Bearer (SELLER)
Body:    None
```
 
**Success**
```
200: {
  "success": true,
  "data": {
    "pickupWindows": [
      {
        "id":         string,
        "labelEn":    string,
        "labelHi":    string,
        "startTime":  string,   — "HH:MM"
        "endTime":    string,   — "HH:MM"
        "daysActive": string[]  — ["MON","TUE","WED",...]
      }
    ]
  }
}
```
 
**Errors**
```
401:  UNAUTHENTICATED — "Please login to continue."
403:  FORBIDDEN       — "Only sellers can access this."
```
 
---
 
### POST /api/pickup-windows
 
Create a new pickup window.
```
Auth:    Bearer (SELLER)
Body:    {
  labelEn:    string   required
  labelHi:    string   required
  startTime:  string   required — "HH:MM" format
  endTime:    string   required — "HH:MM" format, must be after startTime
  daysActive: string[] required — ["MON","TUE",...], min 1
}
```
 
**Success**
```
201: {
  "success": true,
  "message": "Pickup window created.",
  "data": {
    "pickupWindow": { "id", "labelEn", "labelHi", "startTime", "endTime", "daysActive" }
  }
}
```
 
**Errors**
```
401:  UNAUTHENTICATED        — "Please login to continue."
403:  FORBIDDEN              — "Only sellers can manage pickup windows."
400:  PICKUP_WINDOW_LIMIT    — "Maximum 7 pickup windows allowed."
422:  VALIDATION_FAILED
```
 
---
 
### PATCH /api/pickup-windows/:id
 
Update an existing pickup window. Send only fields being changed.
```
Auth:    Bearer (SELLER — own window only)
Body:    {
  labelEn?:    string
  labelHi?:    string
  startTime?:  string   — "HH:MM"
  endTime?:    string   — "HH:MM"
  daysActive?: string[] — min 1 day
}
```
 
**Success**
```
200: {
  "success": true,
  "message": "Pickup window updated.",
  "data": {
    "pickupWindow": { "id", "labelEn", "labelHi", "startTime", "endTime", "daysActive" }
  }
}
```
 
**Errors**
```
401:  UNAUTHENTICATED         — "Please login to continue."
403:  FORBIDDEN               — "You can only edit your own pickup windows."
404:  PICKUP_WINDOW_NOT_FOUND — "Pickup window not found."
422:  VALIDATION_FAILED
```
 
---
 
### DELETE /api/pickup-windows/:id
 
Soft delete a pickup window. Cannot delete if it is the only active window.
```
Auth:    Bearer (SELLER — own window only)
Body:    None
```
 
**Success**
```
200: { "success": true, "message": "Pickup window removed." }
```
 
**Errors**
```
401:  UNAUTHENTICATED         — "Please login to continue."
403:  FORBIDDEN               — "You can only delete your own pickup windows."
404:  PICKUP_WINDOW_NOT_FOUND — "Pickup window not found."
400:  LAST_PICKUP_WINDOW      — "Cannot delete your only active pickup window."
```
---

## Products — Buyer
### GET /api/products
 
Fetch nearby products with optional search and filters.
`q` is optional — omitting it returns all products matching other filters.
Results are paginated. Default sort is by distance (nearest first).
 
```
Auth:    None (Public)
Body:    None
 
Query params:
  q             String   optional — search term (nameEn, nameHi, category)
                                    omit to browse all products
  lat           Float    required — buyer's current latitude
  lng           Float    required — buyer's current longitude
  radius        Int      optional — km, default: 10, max: 50
  category      String   optional — GRAINS | DAIRY | OIL | SPICES |
                                    VEGETABLES | FRUITS | PULSES |
                                    FLOUR | BEVERAGES | OTHER
  minPrice      Decimal  optional — filter by minimum pricePerUnit
  maxPrice      Decimal  optional — filter by maximum pricePerUnit
  isBranded     Boolean  optional — true | false
  dealActive    Boolean  optional — true returns only active deals
  sellerId      String   optional — filter by specific seller
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
        "nameEn":               string,
        "nameHi":               string | null,
        "description":          string | null,
        "category":             string,
        "isBranded":            boolean,
        "unit":                 enum      required
                        KG | GRAM | LITRE | ML | PIECE |
                        DOZEN | QUINTAL | TON | BUNDLE
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
            "labelEn":          string,
            "labelHi":          string,
            "startTime":        string,
            "endTime":          string,
            "daysActive":       string[]   — ["MON","TUE","WED",...]
          }
        ],
        "seller": {
          "id":                 string,
          "name":               string,
          "storeName":          string,
          "reliabilityScore":   number,
          "sellerRating":       number,
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
422:  VALIDATION_FAILED — lat/lng missing or out of India bounds
```
 
> Zero results returns `200` with `products: []` and `total: 0`. Never `404`.
> When `q` is provided, search runs against nameEn, nameHi, and category fields.
> Authenticated sellers: own products excluded via `sellerId: { not: req.user.id }`.
>
> `dealDiscountPercent` and `dealExpiresAt` are read from the active `Deal` record
> via JOIN — not stored directly on Product. `null` means no active deal.
 
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
404:  PRODUCT_NOT_FOUND — "Product not found or no longer available."
```
 
---
 
### GET /api/products/deals
 
Fetch all products with an active deal, sorted by distance or price.
```
Auth:    None (Public)
Body:    None
 
Query params:
  lat       Float    required — buyer's current latitude
  lng       Float    required — buyer's current longitude
  category  String   optional
  sortBy    String   optional — price_asc | price_desc | distance (default)
  page      Int      optional — default: 1
  limit     Int      optional — default: 20, max: 50
```
 
**Success**
```
200: {
  "success": true,
  "data": {
    "products": [ ],   — same shape as GET /api/products
                          dealExpiresAt is always set and in future
    "meta": { "page", "limit", "total", "hasMore" }
  }
}
```
 
**Errors**
```
422:  VALIDATION_FAILED — lat/lng missing
```
 
---
 
## Products — Seller
 
### GET /api/products/mine
 
Fetch all products belonging to the authenticated seller.
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
        "totalOrders":  number,   — computed from OrderItem count, not stored
        "dealActive":   boolean
      }
    ],
    "meta": { "page", "limit", "total", "hasMore" }
  }
}
```
 
**Errors**
```
401:  UNAUTHENTICATED — "Please login to continue."
403:  FORBIDDEN       — "Only sellers can access this."
```
 
> Zero products returns `200` with `products: []`. Never `404`.
 
---
 
### GET /api/products/mine/:id
 
Fetch a single product owned by the authenticated seller.
Includes operational fields (deal dates, order counts) not in buyer view.
```
Auth:    Bearer (SELLER — own product only)
Body:    None
```
 
**Success**
```
200: {
  "success": true,
  "data": {
    "product": {
      "id":                   string,
      "nameEn":               string,
      "nameHi":               string | null,
      "description":          string | null,
      "category":             string,
      "isBranded":            boolean,
      "unit":                 enum      required
                        KG | GRAM | LITRE | ML | PIECE |
                        DOZEN | QUINTAL | TON | BUNDLE
      "unitIncrement":        number,
      "minOrderQty":          number,
      "maxOrderQty":          number | null,
      "priceTiers": [
        { "minQty": number, "maxQty": number | null, "pricePerUnit": number }
      ],
      "available":            number,
      "imageUrls":            string[],
      "blurHash":             string | null,
      "dealDiscountPercent":  number | null,
      "dealExpiresAt":        string | null,
      "dealUpdatedAt":        string | null,
      "totalOrders":          number,   — computed from OrderItem count, not stored
      "pickupWindows": [
        {
          "id":               string,
          "labelEn":          string,
          "labelHi":          string,
          "startTime":        string,
          "endTime":          string,
          "daysActive":       string[]
        }
      ],
      "createdAt":            string,
      "updatedAt":            string
    }
  }
}
```
 
**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
403:  FORBIDDEN         — "You can only view your own products."
404:  PRODUCT_NOT_FOUND — "Product not found."
```
 
---
 
### POST /api/products
 
Create a new product listing.
Upload images to Cloudinary first via `POST /api/upload/sign`.
```
Auth:    Bearer (SELLER only)
Body:    {
  nameEn:               string    required
  nameHi:               string    optional
  description:          string    optional
  category:             enum      required
                        GRAINS | DAIRY | OIL | SPICES | VEGETABLES |
                        FRUITS | PULSES | FLOUR | BEVERAGES | OTHER
  isBranded:            boolean   optional, default: false
  imageUrls:            string[]  optional, max 5 Cloudinary URLs
  blurHash:             string    optional — for hero image (imageUrls[0])
  available:            number    required — must be > 0
  minOrderQty:          number    required — must be > 0
  maxOrderQty:          number    optional
  unit:                 enum      required
                        KG | GRAM | LITRE | ML | PIECE |
                        DOZEN | QUINTAL | TON | BUNDLE
  unitIncrement:        number    required — must be > 0
  priceTiers:           array     required — min 1 entry
    [{
      minQty:           number    required — must be > 0
      maxQty:           number    optional
      pricePerUnit:     number    required — must be > 0
    }]
  latitude:             number    required — India bounds: 8 to 37
  longitude:            number    required — India bounds: 68 to 98
  dealDiscountPercent:  number    optional - must be b/w 0 to 100
  dealExpiresAt:        string    optional - must be in future (ISO DateTime)
}
```
 
**Success**
```
201: { "success": true, "data": { "product": { } } }
```
 
**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
403:  FORBIDDEN         — "Only verified sellers can list products."
422:  VALIDATION_FAILED
```
 
> imageUrls[0] is the hero/cover image shown in product feed.
> Seller must be kycStatus = VERIFIED to create products.
 
---
 
### PATCH /api/products/:id
 
Update any fields. Send only fields being changed.
For images: send full replacement imageUrls array.
```
Auth:    Bearer (SELLER — own product only)
Body:    Partial — any subset of POST /api/products body
```
 
**Success**
```
200: { "success": true, "data": { "product": { } } }
```
 
**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
403:  FORBIDDEN         — "You can only edit your own products."
404:  PRODUCT_NOT_FOUND — "Product not found."
422:  VALIDATION_FAILED
```
 
---
 
### DELETE /api/products/:id
 
Soft delete. Sets `deletedAt`. Product disappears from buyer feed immediately.
Existing CONFIRMED or COMPLETED orders are unaffected.
```
Auth:    Bearer (SELLER — own product only)
Body:    None
```
 
**Success**
```
200: { "success": true, "message": "Product deleted." }
```
 
**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
403:  FORBIDDEN         — "You can only delete your own products."
404:  PRODUCT_NOT_FOUND — "Product not found."
```
 
---
 
### POST /api/products/:id/deal
 
Add a deal to a product. Fails if deal already exists — delete first.
```
Auth:    Bearer (SELLER — own product only)
Body:    {
  dealDiscountPercent:  number   required — 0 to 100
  dealExpiresAt:        string   required — ISO DateTime, must be in future
}
```
 
**Success**
```
200: {
  "success": true,
  "message": "Deal added successfully.",
  "data": {
    "product": {
      "dealDiscountPercent": number,
      "dealExpiresAt":       string,
      "dealUpdatedAt":       string
    }
  }
}
```
 
**Errors**
```
401:  UNAUTHENTICATED    — "Please login to continue."
403:  FORBIDDEN          — "You can only manage your own products."
404:  PRODUCT_NOT_FOUND  — "Product not found."
400:  INVALID_EXPIRY_TIME — "Deal expiry must be in the future."
409:  DEAL_EXISTS        — "A deal already exists on this product.
                            Delete it before adding a new one."
422:  VALIDATION_FAILED
```
 
---
 
### PATCH /api/products/:id/deal
 
Update deal discount percentage or expiry date.
```
Auth:    Bearer (SELLER — own product only)
Body:    {
  dealDiscountPercent?: number   — 0 to 100
  dealExpiresAt?:       string   — ISO DateTime, must be in future
}
```
 
**Success**
```
200: {
  "success": true,
  "message": "Deal updated successfully.",
  "data": {
    "product": {
      "dealDiscountPercent": number,
      "dealExpiresAt":       string,
      "dealUpdatedAt":       string
    }
  }
}
```
 
**Errors**
```
401:  UNAUTHENTICATED    — "Please login to continue."
403:  FORBIDDEN          — "You can only manage your own products."
404:  PRODUCT_NOT_FOUND  — "Product not found."
400:  NO_ACTIVE_DEAL     — "No active deal on this product."
400:  INVALID_EXPIRY_TIME — "Deal expiry must be in the future."
422:  VALIDATION_FAILED
```
 
---
 
### DELETE /api/products/:id/deal
 
Remove deal. Price immediately reverts to original PriceTier.
```
Auth:    Bearer (SELLER — own product only)
Body:    None
```
 
**Success**
```
200: { "success": true, "message": "Deal removed. Original pricing restored." }
```
 
**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
403:  FORBIDDEN         — "You can only manage your own products."
404:  PRODUCT_NOT_FOUND — "Product not found."
400:  NO_ACTIVE_DEAL    — "No active deal on this product."
```
 
---
 
### GET /api/products/deals/mine
 
Fetch all own products that have or had deals.
```
Auth:    Bearer (SELLER only)
Body:    None
 
Query params:
  status    String   optional — active | expired | all (default: all)
  page      Int      optional — default: 1
  limit     Int      optional — default: 20
```
 
**Success**
```
200: {
  "success": true,
  "data": {
    "deals": [
      {
        "id":                   string,
        "nameEn":               string,
        "nameHi":               string | null,
        "category":             string,
        "available":            number,
        "imageUrls":            string[],
        "dealDiscountPercent":  number | null,
        "dealExpiresAt":        string | null,
        "dealUpdatedAt":        string | null,
        "dealActive":           boolean
      }
    ],
    "meta": { "page", "limit", "total", "hasMore" }
  }
}
```
 
**Errors**
```
401:  UNAUTHENTICATED — "Please login to continue."
403:  FORBIDDEN       — "Only sellers can access this."
```
 
> Zero deals returns `200` with `deals: []`. Never `404`.
 
---


## Saved Products
 
One model, two types. Same product can exist in BOTH lists simultaneously.
`PATCH /api/saved/:id` is not needed — to move between lists, DELETE and POST.
 
### GET /api/saved
 
Fetch saved products. Filter by type to get favorites or saved-for-later.
```
Auth:    Bearer (BUYER)
Body:    None
 
Query params:
  type    String   optional — FAVOURITE | SAVED_FOR_LATER (omit for all)
  page    Int      optional — default: 1
  limit   Int      optional — default: 20
```
 
**Success**
```
200: {
  "success": true,
  "data": {
    "saved": [
      {
        "id":      string,   — SavedProduct id (use this for DELETE)
        "type":    string,   — FAVOURITE | SAVED_FOR_LATER
        "product": {
          "id", "nameEn", "nameHi", "category", "isBranded",
          "unit", "unitIncrement", "minOrderQty", "maxOrderQty",
          "priceTiers", "available", "imageUrls", "blurHash",
          "dealDiscountPercent", "dealExpiresAt", "distance_km",
          "pickupWindows", "seller"
        }
      }
    ],
    "meta": { "page", "limit", "total", "hasMore" }
  }
}
```
 
**Errors**
```
401:  UNAUTHENTICATED — "Please login to continue."
```
 
> Zero saved items returns `200` with `saved: []`. Never `404`.
 
---
 
### POST /api/saved
 
Save a product to Favorites or Saved For Later.
```
Auth:    Bearer (BUYER)
Body:    {
  productId:  string   required — cuid
  type:       enum     required — FAVOURITE | SAVED_FOR_LATER
}
```
 
**Success**
```
201: {
  "success": true,
  "message": "Saved to list.",
  "data": { "saved": { "id", "type", "productId" } }
}
```
 
**Errors**
```
401:  UNAUTHENTICATED   — "Please login to continue."
404:  PRODUCT_NOT_FOUND — "Product not found."
409:  ALREADY_SAVED     — "Product already in this list."
422:  VALIDATION_FAILED
```
 
---
 
### DELETE /api/saved/:id
 
Remove from saved list. `:id` is the SavedProduct id, not the product id.
```
Auth:    Bearer (BUYER — own saved item only)
Body:    None
```
 
**Success**
```
200: { "success": true, "message": "Removed from list." }
```
 
**Errors**
```
401:  UNAUTHENTICATED         — "Please login to continue."
403:  FORBIDDEN               — "You can only remove your own saved items."
404:  SAVED_PRODUCT_NOT_FOUND — "Saved item not found."
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



## Cart

Cart is persisted server-side. One active CartSession per user at a time.
At checkout, CartItems are converted to SellerOrders — one per seller.

### GET /api/cart

Fetch current active cart with all items and summary.
```
Auth:    Bearer (BUYER)
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "cart": {
      "id":        string | null,   — null if no active cart
      "expiresAt": string | null,
      "items": [
        {
          "id":             string,   — CartItem id (use for PATCH/DELETE)
          "productId":      string,
          "productNameEn":    string,
          "productNameHi":  string | null,
          "category":       string,
          "imageUrls":      string[],
          "blurHash":       string | null,
          "unit":           enum      required
                        KG | GRAM | LITRE | ML | PIECE |
                        DOZEN | QUINTAL | TON | BUNDLE
          "unitIncrement":  number,
          "available":      number,
          "dealDiscountPercent": number | null,
          "dealExpiresAt":  string | null,
          "dealUpdatedAt":  string | null,
          "quantity":       number,
          "unitPrice":      number,   — computed from PriceTier at time of add
          "lineTotal":      number,
          "pickupWindowId": string,
          "pickupWindow": {
            "labelEn":    string,
            "labelHi":    string,
            "startTime":  string,
            "endTime":    string
          },
          "pickupDate":     string,
          "seller": {
            "id":        string,
            "name":      string,
            "storeName": string
          }
        }
      ],
      "summary": {
        "totalItems":   number,
        "totalAmount":  number,
        "totalAdvance": number,   — combined advance across all sellers
        "sellerCount":  number
      }
    }
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED — "Please login to continue."
```

> Empty cart returns `200` with `cart: null`. Never `404`.

---

### POST /api/cart

Add an item to cart. Creates CartSession if none exists.
`pickupWindowId` and `pickupDate` are required — seller must be reachable
at the chosen time for checkout to proceed.
```
Auth:    Bearer (BUYER)
Body:    {
  productId:      string   required — cuid
  quantity:       number   required — positive, multiple of unitIncrement
  pickupWindowId: string   required — cuid
  pickupDate:     string   required — ISO DateTime, must be future date
}
```

**Success**
```
201: {
  "success": true,
  "message": "Item added to cart.",
  "data": {
    "cartItem": { "id", "productId", "quantity", "pickupWindowId", "pickupDate" }
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED    — "Please login to continue."
404:  PRODUCT_NOT_FOUND  — "Product not found."
400:  WINDOW_UNAVAILABLE — "This pickup window is unavailable."
400:  INVALID_PICKUP_DATE — "Pickup date must be in the future."
409:  INSUFFICIENT_STOCK — meta: { productId, requested, available }
422:  VALIDATION_FAILED
```

---

### PATCH /api/cart/:itemId

Update quantity of a cart item.
```
Auth:    Bearer (BUYER — own cart only)
Body:    {
  quantity: number   required — positive, multiple of unitIncrement
}
```

**Success**
```
200: {
  "success": true,
  "message": "Quantity updated.",
  "data": { "cartItem": { "id", "quantity", "unitPrice", "lineTotal" } }
}
```

**Errors**
```
401:  UNAUTHENTICATED     — "Please login to continue."
403:  FORBIDDEN           — "You can only modify your own cart."
404:  CART_ITEM_NOT_FOUND — "Cart item not found."
409:  INSUFFICIENT_STOCK
422:  VALIDATION_FAILED
```

---

### DELETE /api/cart/:itemId

Remove a single item from cart.
```
Auth:    Bearer (BUYER — own cart only)
Body:    None
```

**Success**
```
200: { "success": true, "message": "Item removed from cart." }
```

**Errors**
```
401:  UNAUTHENTICATED     — "Please login to continue."
403:  FORBIDDEN           — "You can only modify your own cart."
404:  CART_ITEM_NOT_FOUND — "Cart item not found."
```

---

### DELETE /api/cart

Clear entire cart.
```
Auth:    Bearer (BUYER)
Body:    None
```

**Success**
```
200: { "success": true, "message": "Cart cleared.", "data": { "removed": number } }
```

**Errors**
```
401:  UNAUTHENTICATED — "Please login to continue."
```

> Clearing an already empty cart returns `200` with `{ removed: 0 }`.
> Not an error — idempotent operation.

---

### POST /api/cart/checkout

Convert entire cart to orders. One SellerOrder created per seller.
Server reads items from CartSession — no body needed.
```
Auth:    Bearer (BUYER)
Body:    None
```

**Success**
```
201: {
  "success": true,
  "data": {
    "orderId":   string,   — parent Order id
    "subOrders": [
      {
        "id":              string,   — SubOrder id (use for subsequent ops)
        "shortId":         string,
        "sellerId":        string,
        "sellerName":      string,
        "storeName":       string,
        "totalAmount":     number,
        "advanceAmount":   number,
        "remainingAmount": number,
        "status":          "PENDING"
      }
    ],
    "advance": {
      "razorpayOrderId": string,
      "amount":          number,   — combined advance across all orders
      "currency":        "INR"
    }
  }
}
```

**Errors**
```
400:  CART_EMPTY          — "Your cart is empty."
401:  UNAUTHENTICATED     — "Please login to continue."
400:  BELOW_MINIMUM_ORDER — meta: { sellerId, minimum: 1000, current: number }
409:  INSUFFICIENT_STOCK  — meta: { productId, productNameEn, requested, available }
502:  RAZORPAY_ERROR      — "Payment service error. Please retry."
```

> Cart is cleared after successful checkout.
> Creates one SubOrder per seller. All SubOrders share a parent Order.
> Stock decremented atomically per seller via prisma.$transaction()
> with SELECT FOR UPDATE. If any seller's stock check fails,
> all decrements for that seller are rolled back.

---

## Reviews

Reviews can only be written after an order is COMPLETED.
One review per order per product. Buyer can edit or delete their own review.
Reading reviews is public — no authentication required.

### GET /api/reviews

Fetch reviews. Filter by productId (buyer view) or sellerId (seller dashboard).
```
Auth:    None (Public)
Body:    None

Query params:
  productId   String   optional — reviews for a specific product
  sellerId    String   optional — all reviews across seller's products
  page        Int      optional — default: 1
  limit       Int      optional — default: 20
```

**Success**
```
200: {
  "success": true,
  "data": {
    "reviews": [
      {
        "id":          string,
        "rating":      number,   — 1 to 5
        "comment":     string | null,
        "createdAt":   string,
        "updatedAt":   string | null,
        "buyer": {
          "name":      string
        },
        "product": {
          "id":        string,
          "nameEn":      string,
          "nameHi":    string | null,
          "imageUrls": string[]
        }
      }
    ],
    "averageRating": number,
    "totalCount":    number,
    "meta": { "page", "limit", "total", "hasMore" }
  }
}
```

**Errors**
```
None
```

> productId and sellerId are both optional.
> Omitting both returns all reviews (admin use case).
> Zero reviews returns `200` with `reviews: []`. Never `404`.
>
> Reviews are linked to SubOrders (per-seller transactions), not parent Orders.
> One review per product per SubOrder — `@@unique([subOrderId, productId])`.

---

### POST /api/reviews

Write a review after a completed order.
`productId` is required — one order can have multiple products,
the review must be tied to a specific product.
```
Auth:    Bearer (BUYER)
Body:    {
  subOrderId: string  required — cuid, must be COMPLETED SubOrder owned by caller
  productId:  string  required — cuid, must be in that SubOrder
  rating:    number   required — 1 to 5
  comment:   string   optional — max 500 characters
}
```

**Success**
```
201: {
  "success": true,
  "message": "Review added successfully.",
  "data": {
    "review": { "id", "rating", "comment", "createdAt" }
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED      — "Please login to continue."
403:  FORBIDDEN            — "You can only review orders you placed and completed."
404:  ORDER_NOT_FOUND      — "Order not found."
404:  PRODUCT_NOT_FOUND    — "Product not found in this order."
409:  REVIEW_ALREADY_EXISTS — "You have already reviewed this product for this SubOrder."
422:  VALIDATION_FAILED
```

---

### PATCH /api/reviews/:id

Edit own review.
```
Auth:    Bearer (BUYER — own review only)
Body:    {
  rating?:  number   — 1 to 5
  comment?: string   — max 500 characters
}
```

**Success**
```
200: {
  "success": true,
  "message": "Review updated successfully.",
  "data": { "review": { "id", "rating", "comment", "updatedAt" } }
}
```

**Errors**
```
401:  UNAUTHENTICATED  — "Please login to continue."
403:  FORBIDDEN        — "You can only edit your own reviews."
404:  REVIEW_NOT_FOUND — "Review not found."
422:  VALIDATION_FAILED
```

---

### DELETE /api/reviews/:id

Delete own review.
```
Auth:    Bearer (BUYER — own review only)
Body:    None
```

**Success**
```
200: { "success": true, "message": "Review deleted successfully." }
```

**Errors**
```
401:  UNAUTHENTICATED  — "Please login to continue."
403:  FORBIDDEN        — "You can only delete your own reviews."
404:  REVIEW_NOT_FOUND — "Review not found."
```

---

## Orders

All order endpoints use `:id` = **SubOrder.id** except `POST /api/orders` which
returns both `Order.id` (parent) and `SubOrder.id[]` (per-seller transactions).
Use `SubOrder.id` for cancel, advance, request-payment, and verify-otp.

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
      "id":              string,   — parent Order id
      "totalAmount":     number,   — combined across all SubOrders
      "advanceAmount":   number,   — combined advance across all SubOrders
      "platformFee":     number
    },
    "subOrders": [
      {
        "id":              string,   — SubOrder id (use for all subsequent ops)
        "shortId":         string,   — KR-2026-XXXX
        "status":          "PENDING",
        "totalAmount":     number,
        "advanceAmount":   number,
        "remainingAmount": number,
        "items": [
          {
            "productId":   string,
            "productNameEn": string,
            "quantity":    number,
            "unitPrice":   number,
            "subtotal":    number
          }
        ],
        "pickupWindow": {
          "id":            string,
          "labelEn":       string,
          "labelHi":       string,
          "startTime":     string,
          "endTime":       string,
          "date":          string
        },
        "seller": {
          "id":            string,
          "name":          string,
          "storeName":     string
        }
      }
    ],
    "advance": {
      "razorpayOrderId": string,   — combined Razorpay order for all advances
      "amount":          number,
      "currency":        "INR"
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
                               meta: { productId, productNameEn,
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
        "id":              string,   — SubOrder id
        "shortId":         string,
        "orderId":         string,   — parent Order id
        "status":          string,
        "totalAmount":     number,
        "advanceAmount":   number,
        "pickupDate":      string,
        "pickupWindow": {
          "labelEn":       string,
          "labelHi":       string,
          "startTime":     string,
          "endTime":       string
        },
        "items": [
          {
            "productNameEn": string,
            "quantity":    number
          }
        ],
        "seller": {
          "name":          string,
          "storeName":     string
        },
        "buyer": {
          "name":          string
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
> Each item in `orders[]` is a SubOrder — the per-seller transaction unit.
> BUYER response includes `seller` field.
> SELLER response includes `buyer` field.
> Both always present — client decides which to display.
> Use `subOrder.id` (not `order.id`) for cancel, advance, request-payment, verify-otp.

---

### GET /api/orders/:id
Fetch full detail of a SubOrder including complete status history.
`:id` is the SubOrder id.
```
Auth:    Bearer
Rule:    req.user.id must equal subOrder.order.buyerId
         OR req.user.id must equal subOrder.sellerId
         OR req.user.role must equal ADMIN
         Anyone else receives 403 even with a valid token.
Body:    None
```

**Success**
```
200: {
  "success": true,
  "data": {
    "subOrder": {
      "id":                 string,   — SubOrder id
      "shortId":            string,
      "orderId":            string,   — parent Order id
      "status":             string,
      "totalAmount":        number,
      "advanceAmount":      number,
      "remainingAmount":    number,
      "platformFee":        number,
      "items": [
        {
          "productId":      string,
          "productNameEn":    string,
          "quantity":       number,
          "unitPrice":      number,
          "subtotal":       number
        }
      ],
      "statusHistory": [
        {
          "fromStatus":     string | null,
          "toStatus":       string,
          "timestamp":      string,
          "note":           string | null
        }
      ],
      "pickupWindow": {
        "id":               string,
        "labelEn":          string,
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
401:  UNAUTHENTICATED     — "Please login to continue."
403:  FORBIDDEN           — "You are not authorized to view this order."
404:  SUBORDER_NOT_FOUND  — "Order not found."
```

---

### PATCH /api/orders/:id/cancel
Cancel a SubOrder. `:id` is the SubOrder id.
Refund amount depends on how far the cancellation is from the scheduled pickup time.
```
Auth:    Bearer (BUYER or SELLER)
Rule:    SubOrder `:id` must be owned by req.user (buyer or seller)
         BUYER  can cancel: PENDING, CONFIRMED
         SELLER can cancel: PENDING, CONFIRMED → buyer receives 100% refund, seller −15 score
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
    "subOrder": {
      "id":       string,   — SubOrder id
      "status":   "CANCELLED"
    },
    "refundAmount":  number,   — server-calculated, never client-supplied (INV-13)
    "refundStatus":  "INITIATED" | "NOT_APPLICABLE"
  }
}
```

**Errors**
```
401:  UNAUTHENTICATED          — "Please login to continue."
403:  FORBIDDEN                — "You are not authorized to cancel this order."
404:  SUBORDER_NOT_FOUND       — "Order not found."
409:  INVALID_TRANSITION       — "Order cannot be cancelled in its current status."
                                  meta: { currentStatus, cancellableStatuses }
```

---

### POST /api/orders/:id/advance
Retry the advance payment flow for a SubOrder. `:id` is the SubOrder id.
Used when buyer closes the Razorpay modal before completing payment.
```
Auth:    Bearer (BUYER — own SubOrder only)
Rule:    SubOrder status must be PENDING
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
404:  SUBORDER_NOT_FOUND  — "Order not found."
409:  INVALID_TRANSITION  — "Advance payment only available for PENDING orders."
502:  RAZORPAY_ERROR      — "Payment service error. Please retry."
```

---

### POST /api/orders/:id/request-payment
Seller requests a Razorpay payment link for the remaining SubOrder amount.
`:id` is the SubOrder id. Called after buyer arrives and inspects goods.
Transitions SubOrder from CONFIRMED → AWAITING_PAYMENT.
```
Auth:    Bearer (SELLER — own SubOrder only)
Rule:    SubOrder status must be CONFIRMED
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
404:  SUBORDER_NOT_FOUND  — "Order not found."
409:  INVALID_TRANSITION  — "Payment can only be requested for CONFIRMED orders."
502:  RAZORPAY_ERROR      — "Payment link creation failed. Please retry."
```

> **Side effect:** SubOrder transitions CONFIRMED → AWAITING_PAYMENT immediately.
> Payment link expires in 30 minutes. After expiry seller must call this
> endpoint again to generate a new link.

---

### POST /api/orders/:id/verify-otp
Seller enters the OTP read aloud by the buyer to complete the SubOrder.
`:id` is the SubOrder id. OTP is generated on CONFIRMED, delivered to buyer via notification.
```
Auth:    Bearer (SELLER — own SubOrder only)
Rule:    SubOrder status must be READY_FOR_OTP_VERIFICATION
Body:    {
  otp:  string   required — 4 digits
}
```

**Success**
```
200: {
  "success": true,
  "data": {
    "subOrder": {
      "id":            string,   — SubOrder id
      "shortId":       string,
      "status":        "COMPLETED"
    },
    "payoutId":        string    — Payout record created for this seller
  }
}
```

**Errors**
```
400:  INVALID_OTP         — "Invalid or expired OTP."
401:  UNAUTHENTICATED     — "Please login to continue."
403:  FORBIDDEN           — "Only the seller can verify OTP."
404:  SUBORDER_NOT_FOUND  — "Order not found."
409:  INVALID_TRANSITION  — "OTP verification only available for SubOrders in
                             READY_FOR_OTP_VERIFICATION status."
429:  OTP_ATTEMPTS        — "Too many incorrect attempts."
```

> **Side effects on COMPLETED:**
> - `SubOrder.deliveryOtp` set to `null` immediately (INV-06)
> - Payout record created: `amount = totalAmount − platformFee`
> - In-app notification fires for buyer and seller
> - After 3 wrong OTP attempts SubOrder moves to DISPUTED status

---

## Payments

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

## Notifications

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
| `VALIDATION_FAILED` | 422 | Zod schema validation failed. Returns `fields` array. |
| `UNAUTHENTICATED` | 401 | Missing, invalid, or expired Bearer token. |
| `FORBIDDEN` | 403 | Valid token but wrong role or not resource owner. |
| `RATE_LIMITED` | 429 | Too many requests to this endpoint. |
| `PHONE_EXISTS` | 409 | Phone already registered on signup. |
| `PHONE_NOT_FOUND` | 404 | No account found with this phone number. |
| `INVALID_CREDENTIALS` | 401 | Wrong phone or PIN on login. |
| `PIN_LOCKED` | 429 | Too many consecutive failed login attempts. |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token expired, revoked, or already rotated. |
| `STORE_EXISTS` | 409 | Store with same name and address already registered. |
| `STORE_IMAGE_LIMIT` | 400 | Maximum 5 store images already uploaded. |
| `PRODUCT_NOT_FOUND` | 404 | Product does not exist or has been soft-deleted. |
| `PICKUP_WINDOW_NOT_FOUND` | 404 | Pickup window does not exist. |
| `LAST_PICKUP_WINDOW` | 400 | Cannot delete the only remaining active pickup window. |
| `PICKUP_WINDOW_LIMIT` | 400 | Maximum 7 pickup windows allowed. |
| `ORDER_NOT_FOUND` | 404 | Order does not exist. |
| `INSUFFICIENT_STOCK` | 409 | Requested quantity exceeds `product.available`. |
| `BELOW_MINIMUM_ORDER` | 400 | Order total below platform minimum of ₹1000. |
| `WINDOW_UNAVAILABLE` | 400 | Pickup window is closed or does not exist. |
| `INVALID_PICKUP_DATE` | 400 | Pickup date is in the past or outside seller active days. |
| `DUPLICATE_ORDER` | 409 | Active order already exists for this product and window. |
| `INVALID_OTP` | 400 | OTP is incorrect or has already been cleared. |
| `OTP_ATTEMPTS` | 429 | Too many consecutive wrong OTP attempts. |
| `INVALID_TRANSITION` | 409 | Order state machine rejected this status transition. |
| `RAZORPAY_ERROR` | 502 | Razorpay API call failed. Retryable. |
| `CART_EMPTY` | 400 | Checkout attempted with empty cart. |
| `CART_ITEM_NOT_FOUND` | 404 | Cart item does not exist. |
| `ACCOUNT_HAS_ACTIVE_ORDERS` | 409 | Cannot delete account with active orders. |
| `ALREADY_SAVED` | 409 | Product already in this saved list. |
| `SAVED_PRODUCT_NOT_FOUND` | 404 | Saved item does not exist. |
| `REVIEW_ALREADY_EXISTS` | 409 | Review already submitted for this order and product. |
| `REVIEW_NOT_FOUND` | 404 | Review does not exist. |
| `NO_ACTIVE_DEAL` | 400 | No active deal on this product. |
| `DEAL_EXISTS` | 409 | A deal already exists on this product. Delete before adding new one. |
| `INVALID_EXPIRY_TIME` | 400 | Deal expiry must be in the future. |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification does not exist. |
| `SUBORDER_NOT_FOUND` | 404 | SubOrder does not exist. |

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
| INV-05 | User sees only their own orders | `orderRepo` checks `buyerId` or `sellerId` matches `req.user.id`. Admins exempt. |
| INV-06 | Delivery OTP cleared after verification | `deliveryOtp` set to `null` on COMPLETED. Never stored beyond use. |
| INV-07 | Phone number is the unique user identifier | `phone @unique` enforced at DB level. Duplicate returns `409 PHONE_EXISTS`. |
| INV-08 | Seller store name + address must be unique | `@@unique([storeName, street])` enforced at DB level. |
| INV-09 | Deal price reverts to original after expiry | Vercel Cron sets `Deal.status = EXPIRED` after `Deal.expiresAt`. Product response reads active deal via JOIN — expired deal returns no discount. |
| INV-10 | Order total must be >= ₹1000 | `orderService` checks against `PlatformConfig.minOrderAmount` before creating Razorpay advance. |
| INV-11 | Order cannot confirm without captured advance | Only `payment.captured` webhook triggers `PENDING → CONFIRMED`. No manual endpoint. |
| INV-12 | Order cannot complete without full payment AND OTP | State machine requires `READY_FOR_OTP_VERIFICATION` before verify-otp is callable. |
| INV-13 | Refund calculated server-side only | `cancelOrderService` computes from `SubOrder.pickupDeadline`. Client never sends refundAmount. Tiers: 24h+ → 100%, 2–24h → 50%, <2h → 0%. |
| INV-14 | Seller cannot see own products in buyer feed | `productRepo` applies `sellerId: { not: req.user.id }` when authenticated user is also a seller. |
| INV-15 | Review only allowed after COMPLETED SubOrder | `reviewService` verifies `subOrder.status === COMPLETED` and `subOrder.order.buyerId === req.user.id`. |
| INV-16 | One review per order per product | `Review.@@unique([subOrderId, productId])` enforced at DB level. Reviews link to SubOrder (per-seller transaction), not parent Order. |
| INV-17 | Bank details masked in all responses | `accountNumber` truncated to last 4 digits. Raw value never leaves server. |
| INV-18 | Client never sends status transitions | No endpoint accepts `status` in request body. State changes only via service layer and webhooks. |
| INV-19 | Cart checkout reads from server state only | `POST /api/cart/checkout` takes no body. Server reads CartSession from DB. Client cannot inject items. |

---