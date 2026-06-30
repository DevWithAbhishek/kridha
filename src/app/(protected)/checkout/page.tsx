"use client";
// src/app/(buyer)/checkout/page.tsx
// Checkout — shows cart items grouped by seller, per-seller subtotals/advance,
// pickup window + date per seller, then places order via POST /api/cart/checkout

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  MapPin,
  Clock,
  Package,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import type { CartItem } from "@/types/dashboard";

interface CartData {
  id: string;
  expiresAt: string;
  items: CartItem[];
  summary: { totalItems: number; totalAmount: number; sellerCount: number };
}

function calcAdvance(total: number): number {
  return Math.min(500, Math.max(100, Math.round(total * 0.05)));
}

export default function CheckoutPage() {
  const { lang } = useLangStore();
  const router = useRouter();
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState("");

  const { data: cart, isLoading } = useQuery<CartData>({
    queryKey: ["cart"],
    queryFn: () => api.get("/cart").then((r) => r.data.data.cart),
    staleTime: 30_000,
  });

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

  const totalAmount = cart?.items.reduce((s, i) => s + i.subTotal, 0) ?? 0;
  const totalAdvance = groups.reduce(
    (s, g) => s + calcAdvance(g.items.reduce((ss, i) => ss + i.subTotal, 0)),
    0,
  );

  async function placeOrder() {
    setPlacing(true);
    setErr("");
    try {
      const res = await api.post("/cart/checkout");
      const d = res.data.data;
      router.push(
        `/pay?orderId=${d.orderId}&advance=${d.advance.amount}&razorpayOrderId=${d.advance.razorpayOrderId}`,
      );
    } catch (e) {
      const ex = e as {
        response?: { data?: { message?: string; code?: string } };
      };
      const code = ex.response?.data?.code;
      setErr(
        code === "INSUFFICIENT_STOCK"
          ? "Some items are now out of stock — please update your cart"
          : (ex.response?.data?.message ?? "Unable to place order"),
      );
    } finally {
      setPlacing(false);
    }
  }

  if (isLoading)
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={`rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse ${i === 0 ? "h-10" : "h-40"}`}
          />
        ))}
      </div>
    );

  if (!cart?.items.length)
    return (
      <div className="flex flex-col items-center py-24 gap-4 text-center px-4">
        <Package className="w-12 h-12 text-muted-DEFAULT dark:text-muted-dark" />
        <p className="text-h5 font-bold text-[var(--color-text)]">
          {lang === "hi" ? "Cart खाली है" : "Cart is empty"}
        </p>
        <Link href="/cart">
          <Button variant="primary">
            {lang === "hi" ? "Cart देखें" : "View Cart"}
          </Button>
        </Link>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <Link
        href="/cart"
        className="inline-flex items-center gap-2 text-label-sm text-muted-DEFAULT dark:text-muted-dark hover:text-kridha-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {lang === "hi" ? "Cart पर जाएं" : "Back to Cart"}
      </Link>
      <h1 className="text-h4 font-bold text-[var(--color-text)] mb-1">
        {lang === "hi" ? "Checkout" : "Checkout"}
      </h1>
      <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-6">
        {lang === "hi"
          ? "Order confirm होने के बाद cart खाली होगी"
          : "Cart will clear after order is placed"}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* ── Order groups ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {groups.map((group) => {
            const sellerTotal = group.items.reduce((s, i) => s + i.subTotal, 0);
            const sellerAdvance = calcAdvance(sellerTotal);
            return (
              <div
                key={group.sellerName}
                className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden"
              >
                {/* Seller header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border-DEFAULT dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/20">
                  <div className="w-8 h-8 rounded-xl bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center text-kridha-primary font-bold text-label-sm flex-shrink-0">
                    {group.sellerName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-label-md text-[var(--color-text)] truncate">
                      {group.sellerName}
                    </p>
                    <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      {group.city}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                      {group.items.length} {lang === "hi" ? "items" : "items"}
                    </p>
                    <p className="font-bold text-label-md text-kridha-primary">
                      ₹{sellerTotal.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Items list */}
                <div className="px-5 py-4 space-y-3 border-b border-gray-100 dark:border-gray-800">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-kridha-secondary dark:bg-kridha-primary/10 flex-shrink-0" />
                      <p className="flex-1 text-label-sm text-[var(--color-text)] truncate">
                        {lang === "hi"
                          ? (item.product.nameHi ?? item.product.nameEn)
                          : item.product.nameEn}
                      </p>
                      <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                        {item.quantity} {item.product.unit.toLowerCase()}
                      </span>
                      <span className="text-label-sm font-semibold text-[var(--color-text)] flex-shrink-0">
                        ₹{item.subTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pickup info from cart */}
                {group.items[0]?.pickupDate && (
                  <div className="px-5 py-3 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800">
                    <Clock className="w-4 h-4 text-kridha-primary flex-shrink-0" />
                    <p className="text-label-sm text-[var(--color-text)]">
                      {lang === "hi" ? "Pickup:" : "Pickup:"}{" "}
                      {new Date(group.items[0].pickupDate).toLocaleDateString(
                        "en-IN",
                        { weekday: "long", day: "numeric", month: "long" },
                      )}
                    </p>
                  </div>
                )}

                {/* Per-seller subtotal with advance */}
                <div className="px-5 py-3 bg-gray-50/50 dark:bg-gray-800/20">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                      {lang === "hi" ? "Subtotal" : "Subtotal"}
                    </span>
                    <span className="font-semibold text-label-md text-[var(--color-text)]">
                      ₹{sellerTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                      {lang === "hi" ? "Advance (अभी)" : "Advance (now)"}
                    </span>
                    <span className="text-label-xs font-semibold text-kridha-primary">
                      ₹{sellerAdvance.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                      {lang === "hi"
                        ? "Remaining (pickup पर)"
                        : "Remaining (at pickup)"}
                    </span>
                    <span className="text-label-xs font-semibold text-[var(--color-text)]">
                      ₹{(sellerTotal - sellerAdvance).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Order summary sidebar ─────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 space-y-3">
          <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-5">
            <h2 className="text-label-lg font-bold text-[var(--color-text)] mb-4">
              {lang === "hi" ? "Payment Breakdown" : "Payment Breakdown"}
            </h2>
            <div className="space-y-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex justify-between">
                <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                  {lang === "hi" ? "Order total" : "Order total"}
                </span>
                <span className="text-label-sm font-semibold text-[var(--color-text)]">
                  ₹{totalAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                  {lang === "hi" ? "Sellers" : "Sellers"}
                </span>
                <span className="text-label-sm font-medium text-[var(--color-text)]">
                  {groups.length}
                </span>
              </div>
            </div>
            {/* Pay now */}
            <div className="py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-label-md text-[var(--color-text)]">
                  {lang === "hi" ? "Advance (अभी)" : "Pay now (advance)"}
                </span>
                <span className="font-bold text-h5 text-kridha-primary">
                  ₹{totalAdvance.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                Min ₹100 · Max ₹500 per seller
              </p>
            </div>
            {/* Pay at pickup */}
            <div className="pt-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                  {lang === "hi" ? "Remaining (pickup पर)" : "Pay at pickup"}
                </span>
                <span className="font-semibold text-label-md text-[var(--color-text)]">
                  ₹{(totalAmount - totalAdvance).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {err && (
              <div className="flex items-start gap-2 mt-4 mb-3 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                <p className="text-label-xs text-error">{err}</p>
              </div>
            )}

            <div className="space-y-2 mt-4">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                loading={placing}
                onClick={placeOrder}
              >
                {lang === "hi"
                  ? `₹${totalAdvance.toLocaleString("en-IN")} Advance Pay करें`
                  : `Pay ₹${totalAdvance.toLocaleString("en-IN")} advance`}
              </Button>
              <p className="text-center text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                {lang === "hi"
                  ? "Razorpay द्वारा secured"
                  : "Secured by Razorpay"}
              </p>
            </div>
          </div>

          {/* Trust signals */}
          <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-4 space-y-2">
            {[
              {
                icon: "🔒",
                en: "Advance confirms your order",
                hi: "Advance से order confirm होता है",
              },
              {
                icon: "🏪",
                en: "Balance paid directly at store",
                hi: "बाकी payment store पर",
              },
              {
                icon: "↩️",
                en: "Cancel before pickup for refund",
                hi: "Pickup से पहले cancel = refund",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-[15px] flex-shrink-0 mt-0.5">
                  {item.icon}
                </span>
                <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                  {lang === "hi" ? item.hi : item.en}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
