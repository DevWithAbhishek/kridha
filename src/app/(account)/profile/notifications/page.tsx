"use client";
// src/app/(buyer)/notifications/page.tsx
// Notifications: inline expand (no navigation), mark read on expand,
// mark-all-read, delete, filter all/unread/read, pagination.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import type { Notification } from "@/types/dashboard";
import Link from "next/link";

const NOTIF_EMOJI: Record<string, string> = {
  ORDER_PLACED: "📦",
  ORDER_CONFIRMED: "✅",
  ORDER_COMPLETED: "🎉",
  ORDER_CANCELLED: "❌",
  READY_FOR_PICKUP: "🔔",
  AWAITING_PAYMENT: "💳",
  REFUND_INITIATED: "💰",
  NO_SHOW_PENALTY: "⚠️",
  DISPUTE_RAISED: "⚖️",
  NEW_ORDER: "🛒",
  FLAGGED_BUYER: "🚩",
  DEAL_EXPIRED: "⏰",
};

interface NotifData {
  notifications: Notification[];
  unreadCount: number;
  meta: { total: number; hasMore: boolean; page: number };
}

export default function NotificationsPage() {
  const { lang } = useLangStore();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<NotifData>({
    queryKey: ["notifications", filter, page],
    queryFn: () => {
      const p = new URLSearchParams({
        page: String(page),
        limit: "20",
        sortBy: "created_desc",
      });
      if (filter !== "all") p.set("status", filter.toUpperCase());
      return api.get(`/notifications?${p}`).then((r) => ({
        notifications: r.data.data ?? [],
        unreadCount: r.data.unreadCount ?? 0,
        meta: r.data.meta ?? { total: 0, hasMore: false, page: 1 },
      }));
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    gcTime: 5 * 60_000,
  });

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAllRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const deleteNotif = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  function toggle(n: Notification) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(n.id)) {
        next.delete(n.id);
      } else {
        next.add(n.id);
        if (!n.read) markRead.mutate(n.id);
      }
      return next;
    });
  }

  const FILTERS: { k: "all" | "unread" | "read"; en: string; hi: string }[] = [
    { k: "all", en: "All", hi: "सभी" },
    { k: "unread", en: "Unread", hi: "Unread" },
    { k: "read", en: "Read", hi: "Read" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-h4 font-bold text-[var(--color-text)]">
            {lang === "hi" ? "Notifications" : "Notifications"}
          </h1>
          {unread > 0 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-kridha-primary text-white">
              {unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
          >
            <CheckCheck className="w-4 h-4" />
            {lang === "hi" ? "सभी read" : "Mark all read"}
          </Button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-DEFAULT dark:text-muted-dark flex-shrink-0" />
        {FILTERS.map((f) => (
          <button
            key={f.k}
            onClick={() => {
              setFilter(f.k);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-label-sm font-medium transition-all ${filter === f.k ? "bg-kridha-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 hover:text-kridha-primary"}`}
          >
            {lang === "hi" ? f.hi : f.en}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && notifications.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <Bell className="w-10 h-10 text-muted-DEFAULT dark:text-muted-dark" />
          <p className="text-label-md font-semibold text-[var(--color-text)]">
            {lang === "hi" ? "कोई notification नहीं" : "No notifications"}
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {notifications.map((n) => {
          const isExp = expanded.has(n.id);
          const emoji = NOTIF_EMOJI[n.type] ?? "🔔";
          return (
            <div
              key={n.id}
              className={`bg-[var(--color-surface)] dark:bg-surface-dark border rounded-2xl overflow-hidden transition-all ${!n.read ? "border-kridha-primary/30 dark:border-kridha-primary/30" : "border-border-DEFAULT dark:border-border-dark"}`}
            >
              {/* Collapsed header */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                {/* Emoji + unread dot */}
                <div className="relative mt-0.5 flex-shrink-0">
                  <span className="text-lg leading-none">{emoji}</span>
                  {!n.read && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-kridha-primary border border-[var(--color-surface)] dark:border-surface-dark" />
                  )}
                </div>

                {/* Content */}
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => toggle(n)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-label-sm leading-snug ${!n.read ? "font-semibold text-[var(--color-text)]" : "font-medium text-muted-DEFAULT dark:text-muted-dark"}`}
                    >
                      {n.title}
                    </p>
                    <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark flex-shrink-0 mt-0.5">
                      {new Date(n.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p
                    className={`text-label-xs mt-0.5 leading-relaxed ${isExp ? "text-[var(--color-text)]" : "text-muted-DEFAULT dark:text-muted-dark line-clamp-1"}`}
                  >
                    {n.body}
                  </p>
                </button>

                {/* Icon buttons */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggle(n)}
                    className="p-1.5 rounded-lg text-muted-DEFAULT hover:text-kridha-primary hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-all"
                    aria-label={isExp ? "Collapse" : "Expand"}
                  >
                    {isExp ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteNotif.mutate(n.id)}
                    className="p-1.5 rounded-lg text-muted-DEFAULT hover:text-error hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExp && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-label-sm text-[var(--color-text)] leading-relaxed pt-3">
                    {n.body}
                  </p>
                  <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mt-2">
                    {new Date(n.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {n.subOrderId && (
                    <Link
                      href={`/orders/${n.subOrderId}`}
                      className="inline-flex items-center gap-1 mt-2 text-label-xs text-kridha-primary hover:underline font-medium"
                    >
                      View Order →
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
