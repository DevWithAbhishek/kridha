"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
    orderId: string;
    paymentLinkUrl: string | null;
    paymentLinkExpiresAt: string | null;
    onRequested: () => void;
}

export default function PaymentLinkButton({
    orderId,
    paymentLinkUrl,
    paymentLinkExpiresAt,
    onRequested,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    async function requestPayment() {
        try {
            setLoading(true);
            await fetch(`/api/orders/${orderId}/request-payment`, {
                method: "POST",
                credentials: "include",
            });
            onRequested();
        } finally {
            setLoading(false);
        }
    }

    async function copy() {
        if (!paymentLinkUrl) return;
        await navigator.clipboard.writeText(paymentLinkUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    if (!paymentLinkUrl) {
        return (
            <button
                onClick={requestPayment}
                disabled={loading}
                className="px-4 py-2 bg-kridha-primary text-white rounded-btn"
            >
                {loading ? "..." : "Payment Request भेजें"}
            </button>
        );
    }

    const expired =
        paymentLinkExpiresAt &&
        new Date(paymentLinkExpiresAt).getTime() < Date.now();

    return (
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-4 rounded-card">
            <div className="text-label-sm text-orange-700 dark:text-orange-300 mb-2">
                Buyer के pay करने का इंतजार है...
            </div>

            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm">{paymentLinkUrl}</span>
                <button onClick={copy}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
            </div>

            {expired ? (
                <div className="text-error mt-2">Link expire हो गया</div>
            ) : (
                paymentLinkExpiresAt && (
                    <div className="text-label-xs mt-2 text-muted">
                        Expiry:{" "}
                        {new Date(paymentLinkExpiresAt).toLocaleTimeString("hi-IN")}
                    </div>
                )
            )}

            {expired && (
                <button
                    onClick={requestPayment}
                    className="mt-3 text-kridha-primary underline"
                >
                    Regenerate
                </button>
            )}
        </div>
    );
}