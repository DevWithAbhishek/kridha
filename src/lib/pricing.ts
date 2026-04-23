import { PriceTier } from "@/types/dashboard";
import { AppError } from "./errors";

/**
 * Select the correct unit price for a given quantity.
 * Tiers are sorted ascending by minQty.
 * The last tier whose minQty <= quantity wins.
 *
 * Example tiers: [{minQty:1,pricePerUnit:100},{minQty:10,pricePerUnit:90},{minQty:50,pricePerUnit:80}]
 *   calcUnitPrice(1,  tiers) → 100   (only tier 1 qualifies)
 *   calcUnitPrice(9,  tiers) → 100   (9 < 10, tier 2 does NOT qualify)
 *   calcUnitPrice(10, tiers) → 90
 *   calcUnitPrice(49, tiers) → 90    (49 < 50, tier 3 does NOT qualify)
 *   calcUnitPrice(50, tiers) → 80
 *   calcUnitPrice(999,tiers) → 80    (no upper cap on top tier)
 */
export function calcUnitPrice(quantity: number, tiers: PriceTier[]): number {
  if (!tiers.length)
    throw new AppError("PRICE_TIER_NOT_FOUND", "No Price Tier Found", 404);

  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty); // Sort with O(nlog(n))

  let price = sorted[0].pricePerUnit; // start with lowest-tier price

  for (const tier of sorted) {
    if (quantity >= tier.minQty) {
      price = tier.pricePerUnit; // keep overwriting — last qualifying tier wins
    }
  }

  return price;
}

/**
 * Apply an active deal discount to a base price.
 * Returns base price unchanged if no deal is active.
 * Result is rounded to 2 decimal places.
 */
export function applyDeal(
  basePrice: number,
  discountPercent: number | null,
): number {
  if (!discountPercent || discountPercent <= 0) return basePrice;
  return parseFloat((basePrice * (1 - discountPercent / 100)).toFixed(2));
}


export function calcAdvance(orderTotal: number): number {
  // MIN(₹500, MAX(₹100, 5% of total))
  return Math.min(500, Math.max(100, Math.round(orderTotal * 0.05)));
}

export function calcRefundAmount(
  advance: number,
  pickupDeadline: string,
  cancelledBy: "BUYER" | "SELLER",
): number {
  if (cancelledBy === "SELLER") return advance;
  const hours = (new Date(pickupDeadline).getTime() - Date.now()) / 3_600_000;
  if (hours >= 24) return advance;
  if (hours >= 2) return Math.round(advance * 0.5);
  return 0;
}