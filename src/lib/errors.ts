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
  UNAUTHORIZED: new AppError("UNAUTHORIZED", "Please login to continue.", 401),

  // 401 — refresh token expired, revoked, or reuse detected
  REFRESH_TOKEN_INVALID: new AppError(
    "REFRESH_TOKEN_INVALID",
    "Session expired or invalid. Please login.",
    401,
  ),

  // 401 — wrong phone or PIN (same message for both — prevents enumeration)
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

  // ── Authorisation ─────────────────────────────────────────────────────

  // 403 — valid token, wrong role (e.g. BUYER hitting seller route)
  FORBIDDEN: new AppError(
    "FORBIDDEN",
    "You do not have permission to perform this action.",
    403,
  ),

  // 403 — valid token, right role, wrong ownership
  NOT_YOUR_PRODUCT: new AppError(
    "NOT_YOUR_PRODUCT",
    "You can only modify your own products.",
    403,
  ),

  // ── Validation ────────────────────────────────────────────────────────

  // 422 — Zod parse failed (converted from ZodError in handleError)
  // meta carries err.errors array from Zod
  VALIDATION_FAILED: (meta?: unknown) =>
    new AppError(
      "VALIDATION_FAILED",
      "Validation failed. Please check your input.",
      422,
      meta,
    ),

  // ── Products ──────────────────────────────────────────────────────────

  // 404 — product does not exist or has been soft-deleted
  PRODUCT_NOT_FOUND: new AppError(
    "PRODUCT_NOT_FOUND",
    "Product not found or no longer available.",
    404,
  ),

  // 400 — dealDiscountPercent set but dealExpiresAt missing
  DEAL_CONFIG_INVALID: new AppError(
    "DEAL_CONFIG_INVALID",
    "dealExpiresAt is required when dealDiscountPercent is set.",
    400,
  ),

  // ── Orders ────────────────────────────────────────────────────────────

  // 404 — order does not exist
  ORDER_NOT_FOUND: new AppError("ORDER_NOT_FOUND", "Order not found.", 404),

  // 409 — requested quantity exceeds product.available
  // meta: { productId: string, productName: string,
  //         requested: number, available: number }
  INSUFFICIENT_STOCK: (meta?: unknown) =>
    new AppError(
      "INSUFFICIENT_STOCK",
      "Not enough stock available.",
      409,
      meta,
    ),

  // 400 — order total below platform minimum
  // meta: { minimum: number, current: number }
  BELOW_MINIMUM_ORDER: (meta?: unknown) =>
    new AppError(
      "BELOW_MINIMUM_ORDER",
      "Order total is below the minimum order amount.",
      400,
      meta,
    ),

  // 400 — pickup window closed or does not exist
  WINDOW_UNAVAILABLE: new AppError(
    "WINDOW_UNAVAILABLE",
    "This pickup window is unavailable.",
    400,
  ),

  // 400 — pickup date is in the past or outside seller active days
  INVALID_PICKUP_DATE: new AppError(
    "INVALID_PICKUP_DATE",
    "Pickup date is invalid or in the past.",
    400,
  ),

  // 409 — active order already exists for this product and pickup window
  DUPLICATE_ORDER: new AppError(
    "DUPLICATE_ORDER",
    "An active order already exists for this product and pickup window.",
    409,
  ),

  // 400 — order cannot be cancelled at this stage
  CANCELLATION_NOT_ALLOWED: new AppError(
    "CANCELLATION_NOT_ALLOWED",
    "Order cannot be cancelled at this stage.",
    400,
  ),

  // 409 — state machine rejected the transition
  // meta: { currentStatus: string, cancellableStatuses?: string[] }
  INVALID_TRANSITION: (meta?: unknown) =>
    new AppError(
      "INVALID_TRANSITION",
      "This order status transition is not allowed.",
      409,
      meta,
    ),

  // 400 — OTP is wrong or already cleared (set to null after use)
  INVALID_OTP: new AppError("INVALID_OTP", "Invalid or expired OTP.", 400),

  // 429 — too many consecutive wrong OTP attempts
  OTP_ATTEMPTS: new AppError(
    "OTP_ATTEMPTS",
    "Too many incorrect attempts.",
    429,
  ),

  // ── External Services ─────────────────────────────────────────────────

  // 502 — Razorpay API call failed (retryable)
  RAZORPAY_ERROR: new AppError(
    "RAZORPAY_ERROR",
    "Payment service error. Please retry.",
    502,
  ),

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

  // ── Generic fallback ──────────────────────────────────────────────────

  // 404 — use specific codes above where possible
  NOT_FOUND: (resource: string) =>
    new AppError("NOT_FOUND", `${resource} not found.`, 404),
} as const;
