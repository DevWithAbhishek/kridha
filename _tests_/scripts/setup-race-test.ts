// _tests_/scripts/setup-race-test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fully programmatic setup for the stock race condition test. No manual SQL.
// No manual timing window. Run this once before 03_race_condition.js.
//
// What it does:
//   1. Finds (or accepts via env) a seller-owned product + pickup window.
//   2. Sets that product's `available` stock to STOCK_UNITS via a real
//      seller-authenticated API call (not raw SQL) — exercises the actual
//      update path, not a backdoor.
//   3. Creates VU_COUNT isolated buyer accounts, each with their own JWT.
//      No shared cart session, no shared login — every VU is a distinct user.
//   4. Writes _tests_/results/race-test-fixtures.json with everything
//      03_race_condition.js needs: stockUnits, vuCount, productId,
//      pickupWindowId, buyerJwts.
//
// Usage:
//   npx tsx _tests_/scripts/setup-race-test.ts
//
// Required env:
//   JWT_SECRET        — must match the running server's JWT_SECRET
//   SELLER_PHONE       — phone of a seeded seller who owns PRODUCT_ID
//   PRODUCT_ID         — product to drain stock on
//   PICKUP_WIN_ID      — a valid pickup window for that product's seller
//
// Optional env:
//   BASE_URL           — default http://localhost:3000
//   STOCK_UNITS        — default 10
//   VU_COUNT           — default 50 (must be > STOCK_UNITS for a real race)
// ─────────────────────────────────────────────────────────────────────────────


import { prisma } from "../../src/lib/db";
// import { PrismaClient } from "@prisma/client";
// export const prisma = new PrismaClient();

import * as argon2 from "argon2";
import * as jwt from "jsonwebtoken";
import * as fs from "fs";
import * as path from "path";

console.log({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
});

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "";
const SELLER_PHONE = process.env.SELLER_PHONE || "";
const PRODUCT_ID = process.env.PRODUCT_ID || "";
const PICKUP_WIN_ID = process.env.PICKUP_WIN_ID || "";

const STOCK_UNITS = Number(process.env.STOCK_UNITS || 1290);
const VU_COUNT = Number(process.env.VU_COUNT || 50);
const PIN = "1234";

function buyerPhone(i: number): string {
  // Synthetic range — won't collide with seed data (seed uses real-looking
  // 10-digit numbers; this range is deliberately out-of-band).
  return `9999${String(i).padStart(6, "0")}`;
}

async function assertEnv() {
  const missing: string[] = [];
  if (!JWT_SECRET) missing.push("JWT_SECRET");
  if (!SELLER_PHONE) missing.push("SELLER_PHONE");
  if (!PRODUCT_ID) missing.push("PRODUCT_ID");
  if (!PICKUP_WIN_ID) missing.push("PICKUP_WIN_ID");

  if (missing.length > 0) {
    console.error(`\n❌  Missing required env vars: ${missing.join(", ")}`);
    console.error(`    Run _tests_/scripts/get-test-ids.js first to obtain`);
    console.error(`    PRODUCT_ID, PICKUP_WIN_ID, and SELLER_PHONE.\n`);
    process.exit(1);
  }

  const ORDER_QTY = 43; // hardcoded
  const maxSuccessfulOrders = Math.floor(STOCK_UNITS / ORDER_QTY);
  if (VU_COUNT <= maxSuccessfulOrders) {
    console.error(
      `VU_COUNT (${VU_COUNT}) must be greater than the maximum possible successful orders (${maxSuccessfulOrders}).`
    );
    process.exit(1);
  }
}

async function loginAsSeller(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: SELLER_PHONE, pin: PIN }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Seller login failed: ${res.status} ${body}`);
  }

  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/kridha_access=([^;]+)/);
  if (!match) throw new Error("No kridha_access cookie returned for seller login");
  return match[1];
}

async function setStockViaApi(sellerJwt: string): Promise<void> {
  // Uses the real seller-facing inventory update endpoint — same code path
  // a real seller hits, not a direct DB write. If this endpoint name differs
  // in your routes, update the path below; the point is to go through the
  // API, not around it.
  const res = await fetch(`${BASE_URL}/api/products/mine/${PRODUCT_ID}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: `kridha_access=${sellerJwt}`,
    },
    body: JSON.stringify({ available: STOCK_UNITS }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to set stock via API: ${res.status} ${body}\n` +
      `Check that PRODUCT_ID belongs to the seller logged in as SELLER_PHONE.`,
    );
  }

  console.log(`✅  Set Product ${PRODUCT_ID} available = ${STOCK_UNITS} via API`);
}

async function createIsolatedBuyers(): Promise<string[]> {
  console.log(`\nCreating ${VU_COUNT} isolated buyer accounts...\n`);

  const pinHash = await argon2.hash(PIN, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const jwts: string[] = [];

  for (let i = 1; i <= VU_COUNT; i++) {
    const phone = buyerPhone(i);

    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
        name: `RaceTestBuyer${i}`,
        pinHash,
        preferredLang: "en",
        roles: ["BUYER"],
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        roles: user.roles,
        type: "access",
      },
      JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "15m",
      },
    );

    jwts.push(token);

    if (i % 10 === 0) console.log(`  Created buyer ${i}/${VU_COUNT}`);
  }

  return jwts;
}

async function main() {
  await assertEnv();

  console.log(`Logging in as seller (${SELLER_PHONE})...`);
  const sellerJwt = await loginAsSeller();

  await setStockViaApi(sellerJwt);

  const buyerJwts = await createIsolatedBuyers();

  const fixtures = {
    stockUnits: STOCK_UNITS,
    vuCount: VU_COUNT,
    productId: PRODUCT_ID,
    pickupWindowId: PICKUP_WIN_ID,
    buyerJwts,
  };

  const outDir = path.join(process.cwd(), "_tests_/results");
  const outFile = path.join(outDir, "race-test-fixtures.json");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(fixtures, null, 2));

  console.log(`\n✅  Fixtures written to: ${outFile}`);
  console.log(`    stockUnits: ${STOCK_UNITS}`);
  console.log(`    vuCount:    ${VU_COUNT}`);
  console.log(`    productId:  ${PRODUCT_ID}`);
  console.log("\n─────────────────────────────────────────────");
  console.log("Run command:\n");
  console.log(`  k6 run -e BASE_URL=${BASE_URL} _tests_/load/03_race_condition.js`);
  console.log("─────────────────────────────────────────────\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());