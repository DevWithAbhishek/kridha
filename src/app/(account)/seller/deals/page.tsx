"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Tag,
  Pencil,
  Trash2,
  X,
  Plus,
  PackageX,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface DealItem {
  id: string;
  productId: string;
  discountPercent: number;
  expiresAt: string;
  status: "ACTIVE" | "EXPIRED";
  product: {
    id: string;
    nameEn: string;
    nameHi: string | null;
    imageUrls: string[];
    available: number;
    priceTiers: { pricePerUnit: number }[];
  };
}
interface DealForm {
  discountPercent: number;
  expiresAt: string;
}

function DealModal({
  open,
  onClose,
  productId,
  deal,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  productId?: string;
  deal?: DealItem;
  onDone: () => void;
}) {
  const { lang } = useLangStore();
  const isEdit = !!deal;
  const pid = deal?.productId ?? productId;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DealForm>({
    defaultValues: deal
      ? {
          discountPercent: deal.discountPercent,
          expiresAt: deal.expiresAt.slice(0, 16),
        }
      : { discountPercent: 10, expiresAt: "" },
  });
  const [err, setErr] = useState("");
  async function onSubmit(data: DealForm) {
    setErr("");
    try {
      if (isEdit) await api.patch(`/products/${pid}/deal`, data);
      else await api.post(`/products/${pid}/deal`, data);
      onDone();
      onClose();
      reset();
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Save failed");
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          setErr("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal z-modal p-6">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-h5 font-bold text-[var(--color-text)]">
              {isEdit
                ? lang === "hi"
                  ? "Deal Edit करें"
                  : "Edit Deal"
                : lang === "hi"
                  ? "Deal Add करें"
                  : "Add Deal"}
            </Dialog.Title>
            <button
              onClick={() => {
                reset();
                setErr("");
                onClose();
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label={lang === "hi" ? "Discount % *" : "Discount % *"}
              type="number"
              {...register("discountPercent", {
                required: true,
                min: 1,
                max: 100,
                valueAsNumber: true,
              })}
              error={errors.discountPercent ? "1-100 required" : undefined}
            />
            <Input
              label={
                lang === "hi" ? "Expiry Date & Time *" : "Expiry Date & Time *"
              }
              type="datetime-local"
              {...register("expiresAt", { required: true })}
              error={errors.expiresAt ? "Required" : undefined}
            />
            {err && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-label-sm text-error">
                {err}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => {
                  reset();
                  setErr("");
                  onClose();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1"
                loading={isSubmitting}
              >
                {isEdit ? "Save Changes" : "Add Deal"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteDealModal({
  open,
  onClose,
  productId,
  productName,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onDone: () => void;
}) {
  const { lang } = useLangStore();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  async function del() {
    setLoading(true);
    setErr("");
    try {
      await api.delete(`/products/${productId}/deal`);
      onDone();
      onClose();
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Delete failed");
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
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal z-modal p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-error" />
            </div>
            <div>
              <p className="font-bold text-label-md text-[var(--color-text)]">
                {lang === "hi" ? "Deal remove करें?" : "Remove deal?"}
              </p>
              <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark truncate max-w-48">
                {productName}
              </p>
            </div>
          </div>
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
                setErr("");
                onClose();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              className="flex-1"
              onClick={del}
              loading={loading}
            >
              {lang === "hi" ? "Remove करें" : "Remove Deal"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const SORT_OPTIONS = [
  { value: "created_desc", en: "Newest", hi: "नया पहले" },
  { value: "created_asc", en: "Oldest", hi: "पुराना पहले" },
  { value: "exp_asc", en: "Expiring soon", hi: "जल्दी expire" },
  { value: "discount_desc", en: "Highest %", hi: "सबसे ज्यादा %" },
];

export default function DealsPage() {
  const { lang } = useLangStore();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "expired"
  >("all");
  const [sort, setSort] = useState("created_desc");
  const [editingDeal, setEditingDeal] = useState<DealItem | null>(null);
  const [deletingDeal, setDeletingDeal] = useState<DealItem | null>(null);

  const { data: deals = [], isLoading } = useQuery<DealItem[]>({
    queryKey: ["deals", statusFilter],
    queryFn: () =>
      api
        .get(`/products/deals/mine?status=${statusFilter}`)
        .then((r) => r.data.data?.deals ?? r.data.data ?? []),
    staleTime: 60_000,
  });

  const sorted = [...deals].sort((a, b) => {
    if (sort === "exp_asc")
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    if (sort === "discount_desc") return b.discountPercent - a.discountPercent;
    if (sort === "created_asc") return 0;
    return 0;
  });

  function inv() {
    qc.invalidateQueries({ queryKey: ["deals"] });
  }

  const now = new Date();
  function isExpired(d: DealItem) {
    return new Date(d.expiresAt) < now;
  }
  function timeLeft(d: DealItem) {
    const ms = new Date(d.expiresAt).getTime() - now.getTime();
    if (ms <= 0) return lang === "hi" ? "Expired" : "Expired";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}d left`;
    return `${h}h ${m}m left`;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-h4 font-bold text-[var(--color-text)]">
            {lang === "hi" ? "Deals" : "Deals"}
          </h2>
          <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-0.5">
            {deals.length} {lang === "hi" ? "deals" : "deals"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5 text-label-xs text-muted-DEFAULT dark:text-muted-dark flex-shrink-0">
          <Filter className="w-3.5 h-3.5" />
          Status:
        </div>
        {(["all", "active", "expired"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-label-sm font-medium transition-all capitalize ${statusFilter === s ? "bg-kridha-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 hover:text-kridha-primary"}`}
          >
            {lang === "hi"
              ? s === "all"
                ? "सभी"
                : s === "active"
                  ? "Active"
                  : "Expired"
              : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <ArrowUpDown className="w-3.5 h-3.5 text-muted-DEFAULT dark:text-muted-dark flex-shrink-0" />
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setSort(o.value)}
            className={`px-3 py-1.5 rounded-lg text-label-sm font-medium transition-all ${sort === o.value ? "bg-kridha-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 hover:text-kridha-primary"}`}
          >
            {lang === "hi" ? o.hi : o.en}
          </button>
        ))}
      </div>

      {isLoading &&
        [...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"
          />
        ))}
      {!isLoading && deals.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <Tag className="w-10 h-10 text-muted-DEFAULT dark:text-muted-dark" />
          <p className="text-label-md font-semibold text-[var(--color-text)]">
            {lang === "hi" ? "कोई deals नहीं" : "No deals found"}
          </p>
        </div>
      )}

      {!isLoading &&
        sorted.map((d) => {
          const exp = isExpired(d) || d.status === "EXPIRED";
          const minPrice = d.product.priceTiers[0]?.pricePerUnit ?? 0;
          return (
            <div
              key={d.id}
              className={`bg-[var(--color-surface)] dark:bg-surface-dark border rounded-2xl overflow-hidden transition-colors ${exp ? "border-gray-200 dark:border-gray-700 opacity-75" : "border-border-DEFAULT dark:border-border-dark hover:border-kridha-primary/40"}`}
            >
              <div className="flex gap-4 px-5 py-4 items-center">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-border-DEFAULT dark:border-border-dark flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                  {d.product.imageUrls?.[0] ? (
                    <Image
                      src={d.product.imageUrls[0]}
                      alt={d.product.nameEn}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <PackageX className="w-6 h-6 m-auto mt-4 text-muted-DEFAULT dark:text-muted-dark" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-label-md text-[var(--color-text)] truncate">
                    {lang === "hi"
                      ? (d.product.nameHi ?? d.product.nameEn)
                      : d.product.nameEn}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-kridha-primary text-white">
                      {d.discountPercent}% OFF
                    </span>
                    {minPrice > 0 && (
                      <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                        ₹{(minPrice * (1 - d.discountPercent / 100)).toFixed(0)}
                        <span className="line-through ml-1 opacity-60">
                          ₹{minPrice}
                        </span>
                      </span>
                    )}
                    <span
                      className={`text-label-xs font-medium ${exp ? "text-error" : "text-kridha-primary"}`}
                    >
                      {timeLeft(d)}
                    </span>
                  </div>
                  <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mt-0.5">
                    Expires:{" "}
                    {new Date(d.expiresAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {!exp && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setEditingDeal(d)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-DEFAULT dark:border-border-dark text-muted-DEFAULT hover:border-kridha-primary hover:text-kridha-primary hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingDeal(d)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-DEFAULT dark:border-border-dark text-muted-DEFAULT hover:border-red-400 hover:text-error hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {exp && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 flex-shrink-0">
                    {lang === "hi" ? "Expired" : "Expired"}
                  </span>
                )}
              </div>
            </div>
          );
        })}

      {editingDeal && (
        <DealModal
          open={!!editingDeal}
          deal={editingDeal}
          onClose={() => setEditingDeal(null)}
          onDone={() => {
            inv();
            setEditingDeal(null);
          }}
        />
      )}
      {deletingDeal && (
        <DeleteDealModal
          open={!!deletingDeal}
          productId={deletingDeal.productId}
          productName={deletingDeal.product.nameEn}
          onClose={() => setDeletingDeal(null)}
          onDone={() => {
            inv();
            setDeletingDeal(null);
          }}
        />
      )}
    </div>
  );
}
