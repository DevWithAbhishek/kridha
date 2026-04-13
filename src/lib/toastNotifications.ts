/**
 * Setup:    Add <Toaster /> to your root layout (see bottom of file)
 *
 * Usage:
 *   toast.success("Order confirmed!")
 *   toast.error("Payment failed. Please retry.")
 *   toast.warning("Stock is running low.")
 *   toast.info("Your OTP has been sent.")
 *   toast.retryFailed("Network error", () => fetchOrders())
 *   toast.loading("Placing your order…")
 *   toast.promise(myAsyncFn(), { loading: "…", success: "Done!", error: "Failed" })
 */

import { toast as sonner, ExternalToast } from "sonner";

// ─── Base durations ────────────────────────────────────────────────────────────
// Longer durations for slow-network environments (Tier-2/3 UP users)
const DURATION = {
  success: 4000,
  error: 6000, // longer — user needs time to read & decide
  warning: 5000,
  info: 4000,
  retryFailed: 0, // persists until dismissed or action taken
} as const;

// ─── Shared base options ───────────────────────────────────────────────────────
const base = (overrides?: ExternalToast): ExternalToast => ({
  position: "bottom-center", // mobile-first: thumb-reachable zone
  closeButton: true,
  ...overrides,
});

// ─── Toast API ─────────────────────────────────────────────────────────────────

export const toast = {
  /**
   * ✅ Success — green
   * e.g. "Order placed!", "Payment received", "Store updated"
   */
  success: (message: string, options?: ExternalToast) =>
    sonner.success(message, base({ duration: DURATION.success, ...options })),

  /**
   * ❌ Error — red
   * e.g. "Something went wrong. Please try again."
   * Use for hard failures that don't offer a retry inline.
   */
  error: (message: string, options?: ExternalToast) =>
    sonner.error(message, base({ duration: DURATION.error, ...options })),

  /**
   * 🔄 Failed + Retry — red with action button
   * e.g. "Couldn't load products" → user taps Retry
   * Duration is infinite — stays until user retries or dismisses.
   */
  retryFailed: (
    message: string,
    onRetry: () => void,
    options?: ExternalToast,
  ) =>
    sonner.error(
      message,
      base({
        duration: DURATION.retryFailed,
        action: {
          label: "Retry",
          onClick: onRetry,
        },
        ...options,
      }),
    ),

  /**
   * ⚠️ Warning — orange/amber
   * e.g. "Only 3 kg left in stock", "Deal expires in 1 hour"
   */
  warning: (message: string, options?: ExternalToast) =>
    sonner.warning(message, base({ duration: DURATION.warning, ...options })),

  /**
   * ℹ️ Info — blue
   * e.g. "OTP sent to +91 XXXXX", "Pickup window: 6–9 AM"
   */
  info: (message: string, options?: ExternalToast) =>
    sonner.info(message, base({ duration: DURATION.info, ...options })),

  /**
   * ⏳ Loading — neutral, returns toast id for dismissal
   * e.g. "Placing your order…"
   * Always dismiss with toast.dismiss(id) when done.
   */
  loading: (message: string, options?: ExternalToast) =>
    sonner.loading(message, base({ duration: Infinity, ...options })),

  /**
   * 🔁 Promise — auto-transitions loading → success / error
   * Best for async operations (API calls, form submissions)
   *
   * @example
   * toast.promise(placeOrder(cart), {
   *   loading: "Placing your order…",
   *   success: "Order confirmed! Check your pickup window.",
   *   error: (err) => err?.message ?? "Order failed. Please retry.",
   * });
   */
  promise: <T>(
    promiseOrFn: Promise<T> | (() => Promise<T>),
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    },
    options?: ExternalToast,
  ) =>
    sonner.promise(promiseOrFn, {
      ...messages,
      ...base(options),
    }),

  /**
   * 🗑️ Dismiss a specific toast (use with loading)
   */
  dismiss: (id?: string | number) => sonner.dismiss(id),
} as const;

// ─── Default export (tree-shakeable named export preferred above) ───────────
export default toast;


/**
 * ─── USAGE EXAMPLES ───────────────────────────────────────────────────────────
 *
 * // Simple cases
 * toast.success("Order placed successfully!");
 * toast.error("Payment failed. Please try again.");
 * toast.warning("Only 2 kg of Mustard Oil left.");
 * toast.info("OTP sent to your registered number.");
 *
 * // Retry pattern (persists until dismissed)
 * toast.retryFailed("Couldn't load nearby suppliers.", () => refetchSuppliers());
 *
 * // Async with promise (recommended for API calls)
 * toast.promise(cancelOrder(orderId), {
 *   loading: "Cancelling order…",
 *   success: "Order cancelled. Refund queued.",
 *   error: (err) => err?.message ?? "Cancellation failed.",
 * });
 *
 * // Manual loading → dismiss
 * const id = toast.loading("Uploading product image…");
 * await uploadToCloudinary(file);
 * toast.dismiss(id);
 * toast.success("Image uploaded!");
 *
 * // Hindi message support (next-intl)
 * const t = useTranslations("toast");
 * toast.success(t("orderPlaced"));
 */
