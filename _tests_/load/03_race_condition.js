// _tests_/load/03_race_condition.js
// ── TEST 3: Stock Race Condition — Proves SELECT FOR UPDATE prevents oversell ──
//
// HYPOTHESIS: With N units of stock and M > N concurrent checkout attempts
// (each from an isolated buyer, bypassing cart-layer concurrency entirely),
// exactly N requests succeed (201) and (M - N) receive a clean 409.
// Stock never goes negative. No request ever returns 5xx.
//
// This test does NOT use the cart endpoint. It calls /api/orders directly
// with a fixed payload, isolating the SELECT FOR UPDATE path specifically.
//
// Setup is fully programmatic — run setup-race-test.ts first, which:
//   1. Sets product.available = STOCK_UNITS via a real seller API call
//      (no manual SQL, no manual timing window)
//   2. Creates VU_COUNT isolated buyer accounts + JWTs (no shared sessions)
//   3. Writes _tests_/results/race-test-fixtures.json
//
// Run:
//   npx tsx _tests_/scripts/setup-race-test.ts
//   k6 run -e BASE_URL=http://localhost:3000 _tests_/load/03_race_condition.js
//
// The DB verification query is printed automatically in the summary below —
// no separate manual step required to interpret the result.

import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { BASE_URL, authJsonHeaders } from "./config.js";

const fixtures = JSON.parse(open("../results/race-test-fixtures.json"));
const { stockUnits, vuCount, productId, pickupWindowId, buyerJwts } = fixtures;

const ORDER_QTY = 43;

const expectedSuccesses = Math.floor(stockUnits / ORDER_QTY);
const expectedConflicts = vuCount - expectedSuccesses;

const success_201 = new Counter("checkout_success");
const conflict_409 = new Counter("checkout_conflict_insufficient_stock");
const unexpected_status = new Counter("checkout_unexpected_status");
const server_error_5xx = new Counter("checkout_server_error");

export const options = {
  scenarios: {
    race: {
      executor: "shared-iterations",
      vus: vuCount,
      iterations: vuCount,
      maxDuration: "30s",
    },
  },

  thresholds: {
    checkout_server_error: ["count==0"],
    checkout_success: [`count==${expectedSuccesses}`],
    checkout_conflict_insufficient_stock: [`count==${expectedConflicts}`],
    checkout_unexpected_status: ["count==0"],
  },
};

export default function () {
  // Each VU uses its OWN isolated JWT — no shared cart session,
  // no cart-layer advisory check in the path. This calls the order
  // endpoint directly to isolate the SELECT FOR UPDATE transaction.
  const jwt = buyerJwts[__VU - 1];

  const pickupDate = new Date();
  pickupDate.setDate(pickupDate.getDate() + 1);

  const payload = {
    items: [
      {
        productId,
        quantity: 43,
        pickupWindowId,
        pickupDate: pickupDate.toISOString(),
      },
    ],
  };

  const res = http.post(`${BASE_URL}/api/orders`, JSON.stringify(payload), {
    headers: authJsonHeaders(jwt),
  });

  switch (res.status) {
    case 201:
      success_201.add(1);
      break;
    case 409:
      conflict_409.add(1);
      break;
    case 500:
    case 502:
    case 503:
      server_error_5xx.add(1);
      console.error(
        `SERVER ERROR vu=${__VU} status=${res.status} body=${res.body}`,
      );
      break;
    default:
      unexpected_status.add(1);
      console.error(
        `UNEXPECTED vu=${__VU} status=${res.status} body=${res.body}`,
      );
  }

  check(res, {
    "status is 201 or 409 only": (r) => r.status === 201 || r.status === 409,
    "no server errors": (r) => r.status < 500,
  });
}

export function handleSummary(data) {
  const m = data.metrics;
  const successes = m.checkout_success?.values?.count ?? 0;
  const conflicts = m.checkout_conflict_insufficient_stock?.values?.count ?? 0;
  const errors = m.checkout_server_error?.values?.count ?? 0;
  const unexpected = m.checkout_unexpected_status?.values?.count ?? 0;

  const oversoldCheck =
    successes <= expectedSuccesses ? "PASS" : "FAIL — OVERSOLD";
  const exactMatch =
    successes === expectedSuccesses && conflicts === expectedConflicts
      ? "PASS"
      : "FAIL — COUNT MISMATCH";

  const expectedRemaining = stockUnits - successes * ORDER_QTY;

  const report = `
╔══════════════════════════════════════════════════════════════╗
║   KRIDHA — STOCK RACE CONDITION PROOF                         ║
║   SELECT FOR UPDATE under genuine row-level contention        ║
╠══════════════════════════════════════════════════════════════╣
║ Setup:                                                        ║
║   Stock units available:        ${String(stockUnits).padEnd(28)}║
║   Concurrent buyers (isolated): ${String(vuCount).padEnd(28)}║
║                                                                ║
║ Results:                                                      ║
║   201 Created (won the lock):   ${String(successes).padEnd(28)}║
║   409 Conflict (lost the lock): ${String(conflicts).padEnd(28)}║
║   5xx Server errors:            ${String(errors).padEnd(28)}║
║   Unexpected status codes:      ${String(unexpected).padEnd(28)}║
║                                                                ║
║ Correctness checks:                                            ║
║   No oversell (successes <= stock):  ${oversoldCheck.padEnd(24)}║
║   Exact count match:                 ${exactMatch.padEnd(24)}║
║                                                                ║
║ DB verification (run this after the test):                    ║
║   SELECT available FROM "Product" WHERE id = '${productId}';
║   Expected: available = ${expectedRemaining}
║   Must NOT be negative.                                       ║
╚══════════════════════════════════════════════════════════════╝`;

  console.log(report);

  const passed =
    oversoldCheck === "PASS" &&
    exactMatch === "PASS" &&
    errors === 0 &&
    unexpected === 0;

  if (!passed) {
    console.error("\n❌ RACE CONDITION TEST FAILED — see report above\n");
  } else {
    console.log(
      "\n✅ Stock locking verified under genuine concurrent contention\n",
    );
  }

  return {
    "_tests_/results/03_race_condition.txt": report,
    "_tests_/results/03_race_condition.json": JSON.stringify(data, null, 2),
    stdout: "\n",
  };
}
