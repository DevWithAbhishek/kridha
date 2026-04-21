"use client";
// Seller orders page — filter by status, sort by date/amount, link to detail
// API: GET /api/orders?status=&sortBy=&page=

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Package, ChevronRight, ArrowUpDown, Filter } from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import type { SubOrder, OrderStatus } from "@/types/dashboard";
// import { SubOrder, OrderStatus } from "@prisma/client";

const STATUS_CFG: Record<
  string,
  { en: string; hi: string; cls: string; dot: string }
> = {
  PENDING: {
    en: "Pending",
    hi: "Pending",
    cls: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700",
    dot: "bg-gray-400",
  },
  CONFIRMED: {
    en: "Confirmed",
    hi: "Confirmed",
    cls: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  AWAITING_PAYMENT: {
    en: "Awaiting Payment",
    hi: "Payment Pending",
    cls: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  READY_FOR_OTP_VERIFICATION: {
    en: "Ready for OTP",
    hi: "OTP Verify",
    cls: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
  },
  COMPLETED: {
    en: "Completed",
    hi: "Completed",
    cls: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    dot: "bg-green-500",
  },
  CANCELLED: {
    en: "Cancelled",
    hi: "Cancel",
    cls: "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    dot: "bg-red-500",
  },
  DISPUTED: {
    en: "Disputed",
    hi: "Disputed",
    cls: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
  },
};
function OrderBadge({ status }: { status: string }) {
  const { lang } = useLangStore();
  const c = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${c.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {lang === "hi" ? c.hi : c.en}
    </span>
  );
}

const ALL_STATUSES = Object.keys(STATUS_CFG) as OrderStatus[];
const SORT_OPTIONS = [
  { value: "created_desc", en: "Newest first", hi: "नया पहले" },
  { value: "created_asc", en: "Oldest first", hi: "पुराना पहले" },
];

export default function SellerOrdersPage() {
  const { lang } = useLangStore();
  const [status, setStatus] = useState<string>("");
  const [sort, setSort] = useState("created_desc");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    subOrders: SubOrder[];
    meta: { total: number; hasMore: boolean; page: number };
  }>({
    queryKey: ["orders", "seller", status, sort, page],
    queryFn: () => {
      const p = new URLSearchParams({
        sortBy: sort,
        page: String(page),
        limit: "20",
      });
      if (status) p.set("status", status);
      return api.get(`/orders?${p}`).then((r) => r.data.data);
    },
    staleTime: 30_000,
    refetchInterval: (q) => {
      const d = q.state.data as { subOrders: SubOrder[] } | undefined;
      return d?.subOrders?.some(
        (o) => o.status === "PENDING" || o.status === "CONFIRMED",
      )
        ? 30_000
        : false;
    },
  });

  const orders = data?.subOrders ?? [];
  const meta = data?.meta;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-h4 font-bold text-[var(--color-text)]">
            {lang === "hi" ? "मेरे Orders" : "My Orders"}
          </h2>
          {!isLoading && (
            <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-0.5">
              {meta?.total ?? 0}{" "}
              {lang === "hi" ? "orders total" : "orders total"}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5 text-label-xs text-muted-DEFAULT dark:text-muted-dark flex-shrink-0">
          <Filter className="w-3.5 h-3.5" />
          Status:
        </div>
        <button
          onClick={() => {
            setStatus("");
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-label-sm font-medium transition-all ${!status ? "bg-kridha-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 hover:text-kridha-primary"}`}
        >
          {lang === "hi" ? "सभी" : "All"}
        </button>
        {ALL_STATUSES.map((s) => {
          const c = STATUS_CFG[s];
          return (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-label-sm font-medium transition-all ${status === s ? "bg-kridha-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 hover:text-kridha-primary"}`}
            >
              {lang === "hi" ? c.hi : c.en}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-3.5 h-3.5 text-muted-DEFAULT dark:text-muted-dark flex-shrink-0" />
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => {
              setSort(o.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-label-sm font-medium transition-all ${sort === o.value ? "bg-kridha-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 hover:text-kridha-primary"}`}
          >
            {lang === "hi" ? o.hi : o.en}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading &&
        [...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"
          />
        ))}

      {/* Empty */}
      {!isLoading && orders.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <Package className="w-10 h-10 text-muted-DEFAULT dark:text-muted-dark" />
          <p className="text-label-md font-semibold text-[var(--color-text)]">
            {lang === "hi" ? "कोई orders नहीं" : "No orders found"}
          </p>
        </div>
      )}

      {/* List */}
      {!isLoading &&
        orders.map((o) => (
          <Link key={o.id} href={`/seller/orders/${o.id}`} className="block">
            <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl px-5 py-4 hover:border-kridha-primary/50 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-label-md text-[var(--color-text)]">
                      #{o.shortId}
                    </span>
                    <OrderBadge status={o.status} />
                  </div>
                  {o.orderItems?.slice(0, 2).map((item) => (
                    <p
                      key={item.id}
                      className="text-label-sm text-muted-DEFAULT dark:text-muted-dark truncate"
                    >
                      {item.product.nameEn} × {item.quantity}
                    </p>
                  ))}
                  {(o.orderItems?.length ?? 0) > 2 && (
                    <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                      +{o.orderItems.length - 2} more
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                                    <span className="text-label-sm text-[var(--color-text)] font-semibold">₹{o.totalAmount.toLocaleString('en-IN')}</span>
                                    {o.pickupWindow && <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">{lang === 'hi' ? o.pickupWindow.labelHi : o.pickupWindow.labelEn} · {o.pickupWindow.startTime}–{o.pickupWindow.endTime}</span>}
                                    <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                  {o.buyer && (
                    <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mt-1">
                      {lang === "hi" ? "Buyer:" : "Buyer:"} {o.buyer.name}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-DEFAULT dark:text-muted-dark flex-shrink-0 mt-1" />
              </div>
            </div>
          </Link>
        ))}

      {/* Pagination */}
      {meta && (meta.page > 1 || meta.hasMore) && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-border-DEFAULT dark:border-border-dark text-label-sm font-medium text-[var(--color-text)] disabled:opacity-40 hover:border-kridha-primary hover:text-kridha-primary transition-colors"
          >
            {lang === "hi" ? "← पिछला" : "← Prev"}
          </button>
          <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
            {lang === "hi" ? `Page ${page}` : `Page ${page}`}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!meta.hasMore}
            className="px-4 py-2 rounded-xl border border-border-DEFAULT dark:border-border-dark text-label-sm font-medium text-[var(--color-text)] disabled:opacity-40 hover:border-kridha-primary hover:text-kridha-primary transition-colors"
          >
            {lang === "hi" ? "अगला →" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}
