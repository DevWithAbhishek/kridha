"use client";
// src/app/(seller)/seller/orders/[id]/page.tsx
// Seller SubOrder detail — verify OTP, request payment, cancel,
// status history with timestamps, bill-style items list

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Info,
  KeyRound,
  CreditCard,
  Loader2,
  Copy,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { OrderStatus } from "@/types/dashboard";

// ── Types ─────────────────────────────────────────────────────────────────────
interface StatusHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  timestamp: string;
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
    l: "Awaiting Pay",
    lH: "Payment बाकी",
    cls: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
  },
  READY_FOR_OTP_VERIFICATION: {
    l: "Verify OTP",
    lH: "OTP Verify",
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
              <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />
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
                {new Date(entry.timestamp).toLocaleString("en-IN", {
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

function RefundRulesTooltip({
  pickupDeadline,
  advanceAmount,
}: {
  pickupDeadline: string;
  advanceAmount: number;
}) {
  const { lang } = useLangStore();
  const [open, setOpen] = useState(false);
  const h = (new Date(pickupDeadline).getTime() - Date.now()) / 3600000;
  const tier = h > 24 ? "100% to buyer" : h > 2 ? "50%/50%" : "0% to buyer";
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-label-xs text-muted-DEFAULT dark:text-muted-dark hover:text-kridha-primary transition-colors"
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
            {lang === "hi" ? "Cancel करने पर" : "On Cancellation"}
          </p>
          {[
            {
              when: "You cancel anytime",
              whenH: "Seller cancel करे",
              buyer: "100%",
              score: "-15 reliability",
              cls: "text-error",
            },
            {
              when: "Buyer: 24h+ before",
              whenH: "Buyer: 24h+ पहले",
              buyer: "100% refund",
              score: "—",
              cls: "text-green-600 dark:text-green-400",
            },
            {
              when: "Buyer: 2–24h before",
              whenH: "Buyer: 2–24h पहले",
              buyer: "50% refund",
              score: "50% to you",
              cls: "text-amber-600 dark:text-amber-400",
            },
            {
              when: "Buyer: <2h before",
              whenH: "Buyer: 2h से कम",
              buyer: "No refund",
              score: "100% to you",
              cls: "text-green-600 dark:text-green-400",
            },
          ].map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0 gap-2"
            >
              <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                {lang === "hi" ? row.whenH : row.when}
              </span>
              <div className="text-right">
                <span className={`text-label-xs font-semibold ${row.cls}`}>
                  {lang === "hi" ? row.buyer : row.buyer}
                </span>
                {row.score !== "—" && (
                  <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                    {row.score}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div className="mt-3 flex items-start gap-2 px-2 py-2 rounded-xl bg-red-50 dark:bg-red-950/20">
            <AlertCircle className="w-3.5 h-3.5 text-error flex-shrink-0 mt-0.5" />
            <p className="text-label-xs text-error">
              {lang === "hi"
                ? "Seller cancel करने पर reliability score -15 होता है"
                : "Seller cancellation costs -15 reliability score"}
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
          <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
            <p className="text-label-xs text-error">
              {lang === "hi"
                ? "Seller cancel करने पर reliability score -15 और buyer को 100% refund"
                : "Cancelling as seller costs you -15 reliability + 100% refund to buyer"}
            </p>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              lang === "hi"
                ? "Reason (required for seller cancel)"
                : "Reason (required for seller cancel)"
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
              Go back
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              className="flex-1"
              onClick={handle}
              loading={loading}
            >
              Confirm Cancel
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Request Payment Modal ──────────────────────────────────────────────────────
function RequestPaymentModal({
  open,
  onClose,
  orderId,
  remainingAmount,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  remainingAmount: number;
  onSuccess: (url: string) => void;
}) {
  const { lang } = useLangStore();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  async function handle() {
    setLoading(true);
    setErr("");
    try {
      const r = await api.post(`/orders/${orderId}/request-payment`);
      onSuccess(r.data.data.paymentLinkUrl);
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Failed to create link");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
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
              {lang === "hi" ? "Payment link भेजें" : "Request Payment"}
            </Dialog.Title>
            <button
              onClick={() => {
                if (!loading) {
                  setErr("");
                  onClose();
                }
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center py-4 mb-4 bg-kridha-secondary dark:bg-kridha-primary/10 rounded-2xl">
            <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
              {lang === "hi"
                ? "Buyer से remaining amount"
                : "Remaining amount from buyer"}
            </p>
            <p className="text-h2 font-bold text-kridha-primary mt-1">
              ₹{remainingAmount.toLocaleString("en-IN")}
            </p>
          </div>
          <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-4">
            {lang === "hi"
              ? "Razorpay payment link create होगा और buyer को notify किया जाएगा। Link 30 min में expire होती है।"
              : "A Razorpay payment link will be created and the buyer will be notified. The link expires in 30 minutes."}
          </p>
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
                  setErr("");
                  onClose();
                }
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={handle}
              loading={loading}
            >
              <CreditCard className="w-4 h-4" />
              Send Link
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── OTP Verify Modal ───────────────────────────────────────────────────────────
function OtpVerifyModal({
  open,
  onClose,
  orderId,
  otpAttempts,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  otpAttempts: number;
  onSuccess: () => void;
}) {
  const { lang } = useLangStore();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const remaining = 3 - otpAttempts;
  async function handle() {
    if (otp.length !== 4) return;
    setLoading(true);
    setErr("");
    try {
      await api.post(`/orders/${orderId}/verify-otp`, { otp });
      onSuccess();
    } catch (e) {
      const ex = e as {
        response?: { data?: { message?: string; code?: string } };
      };
      const msg = ex.response?.data?.message ?? "Wrong OTP";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
          setOtp("");
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
              {lang === "hi" ? "Buyer का OTP enter करें" : "Enter Buyer OTP"}
            </Dialog.Title>
            <button
              onClick={() => {
                if (!loading) {
                  setOtp("");
                  setErr("");
                  onClose();
                }
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
            <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <p className="text-label-xs text-purple-700 dark:text-purple-300">
              {lang === "hi"
                ? "Buyer का OTP पूछें और यहाँ enter करें"
                : "Ask buyer for their OTP and enter it here"}
            </p>
          </div>
          <div className="mb-2">
            <input
              type="number"
              inputMode="numeric"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.slice(0, 4))}
              placeholder="— — — —"
              className="w-full text-center text-3xl font-bold tracking-[0.4em] font-mono py-4 border border-border-DEFAULT dark:border-border-dark rounded-xl bg-[var(--color-surface)] dark:bg-surface-dark text-[var(--color-text)] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          {otpAttempts > 0 && (
            <p className="text-label-xs text-center text-amber-600 dark:text-amber-400 mb-2">
              {remaining}{" "}
              {lang === "hi" ? "attempts बाकी" : "attempts remaining"}
            </p>
          )}
          {err && (
            <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-label-sm text-error">
              {err}
            </div>
          )}
          <div className="flex gap-3 mt-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => {
                if (!loading) {
                  setOtp("");
                  setErr("");
                  onClose();
                }
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={handle}
              loading={loading}
              disabled={otp.length !== 4 || loading}
            >
              <CheckCircle2 className="w-4 h-4" />
              Verify OTP
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function SellerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { lang } = useLangStore();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [payLink, setPayLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery<SubOrderDetail>({
    queryKey: ["order-detail-seller", id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => r.data.data.subOrder),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: 2,
    refetchInterval: (d) => {
      const s = d.state.data?.status;
      return s && !["COMPLETED", "CANCELLED", "DISPUTED"].includes(s)
        ? 20_000
        : false;
    },
  });

  function inv() {
    qc.invalidateQueries({ queryKey: ["order-detail-seller", id] });
    qc.invalidateQueries({ queryKey: ["seller-orders"] });
  }

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
        <Link href="/seller/orders">
          <Button variant="outline">← Back</Button>
        </Link>
      </div>
    );

  const canCancel = ["PENDING", "CONFIRMED"].includes(order.status);
  const canRequestPayment = order.status === "CONFIRMED";
  const canVerifyOtp = order.status === "READY_FOR_OTP_VERIFICATION";
  const activePayLink =
    order.paymentLinkUrl &&
    order.paymentLinkExpiresAt &&
    new Date(order.paymentLinkExpiresAt) > new Date();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <Link
        href="/seller/orders"
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
              Order ID
            </p>
            <h1 className="text-h4 font-bold text-[var(--color-text)]">
              {order.shortId}
            </h1>
          </div>
          <StatusBadge status={order.status} />
        </div>
        {/* Buyer info */}
        <div className="flex items-center gap-3 py-3 border-t border-gray-100 dark:border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center text-kridha-primary font-bold flex-shrink-0">
            {order.buyer.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-label-md text-[var(--color-text)]">
              {order.buyer.name}
            </p>
            <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
              Buyer
            </p>
          </div>
        </div>
        {/* Pickup */}
        <div className="flex items-start gap-2 py-3 border-t border-gray-100 dark:border-gray-800">
          <Clock className="w-4 h-4 text-kridha-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-label-sm font-semibold text-[var(--color-text)]">
              {lang === "hi"
                ? order.pickupWindow.labelHi
                : order.pickupWindow.labelEn}{" "}
              · {order.pickupWindow.startTime}–{order.pickupWindow.endTime}
            </p>
            <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
              {new Date(order.pickupDate).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        {/* OTP attempts warning */}
        {order.otpAttempts > 0 && (
          <div className="flex items-start gap-2 py-3 border-t border-gray-100 dark:border-gray-800">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-label-xs text-amber-700 dark:text-amber-400">
              {order.otpAttempts} wrong OTP attempt
              {order.otpAttempts > 1 ? "s" : ""}. {3 - order.otpAttempts}{" "}
              remaining — 3 wrong → DISPUTED
            </p>
          </div>
        )}
      </div>

      {/* Action cards — contextual */}
      {canRequestPayment && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
          <p className="font-bold text-label-md text-blue-700 dark:text-blue-300 mb-1">
            {lang === "hi"
              ? "Buyer आ गया? Payment request करें"
              : "Buyer arrived? Request payment"}
          </p>
          <p className="text-label-xs text-blue-600 dark:text-blue-400 mb-4">
            {lang === "hi"
              ? `₹${order.remainingAmount.toLocaleString("en-IN")} remaining — Razorpay link भेजें`
              : `₹${order.remainingAmount.toLocaleString("en-IN")} remaining — send a Razorpay payment link`}
          </p>
          {activePayLink && (
            <div className="mb-3 flex items-center gap-2 bg-[var(--color-surface)] dark:bg-surface-dark rounded-xl px-3 py-2 border border-border-DEFAULT dark:border-border-dark">
              <p className="flex-1 text-label-xs text-muted-DEFAULT dark:text-muted-dark truncate">
                {order.paymentLinkUrl}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(order.paymentLinkUrl!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex-shrink-0"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-DEFAULT dark:text-muted-dark" />
                )}
              </button>
            </div>
          )}
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => setPayOpen(true)}
          >
            <CreditCard className="w-4 h-4" />
            {activePayLink
              ? lang === "hi"
                ? "नई Link भेजें"
                : "Send New Link"
              : lang === "hi"
                ? "Payment Request करें"
                : "Request Payment"}
          </Button>
          {activePayLink && order.paymentLinkExpiresAt && (
            <p className="text-center text-label-xs text-muted-DEFAULT dark:text-muted-dark mt-2">
              Expires:{" "}
              {new Date(order.paymentLinkExpiresAt).toLocaleTimeString(
                "en-IN",
                { hour: "2-digit", minute: "2-digit" },
              )}
            </p>
          )}
        </div>
      )}

      {canVerifyOtp && (
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <p className="font-bold text-label-md text-purple-700 dark:text-purple-300">
              {lang === "hi"
                ? "Buyer से OTP लें और verify करें"
                : "Ask buyer for OTP and verify"}
            </p>
          </div>
          <p className="text-label-xs text-purple-600 dark:text-purple-400 mb-4">
            {lang === "hi"
              ? "Payment complete हो गई। Buyer का OTP enter करने पर order COMPLETED होगा।"
              : "Payment done. Enter buyer's OTP to complete the order."}
          </p>
          {order.otpAttempts > 0 && (
            <p className="text-label-xs text-amber-600 dark:text-amber-400 mb-3 font-medium">
              {3 - order.otpAttempts} attempt
              {3 - order.otpAttempts !== 1 ? "s" : ""} remaining before DISPUTED
            </p>
          )}
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full bg-purple-600 hover:bg-purple-700 border-0"
            onClick={() => setOtpOpen(true)}
          >
            <KeyRound className="w-4 h-4" />
            Verify OTP
          </Button>
        </div>
      )}

      {/* Bill / items */}
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-DEFAULT dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/20">
          <p className="text-label-md font-semibold text-[var(--color-text)]">
            {lang === "hi" ? "Order Items" : "Order Items"}
          </p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <div className="px-5 py-2.5 grid grid-cols-[1fr_auto_auto_auto] gap-3 text-label-xs font-semibold text-muted-DEFAULT dark:text-muted-dark uppercase tracking-wide">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Total</span>
          </div>
          {order.orderItems.map((item) => (
            <div
              key={item.productId}
              className="px-5 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center"
            >
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
          ))}
        </div>
        <div className="border-t border-border-DEFAULT dark:border-border-dark px-5 py-4 space-y-2 bg-gray-50/30 dark:bg-gray-800/10">
          <div className="flex justify-between text-label-sm">
            <span className="text-muted-DEFAULT dark:text-muted-dark">
              Platform fee
            </span>
            <span className="text-muted-DEFAULT dark:text-muted-dark">
              ₹{order.platformFee.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between font-bold text-label-md border-t border-gray-100 dark:border-gray-800 pt-2">
            <span>Order Total</span>
            <span className="text-kridha-primary">
              ₹{order.totalAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between text-label-sm">
            <span className="text-muted-DEFAULT dark:text-muted-dark">
              Advance (received)
            </span>
            <span className="text-green-600 dark:text-green-400 font-medium">
              ₹{order.advanceAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between text-label-sm font-semibold">
            <span>Remaining</span>
            <span className="text-orange-600 dark:text-orange-400">
              ₹{order.remainingAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between text-label-sm pt-1 border-t border-gray-100 dark:border-gray-800">
            <span className="text-muted-DEFAULT dark:text-muted-dark">
              {lang === "hi"
                ? "Your payout (after fee)"
                : "Your payout (after fee)"}
            </span>
            <span className="font-bold text-kridha-primary">
              ₹{(order.totalAmount - order.platformFee).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>

      {/* Status timeline */}
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-DEFAULT dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/20">
          <h3 className="text-label-md font-semibold text-[var(--color-text)]">
            Status History
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
                Cancel Order
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
              Cancel Order
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <CancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        orderId={id}
        onSuccess={() => {
          setCancelOpen(false);
          inv();
        }}
      />
      <RequestPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        orderId={id}
        remainingAmount={order.remainingAmount}
        onSuccess={(url) => {
          setPayLink(url);
          setPayOpen(false);
          inv();
        }}
      />
      <OtpVerifyModal
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        orderId={id}
        otpAttempts={order.otpAttempts}
        onSuccess={() => {
          setOtpOpen(false);
          inv();
        }}
      />
    </div>
  );
}
