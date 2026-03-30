// Refund tiers (INV-13 — calculated server-side from SubOrder.pickupDeadline):
//   24h+  before pickup → 100% advance returned to buyer
//   2–24h before pickup → 50% to buyer, 50% to seller
//   <2h   before pickup → 0% to buyer, 100% to seller
//   Seller cancels      → 100% always (regardless of timing)

export function calcRefundAmount(
    advanceAmount: number,
    pickupDeadline: Date,
    cancelledBy: 'BUYER' | 'SELLER'
): number {
    if (cancelledBy === 'SELLER') return advanceAmount; // always 100%
    const now = new Date();
    const hoursBeforePickup = (pickupDeadline.getTime() - now.getTime()) / (60 * 60 * 1000);
    if (hoursBeforePickup >= 24) return advanceAmount;
    if (hoursBeforePickup >= 2) return parseFloat((advanceAmount * 0.5).toFixed(2));
    return 0; // <2h before pickup
}