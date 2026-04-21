"use client";
// src/app/(buyer)/pay/page.tsx
// Razorpay advance payment page.
// Gets orderId, advance amount, razorpayOrderId from query params (set by checkout).
// Script loaded once, opens Razorpay modal on "Pay Now".
// On success: server-side webhook handles PENDING→CONFIRMED, we just navigate.

import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Shield,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";

// ── Razorpay types ────────────────────────────────────────────────────────────
interface RzOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image: string;
  prefill?: { name?: string; contact?: string };
  theme?: { color?: string };
  handler(response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }): void;
  modal: { ondismiss(): void; escape: boolean };
}
interface RzInstance {
  open(): void;
}
declare global {
  interface Window {
    Razorpay?: new (options: RzOptions) => RzInstance;
  }
}

function PayContent() {
  const { lang } = useLangStore();
  const router = useRouter();
  const params = useSearchParams();

  const orderId = params.get("orderId") ?? "";
  const advance = Number(params.get("advance") ?? "0");
  const razorpayOrderId = params.get("razorpayOrderId") ?? "";

  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errMsg, setErrMsg] = useState("");
  const [paymentId, setPaymentId] = useState("");

  // Load Razorpay checkout.js once
  useEffect(() => {
    if (document.querySelector('script[src*="checkout.razorpay"]')) {
      setScriptReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => setScriptReady(true);
    s.onerror = () =>
      setErrMsg(
        lang === "hi"
          ? "Payment script load नहीं हुआ — retry करें"
          : "Payment script failed to load — please retry",
      );
    document.body.appendChild(s);
    return () => {
      try {
        document.body.removeChild(s);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openRazorpay() {
    if (!scriptReady || !window.Razorpay || !razorpayOrderId) {
      setErrMsg(
        lang === "hi"
          ? "Payment ready नहीं है — retry करें"
          : "Payment not ready — please retry",
      );
      return;
    }
    setStatus("loading");
    setErrMsg("");
    try {
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
        order_id: razorpayOrderId,
        amount: advance * 100,
        currency: "INR",
        name: "Kridha",
        description:
          lang === "hi"
            ? `Order advance #${orderId.slice(-6)}`
            : `Order advance #${orderId.slice(-6)}`,
        image: "/images/kridha_logo_nav.png",
        theme: { color: "#2A9D8F" },
        handler: (response) => {
          // Webhook on the server handles DB update (PENDING → CONFIRMED).
          // We just navigate to the order page. No need to call our own verify endpoint here.
          setPaymentId(response.razorpay_payment_id);
          setStatus("success");
          setTimeout(() => router.push(`/orders/${orderId}`), 2000);
        },
        modal: {
          ondismiss: () => {
            setStatus("idle");
          },
          escape: false,
        },
      });
      rzp.open();
    } catch {
      setStatus("error");
      setErrMsg(
        lang === "hi" ? "Payment open नहीं हुआ" : "Could not open payment",
      );
    }
  }

  // Missing params guard
  if (!orderId || !razorpayOrderId || !advance) {
    return (
      <div className="flex flex-col items-center py-20 gap-4 text-center px-4">
        <AlertCircle className="w-12 h-12 text-error" />
        <p className="text-h5 font-bold text-[var(--color-text)]">
          Invalid payment link
        </p>
        <Link href="/cart">
          <Button variant="outline">Back to Cart</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] dark:bg-background-dark flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-[var(--color-surface)] dark:bg-surface-dark rounded-2xl border border-border-DEFAULT dark:border-border-dark shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-kridha-primary to-kridha-primary-hover px-6 py-5 text-center">
            <Image
              src="/images/kridha_logo_nav.png"
              alt="Kridha"
              width={36}
              height={36}
              className="mx-auto mb-2"
            />
            <p className="text-white font-bold text-label-lg">Kridha</p>
            <p className="text-white/80 text-label-xs mt-0.5">
              {lang === "hi"
                ? "Secure Advance Payment"
                : "Secure Advance Payment"}
            </p>
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Success state */}
            {status === "success" && (
              <div className="text-center space-y-3 py-2">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-h5 font-bold text-[var(--color-text)]">
                  {lang === "hi"
                    ? "Payment Successful!"
                    : "Payment Successful!"}
                </p>
                <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                  {lang === "hi"
                    ? "Order confirm हो रहा है..."
                    : "Confirming your order..."}
                </p>
                {paymentId && (
                  <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark font-mono bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                    ID: {paymentId.slice(-12)}
                  </p>
                )}
                <div className="flex items-center justify-center gap-2 text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Redirecting...
                </div>
              </div>
            )}

            {/* Default / loading state */}
            {status !== "success" && (
              <>
                {/* Amount */}
                <div className="text-center bg-kridha-secondary dark:bg-kridha-primary/10 rounded-2xl py-5 px-4">
                  <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-1">
                    {lang === "hi" ? "Advance Amount" : "Advance Amount"}
                  </p>
                  <p className="text-display-sm font-bold text-kridha-primary">
                    ₹{advance.toLocaleString("en-IN")}
                  </p>
                  <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mt-1">
                    {lang === "hi" ? "Order ID:" : "Order ID:"} #
                    {orderId.slice(-8).toUpperCase()}
                  </p>
                </div>

                {/* Info */}
                <div className="space-y-2">
                  {[
                    {
                      icon: "🏪",
                      en: "Balance paid at pickup",
                      hi: "बाकी payment store पर",
                    },
                    {
                      icon: "↩️",
                      en: "Refund if cancelled 24h+ before",
                      hi: "24+ घंटे पहले cancel = refund",
                    },
                    {
                      icon: "🔒",
                      en: "Powered by Razorpay",
                      hi: "Razorpay द्वारा secured",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                    >
                      <span className="text-[15px] flex-shrink-0 mt-0.5">
                        {item.icon}
                      </span>
                      <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                        {lang === "hi" ? item.hi : item.en}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Error */}
                {(errMsg || status === "error") && (
                  <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                    <p className="text-label-xs text-error">
                      {errMsg || "Payment failed — please try again"}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={status === "loading" || (!scriptReady && !errMsg)}
                    onClick={openRazorpay}
                    disabled={status === "loading"}
                  >
                    {!scriptReady && !errMsg
                      ? lang === "hi"
                        ? "Loading..."
                        : "Loading..."
                      : status === "error"
                        ? lang === "hi"
                          ? "Retry करें"
                          : "Retry Payment"
                        : lang === "hi"
                          ? `₹${advance.toLocaleString("en-IN")} Pay करें`
                          : `Pay ₹${advance.toLocaleString("en-IN")}`}
                  </Button>
                  <Link href="/cart" className="block">
                    <Button variant="outline" size="md" className="w-full">
                      {lang === "hi" ? "Cart पर जाएं" : "Back to Cart"}
                    </Button>
                  </Link>
                </div>

                {/* Security footer */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  <div className="flex items-center gap-1 text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                    <Lock className="w-3 h-3" />
                    SSL Secured
                  </div>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <div className="flex items-center gap-1 text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                    <Shield className="w-3 h-3" />
                    Razorpay
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Suspense wrapper required for useSearchParams in Next.js 15+
export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-kridha-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PayContent />
    </Suspense>
  );
}
