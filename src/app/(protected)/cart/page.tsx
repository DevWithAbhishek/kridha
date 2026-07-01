"use client";
// src/app/(buyer)/cart/page.tsx
// E-commerce cart: items grouped by seller, qty stepper, save for later, add to favorites, delete modal

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  Heart,
  BookmarkPlus,
  Plus,
  Minus,
  ShoppingCart,
  PackageX,
  MapPin,
  Clock,
  AlertCircle,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import type { CartItem } from "@/types/dashboard";

  function calcAdvance(total: number) {
    return Math.min(500, Math.max(100, Math.round(total * 0.05)));
  }

interface CartData {
  id: string;
  expiresAt: string;
  items: CartItem[];
  summary: { totalItems: number; totalAmount: number; sellerCount: number };
}

// ── Delete confirm modal ───────────────────────────────────────────────────
function DeleteItemModal({
  open,
  onClose,
  productName,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  productName: string;
  onConfirm: () => void;
  loading: boolean;
}) {
  const { lang } = useLangStore();
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
        <Dialog.Content className="fixed bottom-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-sm bg-[var(--color-surface)] dark:bg-surface-dark rounded-t-2xl sm:rounded-modal shadow-modal z-modal p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-error" />
            </div>
            <div>
              <Dialog.Title className="font-bold text-label-md text-[var(--color-text)]">
                {lang === "hi" ? "Cart से हटाएं?" : "Remove from cart?"}
              </Dialog.Title>
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
              {lang === "hi" ? "रहने दें" : "Keep it"}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              className="flex-1"
              onClick={onConfirm}
              loading={loading}
            >
              {lang === "hi" ? "हटाएं" : "Remove"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function CartSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(2)].map((_, i) => (
        <div
          key={i}
          className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden"
        >
          <div className="h-12 bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="p-5 space-y-4">
            {[...Array(2)].map((_, j) => (
              <div key={j} className="flex gap-4">
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function CartPage() {
  const { lang } = useLangStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [deletingItem, setDeletingItem] = useState<CartItem | null>(null);

  const { data: cart, isLoading } = useQuery<CartData>({
    queryKey: ["cart"],
    queryFn: () => api.get("/cart").then((r) => r.data.data.cart),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateQty = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.patch(`/cart/${id}`, { quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => api.delete(`/cart/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      setDeletingItem(null);
    },
  });

  const saveForLater = useMutation({
    mutationFn: ({
      itemId,
      productId,
    }: {
      itemId: string;
      productId: string;
    }) =>
      Promise.all([
        api.delete(`/cart/${itemId}`),
        api.post("/saved", { productId, type: "SAVED_FOR_LATER" }),
      ]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const addToFavorites = useMutation({
    mutationFn: (productId: string) =>
      api.post("/saved", { productId, type: "FAVOURITE" }),
    onSuccess: () => {},
  });

  // ── Group by seller ───────────────────────────────────────────────────────
  const groups = useMemo(() => {
    if (!cart?.items.length) return [];
    const map = new Map<
      string,
      { sellerName: string; city: string; items: CartItem[] }
    >();
    for (const item of cart.items) {
      const key = item.product.seller.storeName;
      if (!map.has(key))
        map.set(key, {
          sellerName: item.product.seller.storeName,
          city: item.product.seller.city,
          items: [],
        });
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values());
  }, [cart]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalAmount = cart?.items.reduce((s, i) => s + i.subTotal, 0) ?? 0;
  const totalItems = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  const advance = groups.reduce(
    (sum, group) =>
      sum + calcAdvance(group.items.reduce((s, item) => s + item.subTotal, 0)),
    0,
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!isLoading && !cart?.items.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center mx-auto mb-5">
          <ShoppingCart className="w-10 h-10 text-kridha-primary" />
        </div>
        <h1 className="text-h4 font-bold text-[var(--color-text)] mb-2">
          {lang === "hi" ? "Cart खाली है" : "Your cart is empty"}
        </h1>
        <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-6">
          {lang === "hi"
            ? "Products browse करें और cart में जोड़ें"
            : "Browse products and add them to your cart"}
        </p>
        <Link href="/products">
          <Button variant="primary" size="lg">
            {lang === "hi" ? "Products देखें" : "Browse products"}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-h4 font-bold text-[var(--color-text)] mb-1">
        {lang === "hi" ? "आपकी Cart" : "Your Cart"}
      </h1>
      {!isLoading && (
        <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-6">
          {totalItems} {lang === "hi" ? "items" : "items"} ·{" "}
          {cart?.summary.sellerCount ?? 0}{" "}
          {lang === "hi" ? "sellers" : "sellers"}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* ── Items ─────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {isLoading && <CartSkeleton />}
          {!isLoading &&
            groups.map((group) => (
              <div
                key={group.sellerName}
                className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden"
              >
                {/* Seller header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border-DEFAULT dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/20">
                  <div className="w-7 h-7 rounded-lg bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center text-kridha-primary font-bold text-label-xs flex-shrink-0">
                    {group.sellerName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-label-sm text-[var(--color-text)] truncate">
                      {group.sellerName}
                    </p>
                    <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      {group.city}
                    </p>
                  </div>
                  <p className="text-label-sm font-semibold text-kridha-primary flex-shrink-0">
                    ₹
                    {group.items
                      .reduce((s, i) => s + i.subTotal, 0)
                      .toLocaleString("en-IN")}
                  </p>
                </div>

                {/* Items */}
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {group.items.map((item) => (
                    <div key={item.id} className="p-4 sm:p-5">
                      <div className="flex gap-4">
                        {/* Image */}
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-border-DEFAULT dark:border-border-dark bg-gray-100 dark:bg-gray-800 flex-shrink-0 relative">
                          {item.product.imageUrls?.[0] ? (
                            <Image
                              src={item.product.imageUrls[0]}
                              alt={item.product.nameEn}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <PackageX className="w-8 h-8 m-auto mt-6 text-muted-DEFAULT dark:text-muted-dark" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-label-md text-[var(--color-text)] line-clamp-2 mb-0.5">
                            {lang === "hi"
                              ? (item.product.nameHi ?? item.product.nameEn)
                              : item.product.nameEn}
                          </p>
                          <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mb-2">
                            {item.product.unit}
                          </p>

                          {/* Price */}
                          <div className="flex items-baseline gap-1.5 mb-3">
                            <span className="text-label-md font-bold text-kridha-primary">
                              ₹{item.unitPrice.toLocaleString("en-IN")}
                            </span>
                            <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                              / {item.product.unit.toLowerCase()}
                            </span>
                            <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark ml-2">
                              = ₹{item.subTotal.toLocaleString("en-IN")}
                            </span>
                          </div>

                          {/* Qty stepper */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-0">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQty.mutate({
                                    id: item.id,
                                    quantity: Math.max(1, item.quantity - 1),
                                  })
                                }
                                disabled={
                                  item.quantity <= 1 || updateQty.isPending
                                }
                                className="w-9 h-9 flex items-center justify-center rounded-l-xl border border-border-DEFAULT dark:border-border-dark bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors text-[var(--color-text)]"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <div className="w-12 h-9 flex items-center justify-center border-t border-b border-border-DEFAULT dark:border-border-dark bg-[var(--color-surface)] dark:bg-surface-dark text-label-md font-bold text-[var(--color-text)]">
                                {item.quantity}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateQty.mutate({
                                    id: item.id,
                                    quantity: item.quantity + 1,
                                  })
                                }
                                disabled={updateQty.isPending}
                                className="w-9 h-9 flex items-center justify-center rounded-r-xl border border-border-DEFAULT dark:border-border-dark bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors text-[var(--color-text)]"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Item actions */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setDeletingItem(item)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-label-xs text-error hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {lang === "hi" ? "हटाएं" : "Remove"}
                              </button>
                              <span className="text-gray-300 dark:text-gray-700">
                                |
                              </span>
                              <button
                                onClick={() =>
                                  saveForLater.mutate({
                                    itemId: item.id,
                                    productId: item.productId,
                                  })
                                }
                                disabled={saveForLater.isPending}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-label-xs text-muted-DEFAULT dark:text-muted-dark hover:text-kridha-primary hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-colors font-medium"
                              >
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                {lang === "hi"
                                  ? "Save for later"
                                  : "Save for later"}
                              </button>
                              <span className="text-gray-300 dark:text-gray-700">
                                |
                              </span>
                              <button
                                onClick={() =>
                                  addToFavorites.mutate(item.productId)
                                }
                                disabled={addToFavorites.isPending}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-label-xs text-muted-DEFAULT dark:text-muted-dark hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors font-medium"
                              >
                                <Heart className="w-3.5 h-3.5" />
                                {lang === "hi" ? "Favorite" : "Favorite"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pickup info */}
                      <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                        <Clock className="w-3.5 h-3.5 text-muted-DEFAULT dark:text-muted-dark flex-shrink-0" />
                        <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                          {lang === "hi" ? "Pickup:" : "Pickup:"}{" "}
                          {new Date(item.pickupDate).toLocaleDateString(
                            "en-IN",
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            },
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* ── Summary ─────────────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 space-y-3">
          <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-5">
            <h2 className="text-label-lg font-bold text-[var(--color-text)] mb-4">
              {lang === "hi" ? "Order Summary" : "Order Summary"}
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between">
                    <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                      {lang === "hi" ? "Items" : "Items"} ({totalItems})
                    </span>
                    <span className="text-label-sm font-medium text-[var(--color-text)]">
                      ₹{totalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                      {lang === "hi" ? "Platform fee" : "Platform fee"}
                    </span>
                    <span className="text-label-sm font-medium text-green-600 dark:text-green-400">
                      Free
                    </span>
                  </div>
                </div>
                <div className="flex justify-between pt-4 mb-4">
                  <span className="font-bold text-label-md text-[var(--color-text)]">
                    {lang === "hi" ? "Total" : "Total"}
                  </span>
                  <span className="font-bold text-label-lg text-kridha-primary">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                {/* Advance callout */}
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-kridha-secondary dark:bg-kridha-primary/10 mb-4">
                  <AlertCircle className="w-4 h-4 text-kridha-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-label-xs font-semibold text-kridha-primary">
                      {lang === "hi" ? "Advance due now" : "Advance due now"}: ₹
                      {advance.toLocaleString("en-IN")}
                    </p>
                    <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mt-0.5">
                      {lang === "hi" ? "बाकी pickup पर" : "Balance at pickup"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => router.push("/checkout")}
                  disabled={!cart?.items.length}
                >
                  {lang === "hi" ? "Checkout करें" : "Proceed to Checkout"}
                </Button>
                <Link
                  href="/products"
                  className="block mt-2 text-center text-label-xs text-kridha-primary hover:underline"
                >
                  {lang === "hi" ? "Shopping जारी रखें" : "Continue shopping"}
                </Link>
              </>
            )}
          </div>

          {/* Seller summary */}
          {!isLoading && groups.length > 1 && (
            <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-5">
              <p className="text-label-sm font-semibold text-[var(--color-text)] mb-3">
                {groups.length} {lang === "hi" ? "Sellers" : "Sellers"}
              </p>
              <div className="space-y-2">
                {groups.map((g) => (
                  <div
                    key={g.sellerName}
                    className="flex justify-between items-center"
                  >
                    <span className="text-label-xs text-[var(--color-text)] truncate max-w-36">
                      {g.sellerName}
                    </span>
                    <span className="text-label-xs font-semibold text-kridha-primary">
                      ₹
                      {g.items
                        .reduce((s, i) => s + i.subTotal, 0)
                        .toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete modal */}
      {deletingItem && (
        <DeleteItemModal
          open={!!deletingItem}
          onClose={() => setDeletingItem(null)}
          productName={deletingItem.product.nameEn}
          onConfirm={() => removeItem.mutate(deletingItem.id)}
          loading={removeItem.isPending}
        />
      )}
    </div>
  );
}
