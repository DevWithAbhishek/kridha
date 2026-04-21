"use client";
// src/app/(buyer)/saved/page.tsx
// Favourites AND Saved-for-later — single page, tab toggle via ?type= param
// Sort by date added. Remove modal. Move to cart option on saved-for-later.

import { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Heart,
  Bookmark,
  Trash2,
  ShoppingCart,
  Tag,
  MapPin,
  Star,
  Package2,
  X,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import type { SavedProduct, SaveType } from "@/types/dashboard";

// ── Remove Confirm Modal ──────────────────────────────────────────────────────
function RemoveModal({
  open,
  onClose,
  savedId,
  productName,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  savedId: string;
  productName: string;
  onConfirm: () => void;
  loading: boolean;
}) {
  const { lang } = useLangStore();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
        <Dialog.Content className="fixed bottom-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-sm bg-[var(--color-surface)] dark:bg-surface-dark rounded-t-2xl sm:rounded-modal shadow-modal z-modal p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-error" />
            </div>
            <div>
              <p className="font-bold text-label-md text-[var(--color-text)]">
                {lang === "hi" ? "Remove करें?" : "Remove item?"}
              </p>
              <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark truncate max-w-48">
                {productName}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              {lang === "hi" ? "रखें" : "Keep it"}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              className="flex-1"
              onClick={onConfirm}
              loading={loading}
            >
              {lang === "hi" ? "Remove करें" : "Remove"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function SavedCard({
  saved,
  onRemove,
  onMoveToCart,
  removing,
}: {
  saved: SavedProduct;
  onRemove: (id: string, name: string) => void;
  onMoveToCart?: (saved: SavedProduct) => void;
  removing: boolean;
}) {
  const { lang } = useLangStore();
  const p = saved.product;
  const minPrice = p.priceTiers?.length
    ? Math.min(...p.priceTiers.map((t) => t.pricePerUnit))
    : 0;
  const deal = p.deals?.[0];
  const discounted = deal
    ? Math.round(minPrice * (1 - deal.discountPercent / 100))
    : null;
  const name = lang === "hi" ? (p.nameHi ?? p.nameEn) : p.nameEn;
  const stars = p.seller?.sellerRating ?? 0;

  return (
    <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden hover:border-kridha-primary/40 hover:shadow-md transition-all flex flex-col h-full group">
      {/* Image */}
      <Link href={`/products/${p.id}`} className="block">
        <div className="relative w-full aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
          {p.imageUrls?.[0] ? (
            <Image
              src={p.imageUrls[0]}
              alt={name}
              fill
              sizes="(max-width:640px)50vw,(max-width:1024px)33vw,25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Package2 className="w-8 h-8 text-muted-DEFAULT dark:text-muted-dark" />
            </div>
          )}
          {deal && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[11px] font-bold px-2 py-1 rounded-lg">
              <Tag className="w-2.5 h-2.5" />
              {deal.discountPercent}% OFF
            </div>
          )}
          {p.available === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white/90 text-gray-800 text-label-xs font-bold px-3 py-1 rounded-full">
                Out of Stock
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mb-0.5 capitalize">
          {p.category?.toLowerCase()}
        </p>
        <Link href={`/products/${p.id}`}>
          <h3 className="font-semibold text-label-md text-[var(--color-text)] line-clamp-2 hover:text-kridha-primary transition-colors">
            {name}
          </h3>
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mt-auto pt-2">
          <span className="text-label-lg font-bold text-kridha-primary">
            ₹{(discounted ?? minPrice).toLocaleString("en-IN")}
          </span>
          {discounted && (
            <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark line-through">
              ₹{minPrice.toLocaleString("en-IN")}
            </span>
          )}
          <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
            /{p.unit?.toLowerCase()}
          </span>
        </div>

        {/* Seller + rating */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark truncate">
            {p.seller?.storeName ?? p.city}
          </p>
          {stars > 0 && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <span className="text-amber-400 text-[11px]">★</span>
              <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                {stars.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Date added */}
        <p className="text-[10px] text-muted-DEFAULT dark:text-muted-dark mt-1">
          {lang === "hi" ? "जोड़ा" : "Added"}:{" "}
          {new Date(saved.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          {onMoveToCart && p.available > 0 && (
            <button
              onClick={() => onMoveToCart(saved)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-kridha-primary text-white text-label-xs font-semibold hover:bg-kridha-primary-hover transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {lang === "hi" ? "Cart" : "Add to Cart"}
            </button>
          )}
          <button
            onClick={() => onRemove(saved.id, name)}
            disabled={removing}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-error hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-label-xs flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-700" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/5 mt-2" />
      </div>
    </div>
  );
}

function SavedContent() {
  const { lang } = useLangStore();
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const activeType = (params.get("type") as SaveType | null) ?? "FAVOURITE";
  const [removingItem, setRemovingItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [sort, setSort] = useState<"desc" | "asc">("desc");

  const { data, isLoading } = useQuery<{
    saved: SavedProduct[];
    meta: { total: number; hasMore: boolean };
  }>({
    queryKey: ["saved", activeType, sort],
    queryFn: () =>
      api
        .get(`/saved?type=${activeType}&limit=50&page=1`)
        .then((r) => r.data.data),
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => api.delete(`/saved/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved"] });
      setRemovingItem(null);
    },
  });

  const moveToCart = useMutation({
    mutationFn: (saved: SavedProduct) =>
      Promise.all([
        api.delete(`/saved/${saved.id}`),
        api.post("/cart", {
          productId: saved.productId,
          quantity: saved.product.minOrderQuantity ?? 1,
          pickupWindowId: "",
          pickupDate: "",
        }),
      ]).catch(() => api.delete(`/saved/${saved.id}`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved"] });
      qc.invalidateQueries({ queryKey: ["cart"] });
      router.push("/cart");
    },
  });

  const items = [...(data?.saved ?? [])].sort((a, b) =>
    sort === "desc"
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const total = data?.meta?.total ?? 0;
  const isFav = activeType === "FAVOURITE";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header + tabs */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-h4 font-bold text-[var(--color-text)]">
            {isFav
              ? lang === "hi"
                ? "Favourites"
                : "Favourites"
              : lang === "hi"
                ? "Saved for Later"
                : "Saved for Later"}
          </h1>
          {!isLoading && (
            <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-0.5">
              {total} {lang === "hi" ? "items" : "items"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Tab toggle */}
          <div className="flex rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
            {(["FAVOURITE", "SAVED_FOR_LATER"] as const).map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/saved?type=${t}`)}
                className={`flex items-center gap-1.5 px-3 py-2 text-label-sm font-medium transition-colors ${activeType === t ? "bg-kridha-primary text-white" : "text-muted-DEFAULT dark:text-muted-dark hover:bg-gray-50 dark:hover:bg-gray-800"}`}
              >
                {t === "FAVOURITE" ? (
                  <Heart className="w-3.5 h-3.5" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
                {lang === "hi"
                  ? t === "FAVOURITE"
                    ? "Favourites"
                    : "Saved"
                  : t === "FAVOURITE"
                    ? "Favourites"
                    : "Saved"}
              </button>
            ))}
          </div>
          {/* Sort */}
          <button
            onClick={() => setSort((s) => (s === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-DEFAULT dark:border-border-dark text-label-sm text-muted-DEFAULT dark:text-muted-dark hover:border-kridha-primary hover:text-kridha-primary transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sort === "desc"
              ? lang === "hi"
                ? "Newest"
                : "Newest"
              : lang === "hi"
                ? "Oldest"
                : "Oldest"}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center text-kridha-primary">
            {isFav ? (
              <Heart className="w-8 h-8" />
            ) : (
              <Bookmark className="w-8 h-8" />
            )}
          </div>
          <p className="text-h5 font-bold text-[var(--color-text)]">
            {lang === "hi"
              ? isFav
                ? "कोई favourite नहीं"
                : "कुछ saved नहीं"
              : isFav
                ? "No favourites yet"
                : "Nothing saved yet"}
          </p>
          <Link href="/products">
            <Button variant="primary">
              {lang === "hi" ? "Products देखें" : "Browse Products"}
            </Button>
          </Link>
        </div>
      )}

      {/* Grid */}
      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((s) => (
            <SavedCard
              key={s.id}
              saved={s}
              onRemove={(id, name) => setRemovingItem({ id, name })}
              onMoveToCart={
                !isFav ? (saved) => moveToCart.mutate(saved) : undefined
              }
              removing={removeItem.isPending && removingItem?.id === s.id}
            />
          ))}
        </div>
      )}

      {removingItem && (
        <RemoveModal
          open={!!removingItem}
          onClose={() => setRemovingItem(null)}
          savedId={removingItem.id}
          productName={removingItem.name}
          onConfirm={() => removeItem.mutate(removingItem.id)}
          loading={removeItem.isPending}
        />
      )}
    </div>
  );
}

export default function SavedPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse"
            />
          ))}
        </div>
      }
    >
      <SavedContent />
    </Suspense>
  );
}
