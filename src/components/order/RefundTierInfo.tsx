import { calcRefundAmount } from "@/lib/pricing";

export default function RefundTierInfo({
    pickupDeadline,
    advanceAmount,
    cancelledBy,
}: any) {
    const refundAmount = calcRefundAmount(
        advanceAmount,
        pickupDeadline,
        cancelledBy
    );

    return (
        <div className="p-4 border rounded-card">
            <div className="text-lg font-bold">
                आपको मिलेगा: ₹{refundAmount}
            </div>
        </div>
    );
}