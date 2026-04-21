"use client";

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

const NOTIF_ICONS: Record<string, string> = {
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

export default function NotificationsPage() {
  const { lang } = useLangStore();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    notifications: Notification[];
    unreadCount: number;
    meta: { total: number; hasMore: boolean };
  }>({
    queryKey: ["notifications", filter, page],
    queryFn: () => {
      const p = new URLSearchParams({
        page: String(page),
        limit: "20",
        sortBy: "created_desc",
      });
      if (filter !== "all") p.set("status", filter.toUpperCase());
      return api.get(`/notifications?${p}`).then((r) => r.data.data);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const notifs = data?.notifications ?? [];
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

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function handleExpand(n: Notification) {
    toggle(n.id);
    if (!n.read) markRead.mutate(n.id);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-h4 font-bold text-[var(--color-text)]">
            {lang === "hi" ? "Notifications" : "Notifications"}
          </h2>
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
            {lang === "hi" ? "सभी read करें" : "Mark all read"}
          </Button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-DEFAULT dark:text-muted-dark flex-shrink-0" />
        {(["all", "unread", "read"] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-label-sm font-medium transition-all capitalize ${filter === f ? "bg-kridha-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 hover:text-kridha-primary"}`}
          >
            {lang === "hi"
              ? f === "all"
                ? "सभी"
                : f === "unread"
                  ? "Unread"
                  : "Read"
              : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading &&
        [...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"
          />
        ))}
      {!isLoading && notifs.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <Bell className="w-10 h-10 text-muted-DEFAULT dark:text-muted-dark" />
          <p className="text-label-md font-semibold text-[var(--color-text)]">
            {lang === "hi" ? "कोई notifications नहीं" : "No notifications"}
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {notifs.map((n) => {
          const isExp = expanded.has(n.id);
          const icon = NOTIF_ICONS[n.type] ?? "🔔";
          return (
            <div
              key={n.id}
              className={`bg-[var(--color-surface)] dark:bg-surface-dark border rounded-2xl overflow-hidden transition-all ${!n.read ? "border-kridha-primary/30 dark:border-kridha-primary/30" : "border-border-DEFAULT dark:border-border-dark"}`}
            >
              {/* Header row */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                {/* Unread dot */}
                <div className="relative mt-1 flex-shrink-0">
                  <span className="text-lg leading-none">{icon}</span>
                  {!n.read && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-kridha-primary border border-[var(--color-surface)] dark:border-surface-dark" />
                  )}
                </div>

                {/* Content */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleExpand(n)}
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
                    className={`text-label-xs mt-0.5 leading-relaxed transition-all ${isExp ? "text-[var(--color-text)] line-clamp-none" : "text-muted-DEFAULT dark:text-muted-dark line-clamp-1"}`}
                  >
                    {n.body}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleExpand(n)}
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
                    onClick={() => deleteNotif.mutate(n.id)}
                    className="p-1.5 rounded-lg text-muted-DEFAULT hover:text-error hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded body */}
              {isExp && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-800 mt-0">
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
            {lang === "hi" ? "← पिछला" : "← Prev"}
          </button>
          <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
            {lang === "hi" ? `Page ${page}` : `Page ${page}`}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.meta.hasMore}
            className="px-4 py-2 rounded-xl border border-border-DEFAULT dark:border-border-dark text-label-sm font-medium text-[var(--color-text)] disabled:opacity-40 hover:border-kridha-primary hover:text-kridha-primary transition-colors"
          >
            {lang === "hi" ? "अगला →" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}
