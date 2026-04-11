"use client";

import { CheckCircle2 } from "lucide-react";

export default function SellerOrderRow({
    order,
    onRequestPayment,
    onVerifyOtp,
    onRefetch,
}: any) {
    return (
        <div className="p-5 border rounded-card bg-surface">
            {order.status === "CONFIRMED" && (
                <button
                    onClick={async () => {
                        await onRequestPayment(order.id);
                        onRefetch();
                    }}
                >
                    Payment Request भेजें
                </button>
            )}

            {order.status === "COMPLETED" && (
                <div className="text-success flex items-center gap-2">
                    <CheckCircle2 /> Order पूरा हुआ
                </div>
            )}
        </div>
    );
}