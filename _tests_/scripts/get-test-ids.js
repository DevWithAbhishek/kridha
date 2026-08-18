// tests/scripts/get-test-ids.js
// Run BEFORE k6 tests to fetch real IDs from your seeded DB
// Usage: node _tests_/scripts/get-test-ids.js
//
// Outputs a .env-style block you paste into run-all.cmd

import "dotenv/config";
import { prisma } from "../../src/lib/db.ts";

async function main() {
  // ── Get first active product with a pickup window ────────────────────────
  const product = await prisma.product.findFirst({
    where: { productStatus: "ACTIVE", deletedAt: null, available: { gt: 20 } },
    include: {
      seller: { include: { pickupWindows: { where: { deletedAt: null }, take: 1 } } },
      priceTiers: { take: 1 },
    },
    orderBy: { available: "desc" },
  });

  if (!product) {
    console.error("❌  No active products found. Run: npx prisma db seed");
    process.exit(1);
  }

  // ── Get two products from DIFFERENT sellers (deadlock test) ──────────────
  const productA = product;
  const productB = await prisma.product.findFirst({
    where: {
      productStatus: "ACTIVE",
      deletedAt: null,
      available: { gt: 20 },
      sellerId: { not: product.sellerId },
    },
    include: { seller: { include: { pickupWindows: { where: { deletedAt: null }, take: 1 } } } },
  });

  // ── Get the test buyer user ───────────────────────────────────────────────
  const buyer = await prisma.user.findFirst({
    where: { name: "Test Buyer" },
  });

  // ── Get test seller (first seller from seed) ──────────────────────────────
  const seller = await prisma.sellerProfile.findUnique({
    where: {
      userId: productA.sellerId,
    },
    select: {
      user: {
        select: {
          phone: true,
          name: true,
        },
      },
    },
  });

  // ── Get pickup window for product A ──────────────────────────────────────
  const pickupWin = product.seller?.pickupWindows?.[0];

  console.log("\n=== KRIDHA TEST IDs ===");
  console.log("Copy the block below into run-all.cmd:\n");
  console.log(`set PRODUCT_ID=${product.id}`);
  console.log(`set PRODUCT_ID_A=${productA.id}`);
  console.log(`set PRODUCT_ID_B=${productB?.id ?? ""}`);
  console.log(`set PICKUP_WIN_ID=${pickupWin?.id ?? ""}`);
  console.log(`set SELLER_PHONE=${seller?.user.phone ?? ""}`);
  console.log(`set BUYER_PHONE=${buyer?.phone ?? ""}`);
  console.log(`set PRODUCT_AVAILABLE=${product.available}`);
  console.log("\n=== PRODUCT INFO ===");
  console.log(JSON.stringify(product.priceTiers, null, 2));
  console.log(`Product:   ${product.nameEn}`);
  console.log(`Available: ${product.available}`);
  console.log(`Seller:    ${product.sellerId}`);
  console.log(`Window:    ${pickupWin?.labelEn} (${pickupWin?.startTime}–${pickupWin?.endTime})`);
  if (productB) {
    console.log(`\nProduct B: ${productB.nameEn} (different seller — for deadlock test)`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
