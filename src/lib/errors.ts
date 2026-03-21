// src/lib/errors.ts

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly meta?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    meta?: unknown,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.meta = meta;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const ERR = {
  // ── Auth ──────────────────────────────────────────────────────────────

  // 401 — token missing, malformed, or expired
  UNAUTHENTICATED: new AppError(
    "UNAUTHENTICATED",
    "Please login to continue.",
    401,
  ),

  // 401 — refresh token expired, revoked, or reuse detected
  REFRESH_TOKEN_INVALID: new AppError(
    "REFRESH_TOKEN_INVALID",
    "Session expired or invalid. Please login.",
    401,
  ),

  // 401 — wrong phone or PIN (same message — prevents enumeration attacks)
  INVALID_CREDENTIALS: new AppError(
    "INVALID_CREDENTIALS",
    "Invalid phone or PIN.",
    401,
  ),

  // 409 — phone already registered on signup
  PHONE_EXISTS: new AppError(
    "PHONE_EXISTS",
    "Phone already registered. Please login.",
    409,
  ),

  // 404 — no account found with this phone (reset-pin flow)
  PHONE_NOT_FOUND: new AppError(
    "PHONE_NOT_FOUND",
    "No account found with this phone number.",
    404,
  ),

  // 429 — too many consecutive failed login attempts
  PIN_LOCKED: new AppError(
    "PIN_LOCKED",
    "Too many attempts. Try again in 10 minutes.",
    429,
  ),

  // 429 — generic rate limit (Upstash sliding window)
  RATE_LIMITED: new AppError(
    "RATE_LIMITED",
    "Too many requests. Try again in 30 minutes.",
    429,
  ),

  // ── Authorization ─────────────────────────────────────────────────────

  // 403 — valid token, wrong role or not the resource owner
  FORBIDDEN: new AppError(
    "FORBIDDEN",
    "You do not have permission to perform this action.",
    403,
  ),

  // ── Validation ────────────────────────────────────────────────────────

  // 422 — Zod parse failed (converted from ZodError in handleError)
  // meta carries err.issues array from Zod v4
  VALIDATION_FAILED: (meta?: unknown) =>
    new AppError(
      "VALIDATION_FAILED",
      "Validation failed. Please check your input.",
      422,
      meta,
    ),

  // ── Seller Profile ────────────────────────────────────────────────────

  // 409 — store with same name + address already exists (INV-08)
  STORE_EXISTS: new AppError(
    "STORE_EXISTS",
    "A store with this name and address already exists.",
    409,
  ),

  // 400 — maximum 5 store images already uploaded
  STORE_IMAGE_LIMIT: new AppError(
    "STORE_IMAGE_LIMIT",
    "Maximum 5 store images allowed.",
    400,
  ),

  // ── Pickup Windows ────────────────────────────────────────────────────

  // 404 — pickup window does not exist
  PICKUP_WINDOW_NOT_FOUND: new AppError(
    "PICKUP_WINDOW_NOT_FOUND",
    "Pickup window not found.",
    404,
  ),

  // 400 — cannot delete the only remaining active pickup window
  LAST_PICKUP_WINDOW: new AppError(
    "LAST_PICKUP_WINDOW",
    "Cannot delete your only active pickup window.",
    400,
  ),

  // 400 — maximum 7 pickup windows already exist
  PICKUP_WINDOW_LIMIT: new AppError(
    "PICKUP_WINDOW_LIMIT",
    "Maximum 7 pickup windows allowed.",
    400,
  ),

  // ── Products ──────────────────────────────────────────────────────────

  // 404 — product does not exist or has been soft-deleted
  PRODUCT_NOT_FOUND: new AppError(
    "PRODUCT_NOT_FOUND",
    "Product not found or no longer available.",
    404,
  ),

  // ── Deals ─────────────────────────────────────────────────────────────

  // 409 — product already has an active deal
  DEAL_EXISTS: new AppError(
    "DEAL_EXISTS",
    "A deal already exists on this product. Delete it before adding a new one.",
    409,
  ),

  // 400 — no active deal on this product
  NO_ACTIVE_DEAL: new AppError(
    "NO_ACTIVE_DEAL",
    "No active deal on this product.",
    400,
  ),

  // 400 — deal expiry date is in the past
  INVALID_EXPIRY_TIME: new AppError(
    "INVALID_EXPIRY_TIME",
    "Deal expiry must be in the future.",
    400,
  ),

  // ── Cart ──────────────────────────────────────────────────────────────

  // 400 — checkout attempted with empty cart
  CART_EMPTY: new AppError("CART_EMPTY", "Your cart is empty.", 400),

  // 404 — cart item does not exist
  CART_ITEM_NOT_FOUND: new AppError(
    "CART_ITEM_NOT_FOUND",
    "Cart item not found.",
    404,
  ),

  // ── Saved Products ────────────────────────────────────────────────────

  // 409 — product already in this saved list
  ALREADY_SAVED: new AppError(
    "ALREADY_SAVED",
    "Product already in this list.",
    409,
  ),

  // 404 — saved item does not exist
  SAVED_PRODUCT_NOT_FOUND: new AppError(
    "SAVED_PRODUCT_NOT_FOUND",
    "Saved item not found.",
    404,
  ),

  // ── Orders ────────────────────────────────────────────────────────────

  // 404 — parent Order does not exist
  ORDER_NOT_FOUND: new AppError("ORDER_NOT_FOUND", "Order not found.", 404),

  // 404 — SubOrder does not exist
  SUBORDER_NOT_FOUND: new AppError(
    "SUBORDER_NOT_FOUND",
    "Order not found.",
    404,
  ),

  // 409 — requested quantity exceeds product.available
  // meta: { productId, productName, requested, available }
  INSUFFICIENT_STOCK: (meta?: unknown) =>
    new AppError(
      "INSUFFICIENT_STOCK",
      "Not enough stock available.",
      409,
      meta,
    ),

  // 400 — order total below platform minimum (PlatformConfig.minOrderAmountPerSeller)
  // meta: { minimum: number, current: number }
  BELOW_MINIMUM_ORDER: (meta?: unknown) =>
    new AppError(
      "BELOW_MINIMUM_ORDER",
      "Order total is below the minimum order amount.",
      400,
      meta,
    ),

  // 400 — pickup window closed, does not exist, or not active on chosen day
  WINDOW_UNAVAILABLE: new AppError(
    "WINDOW_UNAVAILABLE",
    "This pickup window is unavailable.",
    400,
  ),

  // 400 — pickup date is in the past or outside seller's active days
  INVALID_PICKUP_DATE: new AppError(
    "INVALID_PICKUP_DATE",
    "Pickup date is invalid or in the past.",
    400,
  ),

  // 409 — active SubOrder already exists for this product and pickup window
  DUPLICATE_ORDER: new AppError(
    "DUPLICATE_ORDER",
    "An active order already exists for this product and pickup window.",
    409,
  ),

  // 409 — state machine rejected the transition
  // meta: { currentStatus, cancellableStatuses? }
  INVALID_TRANSITION: (meta?: unknown) =>
    new AppError(
      "INVALID_TRANSITION",
      "This order status transition is not allowed.",
      409,
      meta,
    ),

  // 400 — OTP is wrong or already cleared (set to null after use — INV-06)
  INVALID_OTP: new AppError("INVALID_OTP", "Invalid or expired OTP.", 400),

  // 429 — too many consecutive wrong OTP attempts
  OTP_ATTEMPTS: new AppError(
    "OTP_ATTEMPTS",
    "Too many incorrect attempts.",
    429,
  ),

  // ── Account ───────────────────────────────────────────────────────────

  // 409 — cannot delete account with active orders (PENDING/CONFIRMED/AWAITING_PAYMENT)
  ACCOUNT_HAS_ACTIVE_ORDERS: new AppError(
    "ACCOUNT_HAS_ACTIVE_ORDERS",
    "Resolve all active orders before deleting your account.",
    409,
  ),

  // ── Reviews ───────────────────────────────────────────────────────────

  // 409 — review already submitted for this SubOrder + product
  REVIEW_ALREADY_EXISTS: new AppError(
    "REVIEW_ALREADY_EXISTS",
    "You have already reviewed this product for this order.",
    409,
  ),

  // 404 — review does not exist
  REVIEW_NOT_FOUND: new AppError("REVIEW_NOT_FOUND", "Review not found.", 404),

  // ── Notifications ─────────────────────────────────────────────────────

  // 404 — notification does not exist
  NOTIFICATION_NOT_FOUND: new AppError(
    "NOTIFICATION_NOT_FOUND",
    "Notification not found.",
    404,
  ),

  // 403 — notification belongs to a different user
  NOT_YOUR_NOTIFICATION: new AppError(
    "NOT_YOUR_NOTIFICATION",
    "You cannot access this notification.",
    403,
  ),

  // ── External Services ─────────────────────────────────────────────────

  // 502 — Razorpay API call failed (retryable)
  RAZORPAY_ERROR: new AppError(
    "RAZORPAY_ERROR",
    "Payment service error. Please retry.",
    502,
  ),

  // ── Generic fallback ──────────────────────────────────────────────────

  // 404 — use specific codes above where possible
  NOT_FOUND: (resource: string) =>
    new AppError("NOT_FOUND", `${resource} not found.`, 404),
} as const;
