import { calcRefundAmount } from "@/lib/pricing";

type Props = {
    pickupDeadline: string;
    advanceAmount: number;
    cancelledBy: "BUYER" | "SELLER";
};

export default function RefundTierInfo({
    pickupDeadline,
    advanceAmount,
    cancelledBy,
}: Props) {
    let refundAmount = 0;

    try {
        refundAmount = calcRefundAmount(
            advanceAmount,
            pickupDeadline,
            cancelledBy
        );
    } catch (err) {
        console.error("Refund calc error:", err);
    }

    const formatted = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(refundAmount || 0);

    return (
        <div className="p-4 border rounded-card">
            <div className="text-lg font-bold">
                आपको मिलेगा: {formatted}
            </div>
        </div>
    );
}