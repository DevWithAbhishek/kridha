"use client";
// src/app/(buyer)/orders/[id]/page.tsx
// Buyer SubOrder detail — status history, OTP display, cancel with refund rules tooltip,
// payment link, bill-style items list

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  Clock,
  Package,
  Copy,
  CheckCircle2,
  AlertCircle,
  X,
  Info,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import type { OrderStatus } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────
interface StatusHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
  note: string | null;
}
interface SubOrderDetail {
  id: string;
  shortId: string;
  orderId: string;
  status: OrderStatus;
  totalAmount: number;
  advanceAmount: number;
  remainingAmount: number;
  platformFee: number;
  pickupDate: string;
  pickupDeadline: string;
  deliveryOtp: string | null;
  otpAttempts: number;
  paymentLinkUrl: string | null;
  paymentLinkExpiresAt: string | null;
  orderItems: {
    productId: string;
    productNameEn: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  statusHistory: StatusHistoryEntry[];
  pickupWindow: {
    id: string;
    labelEn: string;
    labelHi: string;
    startTime: string;
    endTime: string;
  };
  seller: {
    id: string;
    name: string;
    storeName: string;
    reliabilityScore: number;
  };
  buyer: { id: string; name: string };
  createdAt: string;
}

// ── Status config ─────────────────────────────────────────────────────────────
const SC = {
  PENDING: {
    l: "Pending",
    lH: "Pending",
    cls: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  CONFIRMED: {
    l: "Confirmed",
    lH: "Confirmed",
    cls: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  AWAITING_PAYMENT: {
    l: "Pay Remaining",
    lH: "Pay Remaining",
    cls: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
  },
  READY_FOR_OTP_VERIFICATION: {
    l: "Show OTP",
    lH: "OTP दिखाएं",
    cls: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
  },
  COMPLETED: {
    l: "Completed",
    lH: "Completed",
    cls: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    dot: "bg-green-500",
  },
  CANCELLED: {
    l: "Cancelled",
    lH: "Cancelled",
    cls: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700",
    dot: "bg-gray-400",
  },
  DISPUTED: {
    l: "Disputed",
    lH: "Disputed",
    cls: "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    dot: "bg-red-500",
  },
} as const;
function StatusBadge({ status }: { status: OrderStatus }) {
  const c = SC[status] ?? SC.PENDING;
  const { lang } = useLangStore();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm font-semibold border ${c.cls}`}
    >
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {lang === "hi" ? c.lH : c.l}
    </span>
  );
}

// ── Status timeline ───────────────────────────────────────────────────────────
function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  return (
    <div className="space-y-0">
      {history.map((entry, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${i === history.length - 1 ? "bg-kridha-primary" : "bg-gray-300 dark:bg-gray-600"}`}
            />
            {i < history.length - 1 && (
              <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1 mb-0" />
            )}
          </div>
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                {entry.fromStatus && (
                  <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                    {entry.fromStatus.replace(/_/g, " ")} →
                  </p>
                )}
                <p className="font-semibold text-label-sm text-[var(--color-text)]">
                  {entry.toStatus.replace(/_/g, " ")}
                </p>
                {entry.note && (
                  <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mt-0.5">
                    {entry.note}
                  </p>
                )}
              </div>
              <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark flex-shrink-0">
                {new Date(entry.createdAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Refund Rules Tooltip ───────────────────────────────────────────────────────
function RefundRulesTooltip({
  pickupDeadline,
  advanceAmount,
}: {
  pickupDeadline: string;
  advanceAmount: number;
}) {
  const { lang } = useLangStore();
  const [open, setOpen] = useState(false);
  const deadlineMs = new Date(pickupDeadline).getTime() - Date.now();
  const h = deadlineMs / 3600000;
  const tier = h > 24 ? "100%" : h > 2 ? "50%" : "0%";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-label-xs text-muted-DEFAULT dark:text-muted-dark hover:text-kridha-primary transition-colors"
        aria-label="Refund rules"
      >
        <Info className="w-3.5 h-3.5" />
        {lang === "hi" ? "Refund rules" : "Refund rules"}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl shadow-xl z-20 p-4">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <p className="font-bold text-label-sm text-[var(--color-text)] mb-3">
            {lang === "hi" ? "Cancel करने पर refund" : "Cancellation Refund"}
          </p>
          {[
            {
              when: "24h+ before pickup",
              whenH: "24 घंटे+ पहले",
              you: "100% refund",
              cls: "text-green-600 dark:text-green-400",
            },
            {
              when: "2–24h before pickup",
              whenH: "2–24 घंटे पहले",
              you: "50% refund",
              cls: "text-amber-600 dark:text-amber-400",
            },
            {
              when: "<2h before pickup",
              whenH: "2 घंटे से कम",
              you: "No refund",
              cls: "text-error",
            },
            {
              when: "Seller cancels",
              whenH: "Seller cancel करे",
              you: "100% refund",
              cls: "text-green-600 dark:text-green-400",
            },
          ].map((row, i) => (
            <div
              key={i}
              className={`flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0 ${tier === "100%" && i === 0 ? "bg-kridha-secondary dark:bg-kridha-primary/10 -mx-1 px-1 rounded" : tier === "50%" && i === 1 ? "bg-kridha-secondary dark:bg-kridha-primary/10 -mx-1 px-1 rounded" : ""}`}
            >
              <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                {lang === "hi" ? row.whenH : row.when}
              </span>
              <span className={`text-label-xs font-semibold ${row.cls}`}>
                {row.you}
              </span>
            </div>
          ))}
          <div className="mt-3 flex items-start gap-2 px-2 py-2 rounded-xl bg-kridha-secondary dark:bg-kridha-primary/10">
            <Info className="w-3.5 h-3.5 text-kridha-primary flex-shrink-0 mt-0.5" />
            <p className="text-label-xs text-kridha-primary">
              {lang === "hi"
                ? `अभी cancel करने पर advance ₹${advanceAmount} में से ${tier} वापस मिलेगा`
                : `Currently eligible for ${tier} refund on ₹${advanceAmount} advance`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cancel Modal ───────────────────────────────────────────────────────────────
function CancelModal({
  open,
  onClose,
  orderId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  onSuccess: () => void;
}) {
  const { lang } = useLangStore();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  async function handle() {
    setLoading(true);
    setErr("");
    try {
      await api.patch(`/orders/${orderId}/cancel`, {
        reason: reason || undefined,
      });
      onSuccess();
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Cancel failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
          setReason("");
          setErr("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
        <Dialog.Content className="fixed bottom-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-sm bg-[var(--color-surface)] dark:bg-surface-dark rounded-t-2xl sm:rounded-modal shadow-modal z-modal p-6">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-bold text-h5 text-[var(--color-text)]">
              {lang === "hi" ? "Order cancel करें?" : "Cancel Order?"}
            </Dialog.Title>
            <button
              onClick={() => {
                if (!loading) {
                  setReason("");
                  setErr("");
                  onClose();
                }
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <Dialog.Description className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-4">
            {lang === "hi"
              ? "Refund amount pickup time के हिसाब से calculate होगा।"
              : "Refund amount depends on time until pickup."}
          </Dialog.Description>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              lang === "hi" ? "Reason (optional)" : "Reason (optional)"
            }
            rows={3}
            className="w-full px-4 py-3 border border-border-DEFAULT dark:border-border-dark rounded-xl bg-[var(--color-surface)] dark:bg-surface-dark text-[var(--color-text)] text-label-sm outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20 resize-none mb-4"
          />
          {err && (
            <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-label-sm text-error">
              {err}
            </div>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => {
                if (!loading) {
                  setReason("");
                  setErr("");
                  onClose();
                }
              }}
              disabled={loading}
            >
              {lang === "hi" ? "वापस जाएं" : "Go back"}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              className="flex-1"
              onClick={handle}
              loading={loading}
            >
              {lang === "hi" ? "Cancel करें" : "Confirm Cancel"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── OTP display for buyer ─────────────────────────────────────────────────────
function OtpDisplay({ otp }: { otp: string }) {
  const { lang } = useLangStore();
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(otp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <KeyRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <p className="font-bold text-label-md text-purple-700 dark:text-purple-300">
          {lang === "hi"
            ? "Pickup OTP — Seller को दिखाएं"
            : "Pickup OTP — Show to seller"}
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 my-3">
        <div className="text-4xl font-bold tracking-[0.3em] text-purple-700 dark:text-purple-300 font-mono">
          {otp}
        </div>
        <button
          onClick={copy}
          className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
        >
          {copied ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-label-xs text-purple-600 dark:text-purple-400">
        {lang === "hi"
          ? "यह OTP seller को pickup पर बोलें"
          : "Read this OTP aloud to the seller at pickup"}
      </p>
    </div>
  );
}

function PayNowButton({
  orderId,
  advanceAmount,
  onSuccess,
}: {
  orderId: string;
  advanceAmount: number;
  onSuccess: () => void;
}) {
  const { lang } = useLangStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Countdown from createdAt — pulled from order.createdAt
  // Parent passes this via prop instead

  async function handlePay() {
    setLoading(true);
    setError("");

    try {
      const res = await api.get(`/orders/${orderId}/advance`);
      const { razorpayOrderId, amount } = res.data.data;

      // Razorpay checkout.js must be loaded
      // Add <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      // to your layout.tsx or this page
      const Razorpay = (
        window as unknown as {
          Razorpay: new (opts: unknown) => { open(): void };
        }
      ).Razorpay;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: Math.round(amount * 100),
        currency: "INR",
        order_id: razorpayOrderId,
        name: "Kridha",
        description: `Advance for order ${orderId.slice(-6).toUpperCase()}`,
        handler: () => {
          // Payment captured — webhook will update status to CONFIRMED
          // Poll via refetchInterval (already on query) — no manual action needed
          onSuccess();
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
        theme: { color: "#16a34a" },
      };

      new Razorpay(options).open();
    } catch (e: unknown) {
      const ex = e as {
        response?: { status?: number; data?: { message?: string } };
      };

      if (ex.response?.status === 410) {
        // Order window expired — lazy expiry will have released stock
        setError(
          lang === "hi"
            ? "Payment window expire हो गया। नया order place करें।"
            : "Payment window expired. Please place a new order.",
        );
        setLoading(false);
        return;
      }

      setError(ex.response?.data?.message ?? "Payment initiation failed");
      setLoading(false);
    }
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-label-md text-amber-700 dark:text-amber-300">
            {lang === "hi"
              ? "Advance payment pending है"
              : "Advance payment pending"}
          </p>
          <p className="text-label-xs text-amber-600 dark:text-amber-400 mt-0.5">
            {lang === "hi"
              ? `₹${advanceAmount.toLocaleString("en-IN")} advance pay करें। 15 मिनट में pay नहीं किया तो order cancel होगा।`
              : `Pay ₹${advanceAmount.toLocaleString("en-IN")} advance. Order cancels automatically if not paid within 15 minutes.`}
          </p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-label-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handlePay}
        loading={loading}
        disabled={loading}
      >
        {loading
          ? lang === "hi"
            ? "Opening..."
            : "Opening payment..."
          : `Pay ₹${advanceAmount.toLocaleString("en-IN")} Advance`}
      </Button>
    </div>
  );
}

// ── Bill items ─────────────────────────────────────────────────────────────────
function BillItems({
  items,
  totalAmount,
  advanceAmount,
  remainingAmount,
  platformFee,
}: {
  items: SubOrderDetail["orderItems"];
  totalAmount: number;
  advanceAmount: number;
  remainingAmount: number;
  platformFee: number;
}) {
  const { lang } = useLangStore();
  return (
    <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden">
      {/* Items */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <div className="px-5 py-3.5 border-b border-border-DEFAULT dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/20">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 text-label-xs font-semibold text-muted-DEFAULT dark:text-muted-dark uppercase tracking-wide">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Total</span>
          </div>
        </div>
        {items.map((item) => (
          <div key={item.productId} className="px-5 py-3">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
              <span className="text-label-sm text-[var(--color-text)] font-medium truncate">
                {item.productNameEn}
              </span>
              <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark text-right">
                {item.quantity}
              </span>
              <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark text-right">
                ₹{item.unitPrice.toLocaleString("en-IN")}
              </span>
              <span className="text-label-sm font-semibold text-[var(--color-text)] text-right">
                ₹{item.subtotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        ))}
      </div>
      {/* Totals */}
      <div className="border-t border-border-DEFAULT dark:border-border-dark px-5 py-4 space-y-2">
        <div className="flex justify-between text-label-sm">
          <span className="text-muted-DEFAULT dark:text-muted-dark">
            {lang === "hi" ? "Subtotal" : "Subtotal"}
          </span>
          <span className="font-medium text-[var(--color-text)]">
            ₹{(totalAmount + platformFee).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between text-label-sm">
          <span className="text-muted-DEFAULT dark:text-muted-dark">
            Platform fee
          </span>
          <span className="text-muted-DEFAULT dark:text-muted-dark">
            ₹{platformFee.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between font-bold text-label-md border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
          <span className="text-[var(--color-text)]">Order Total</span>
          <span className="text-kridha-primary">
            ₹{totalAmount.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between text-label-sm">
          <span className="text-muted-DEFAULT dark:text-muted-dark">
            {lang === "hi" ? "Advance paid" : "Advance paid"}
          </span>
          <span className="text-green-600 dark:text-green-400 font-medium">
            ₹{advanceAmount.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between text-label-sm font-semibold">
          <span className="text-[var(--color-text)]">
            {lang === "hi" ? "Remaining (pickup पर)" : "Remaining (at pickup)"}
          </span>
          <span className="text-orange-600 dark:text-orange-400">
            ₹{remainingAmount.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function BuyerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { lang } = useLangStore();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery<SubOrderDetail>({
    queryKey: ["order-detail-buyer", id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => r.data.data),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: 2,
    refetchInterval: (d) => {
      const s = d.state.data?.status;
      return s && !["COMPLETED", "CANCELLED", "DISPUTED"].includes(s)
        ? 30_000
        : false;
    },
  });

  const canCancel = order && ["PENDING", "CONFIRMED"].includes(order.status);
  const showOtp =
    order?.status === "READY_FOR_OTP_VERIFICATION" && !!order.deliveryOtp;
  const showPayLink =
    order?.status === "AWAITING_PAYMENT" && !!order.paymentLinkUrl;

  if (isLoading)
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse ${i === 0 ? "h-12" : "h-32"}`}
          />
        ))}
      </div>
    );
  if (isError || !order)
    return (
      <div className="flex flex-col items-center py-24 gap-4 text-center px-4">
        <AlertCircle className="w-12 h-12 text-muted-DEFAULT dark:text-muted-dark" />
        <p className="text-h5 font-bold text-[var(--color-text)]">
          Order not found
        </p>
        <Link href="/profile/orders">
          <Button variant="outline">← Back to Orders</Button>
        </Link>
      </div>
    );


  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Back */}
      <Link
        href="/profile/orders"
        className="inline-flex items-center gap-2 text-label-sm text-muted-DEFAULT dark:text-muted-dark hover:text-kridha-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {lang === "hi" ? "Orders पर जाएं" : "Back to Orders"}
      </Link>

      {/* Header */}
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mb-1">
              {lang === "hi" ? "Order ID" : "Order ID"}
            </p>
            <h1 className="text-h4 font-bold text-[var(--color-text)]">
              {order.shortId}
            </h1>
          </div>
          <StatusBadge status={order.status} />
          {order.status === "PENDING" && (
            <PayNowButton
              orderId={id}
              advanceAmount={order.advanceAmount}
              onSuccess={() =>
                qc.invalidateQueries({ queryKey: ["order-detail-buyer", id] })
              }
            />
          )}
        </div>
        {/* Seller */}
        <div className="flex items-start gap-3 py-3 border-t border-gray-100 dark:border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center text-kridha-primary font-bold flex-shrink-0">
            {order.seller.storeName.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-label-md text-[var(--color-text)]">
              {order.seller.storeName}
            </p>
            <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
              {lang === "hi" ? "Reliability" : "Reliability"}:{" "}
              {order.seller.reliabilityScore}%
            </p>
          </div>
        </div>
        {/* Pickup */}
        <div className="flex items-start gap-2 py-3 border-t border-gray-100 dark:border-gray-800 text-label-sm text-[var(--color-text)]">
          <Clock className="w-4 h-4 text-kridha-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {lang === "hi"
                ? order.pickupWindow.labelHi
                : order.pickupWindow.labelEn}{" "}
              · {order.pickupWindow.startTime}–{order.pickupWindow.endTime}
            </p>
            <p className="text-muted-DEFAULT dark:text-muted-dark text-label-xs">
              {new Date(order.pickupDate).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* OTP display */}
      {showOtp && <OtpDisplay otp={order.deliveryOtp!} />}

      {/* Payment link callout */}
      {showPayLink && (
        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
          <div className="flex items-start gap-2 mb-3">
            <Package className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-label-md text-orange-700 dark:text-orange-300">
                {lang === "hi"
                  ? "Remaining payment करें"
                  : "Pay Remaining Amount"}
              </p>
              <p className="text-label-xs text-orange-600 dark:text-orange-400">
                {lang === "hi"
                  ? `₹${order.remainingAmount.toLocaleString("en-IN")} pay करें pickup पर`
                  : `₹${order.remainingAmount.toLocaleString("en-IN")} due at pickup`}
              </p>
            </div>
          </div>
          <a
            href={order.paymentLinkUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-orange-600 text-white text-label-sm font-semibold hover:bg-orange-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Pay ₹{order.remainingAmount.toLocaleString("en-IN")}
          </a>
          {order.paymentLinkExpiresAt && (
            <p className="text-label-xs text-center text-orange-600 dark:text-orange-400 mt-2">
              {lang === "hi" ? "Link expires:" : "Expires:"}{" "}
              {new Date(order.paymentLinkExpiresAt).toLocaleString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}

      {/* Bill / items */}
      <BillItems
        items={order.orderItems}
        totalAmount={order.totalAmount}
        advanceAmount={order.advanceAmount}
        remainingAmount={order.remainingAmount}
        platformFee={order.platformFee}
      />

      {/* Status timeline */}
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-DEFAULT dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/20">
          <h3 className="text-label-md font-semibold text-[var(--color-text)]">
            {lang === "hi" ? "Status History" : "Status History"}
          </h3>
        </div>
        <div className="px-5 py-4">
          <StatusTimeline history={order.statusHistory} />
        </div>
      </div>

      {/* Cancel */}
      {canCancel && (
        <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-label-md text-[var(--color-text)]">
                {lang === "hi" ? "Order cancel करें" : "Cancel Order"}
              </p>
              <RefundRulesTooltip
                pickupDeadline={order.pickupDeadline}
                advanceAmount={order.advanceAmount}
              />
            </div>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => setCancelOpen(true)}
            >
              {lang === "hi" ? "Cancel करें" : "Cancel Order"}
            </Button>
          </div>
        </div>
      )}

      {order.status === "CANCELLED" &&
        order.statusHistory.at(-1)?.note?.includes("Auto-expired") && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-border-DEFAULT dark:border-border-dark rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-muted-DEFAULT flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-label-md text-[var(--color-text)]">
                  {lang === "hi"
                    ? "Payment window expire हो गया"
                    : "Payment window expired"}
                </p>
                <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-0.5">
                  {lang === "hi"
                    ? "Stock release हो गया है। अभी भी available है तो नया order place करें।"
                    : "Stock has been released. Place a new order if still available."}
                </p>
              </div>
            </div>

            {/* Show each item as a quick re-order link */}
            <div className="space-y-2">
              {order.orderItems.map((item) => (
                <Link
                  key={item.productId}
                  href={`/products/${item.productId}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-border-DEFAULT dark:border-border-dark hover:border-kridha-primary transition-colors group"
                >
                  <span className="text-label-sm text-[var(--color-text)] font-medium">
                    {item.productNameEn}
                  </span>
                  <span className="text-label-xs text-kridha-primary group-hover:underline">
                    {lang === "hi" ? "फिर order करें →" : "Order again →"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

      <CancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        orderId={id}
        onSuccess={() => {
          setCancelOpen(false);
          qc.invalidateQueries({ queryKey: ["order-detail-buyer", id] });
          qc.invalidateQueries({ queryKey: ["buyer-orders"] });
        }}
      />
    </div>
  );
}
