"use client";
// src/app/(buyer)/orders/page.tsx
// Buyer orders list — filter by status, sort by date/price, pagination

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Filter,
  ArrowUpDown,
  MapPin,
  Clock,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import type { OrderStatus } from "@/types/dashboard";

const STATUS_CONFIG = {
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

function StatusPill({ status }: { status: OrderStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const { lang } = useLangStore();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${c.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {lang === "hi" ? c.lH : c.l}
    </span>
  );
}

interface SubOrderListItem {
  id: string;
  shortId: string;
  orderId: string;
  status: OrderStatus;
  totalAmount: number;
  advanceAmount: number;
  pickupDate: string;
  pickupWindow: {
    labelEn: string;
    labelHi: string;
    startTime: string;
    endTime: string;
  };
  orderItems: { productNameEn: string; quantity: number }[];
  seller: { storeName: string };
  createdAt: string;
}

const ALL_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "AWAITING_PAYMENT",
  "READY_FOR_OTP_VERIFICATION",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
];

export default function BuyerOrdersPage() {
  const { lang } = useLangStore();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [sortBy, setSortBy] = useState<
    "created_desc" | "created_asc" | "price_desc" | "price_asc"
  >("created_desc");
  const [page, setPage] = useState(1);

  const apiSortBy = sortBy.startsWith("price") ? "created_desc" : sortBy; // price sort: client-side

  const { data, isLoading } = useQuery<{
    orders: SubOrderListItem[];
    meta: { total: number; hasMore: boolean };
  }>({
    queryKey: ["buyer-orders", statusFilter, apiSortBy, page],
    queryFn: () => {
      const p = new URLSearchParams({
        page: String(page),
        limit: "20",
        sortBy: apiSortBy,
      });
      if (statusFilter) p.set("status", statusFilter);
      return api
        .get(`/orders?${p}`)
        .then((r) => ({
          orders: r.data.data ?? [],
          meta: r.data.meta ?? { total: 0, hasMore: false },
        }));
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
  const orders = [...(data?.orders ?? [])].sort((a, b) => {
    if (sortBy === "price_desc") return b.totalAmount - a.totalAmount;
    if (sortBy === "price_asc") return a.totalAmount - b.totalAmount;
    return 0;
  });

  const SORT_OPTS = [
    { v: "created_desc", l: "Newest", lH: "नया पहले" },
    { v: "created_asc", l: "Oldest", lH: "पुराना पहले" },
    { v: "price_desc", l: "Price ↓", lH: "ज्यादा ₹" },
    { v: "price_asc", l: "Price ↑", lH: "कम ₹" },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-h4 font-bold text-[var(--color-text)]">
            {lang === "hi" ? "मेरे Orders" : "My Orders"}
          </h1>
          {!isLoading && (
            <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-0.5">
              {data?.meta?.total ?? 0} {lang === "hi" ? "orders" : "orders"}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl px-4 py-3 space-y-3">
        {/* Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-label-xs text-muted-DEFAULT dark:text-muted-dark flex-shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort:
          </span>
          {SORT_OPTS.map((opt) => (
            <button
              key={opt.v}
              onClick={() => {
                setSortBy(opt.v as typeof sortBy);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-label-xs font-semibold transition-all border ${sortBy === opt.v ? "bg-kridha-primary text-white border-kridha-primary" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark border-transparent hover:border-kridha-primary/40"}`}
            >
              {lang === "hi" ? opt.lH : opt.l}
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-label-xs text-muted-DEFAULT dark:text-muted-dark flex-shrink-0">
            <Filter className="w-3.5 h-3.5" />
            Status:
          </span>
          <button
            onClick={() => {
              setStatusFilter("");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-label-xs font-semibold transition-all border ${!statusFilter ? "bg-kridha-primary text-white border-kridha-primary" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark border-transparent"}`}
          >
            {lang === "hi" ? "सभी" : "All"}
          </button>
          {ALL_STATUSES.map((s) => {
            const c = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-label-xs font-semibold transition-all border ${statusFilter === s ? "bg-kridha-primary text-white border-kridha-primary" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark border-transparent"}`}
              >
                {lang === "hi" ? c.lH : c.l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && orders.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <Package className="w-12 h-12 text-muted-DEFAULT dark:text-muted-dark" />
          <p className="text-label-lg font-semibold text-[var(--color-text)]">
            {lang === "hi" ? "कोई order नहीं" : "No orders found"}
          </p>
        </div>
      )}

      {/* Order cards */}
      <div className="space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/profile/orders/${order.id}`}
            className="block group"
          >
            <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-4 hover:border-kridha-primary/50 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-label-md text-[var(--color-text)]">
                      {order.shortId}
                    </span>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                    {order.seller?.storeName}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-DEFAULT dark:text-muted-dark flex-shrink-0 mt-1 group-hover:text-kridha-primary transition-colors" />
              </div>

              {/* Items preview */}
              <div className="flex flex-wrap gap-1 mb-3">
                {order.orderItems?.slice(0, 3).map((item, i) => (
                  <span
                    key={i}
                    className="text-label-xs bg-gray-100 dark:bg-gray-800 text-[var(--color-text)] px-2 py-1 rounded-lg"
                  >
                    {item.productNameEn} ×{item.quantity}
                  </span>
                ))}
                {(order.orderItems?.length ?? 0) > 3 && (
                  <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark px-2 py-1">
                    +{order.orderItems.length - 3} more
                  </span>
                )}
              </div>

              {/* Footer row */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(order.pickupDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {order.pickupWindow?.startTime}–
                  {order.pickupWindow?.endTime}
                </span>
                <span className="font-bold text-label-md text-kridha-primary">
                  ₹{order.totalAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {data?.meta && (data.meta.hasMore || page > 1) && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-border-DEFAULT dark:border-border-dark text-label-sm font-medium text-[var(--color-text)] disabled:opacity-40 hover:border-kridha-primary hover:text-kridha-primary transition-colors"
          >
            ← {lang === "hi" ? "पिछला" : "Prev"}
          </button>
          <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
            Page {page}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.meta.hasMore}
            className="px-4 py-2 rounded-xl border border-border-DEFAULT dark:border-border-dark text-label-sm font-medium text-[var(--color-text)] disabled:opacity-40 hover:border-kridha-primary hover:text-kridha-primary transition-colors"
          >
            {lang === "hi" ? "अगला" : "Next"} →
          </button>
        </div>
      )}
    </div>
  );
}
