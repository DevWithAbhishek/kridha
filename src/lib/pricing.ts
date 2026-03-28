import { PriceTier } from "@prisma/client";

export function calcUnitPrice(quantity: number, tiers: PriceTier[]): number {
  // Sort tiers by minQuantity in descending order
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  let price = sorted[0]?.pricePerUnit;
  for (const t of sorted) {
    if (quantity >= t.minQty) price = t.pricePerUnit;
  }
  if (price === undefined) throw new Error("No Price Tier Found");
  return price;
}
