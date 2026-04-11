"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

type Props = {
    order: {
        id: string;
        status: "CONFIRMED" | "COMPLETED" | string;
    };
    onRequestPayment: (id: string) => Promise<void>;
    onVerifyOtp: (id: string) => Promise<void>;
    onRefetch: () => void;
};

export default function SellerOrderRow({
    order,
    onRequestPayment,
    onVerifyOtp,
    onRefetch,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePaymentRequest = async () => {
        try {
            setLoading(true);
            setError(null);

            await onRequestPayment(order.id);

            onRefetch();
        } catch (err) {
            console.error("Payment request failed:", err);
            setError("Payment request failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-5 border rounded-card bg-surface">

            {/* CONFIRMED → Request Payment */}
            {order.status === "CONFIRMED" && (
                <>
                    <button
                        onClick={handlePaymentRequest}
                        disabled={loading}
                        className="px-4 py-2 bg-primary text-white rounded disabled:opacity-50"
                    >
                        {loading ? "Processing..." : "Payment Request भेजें"}
                    </button>

                    {error && (
                        <p className="text-red-500 text-sm mt-2">{error}</p>
                    )}
                </>
            )}

            {/* COMPLETED */}
            {order.status === "COMPLETED" && (
                <div className="text-success flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    Order पूरा हुआ
                </div>
            )}
        </div>
    );
}