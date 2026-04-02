// Jest unit tests — no DB. Pure functions only.
// Run: npm run test:unit
// ─────────────────────────────────────────────────────────────────────────────

import { calcUnitPrice, applyDeal } from "@/lib/pricing";
import { calcRefundAmount } from "@/lib/refund";

interface PriceTierLike {
  id: string;
  productId: string;
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
}

const tiers: PriceTierLike[] = [
  { id: "t1", productId: "p1", minQty: 1, maxQty: 49, pricePerUnit: 100 },
  { id: "t2", productId: "p1", minQty: 50, maxQty: 199, pricePerUnit: 85 },
  { id: "t3", productId: "p1", minQty: 200, maxQty: null, pricePerUnit: 75 },
];

describe("calcUnitPrice", () => {
  it("applies base tier for qty = 1", () =>
    expect(calcUnitPrice(1, tiers)).toBe(100));
  it("applies base tier for qty = 49", () =>
    expect(calcUnitPrice(49, tiers)).toBe(100));
  it("applies bulk tier at boundary 50", () =>
    expect(calcUnitPrice(50, tiers)).toBe(85));
  it("applies bulk tier for qty = 100", () =>
    expect(calcUnitPrice(100, tiers)).toBe(85));
  it("applies top tier at boundary 200", () =>
    expect(calcUnitPrice(200, tiers)).toBe(75));
  it("applies top tier for qty = 1000", () =>
    expect(calcUnitPrice(1000, tiers)).toBe(75));
  it("throws when tiers array is empty", () =>
    expect(() => calcUnitPrice(1, [])).toThrow());
});

describe("applyDeal", () => {
  it("returns base price when no deal", () =>
    expect(applyDeal(100, null)).toBe(100));
  it("returns base price when discount = 0", () =>
    expect(applyDeal(100, 0)).toBe(100));
  it("applies 10% discount correctly", () =>
    expect(applyDeal(100, 10)).toBe(90));
  it("rounds to 2 decimal places", () =>
    expect(applyDeal(100, 15.5)).toBe(84.5));
  it("applies 100% discount → 0", () => expect(applyDeal(100, 100)).toBe(0));
});

describe("calcRefundAmount", () => {
  const future24h = new Date(Date.now() + 25 * 3_600_000); // 25h ahead
  const future12h = new Date(Date.now() + 12 * 3_600_000); // 12h ahead
  const future1h = new Date(Date.now() + 1 * 3_600_000); // 1h ahead
  const advance = 500;

  describe("BUYER cancels", () => {
    it("returns 100% when 24h+ before pickup", () =>
      expect(calcRefundAmount(advance, future24h, "BUYER")).toBe(500));
    it("returns 50% when 2-24h before pickup", () =>
      expect(calcRefundAmount(advance, future12h, "BUYER")).toBe(250));
    it("returns 0% when < 2h before pickup", () =>
      expect(calcRefundAmount(advance, future1h, "BUYER")).toBe(0));
  });

  describe("SELLER cancels", () => {
    it("always returns 100% regardless of time", () =>
      expect(calcRefundAmount(advance, future1h, "SELLER")).toBe(500));
    it("always returns 100% at any timing", () =>
      expect(calcRefundAmount(advance, future24h, "SELLER")).toBe(500));
  });
});
