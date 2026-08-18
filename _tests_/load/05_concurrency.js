// _tests_/load/05_concurrency.js
// ── TEST 5 — Application Stability & Cache Performance ─────────────────────
//
// Purpose:
//   A. Concurrent cart operations (stability)
//   B. Redis cache effectiveness (cold vs warm)
//
// This file intentionally does NOT verify:
//   - SELECT FOR UPDATE
//   - stock locking
//   - overselling
//   - authentication rate limiting
// Those are covered elsewhere.
//
// Run:
//   npx tsx _tests_/scripts/setup-race-test.ts   (reuses the same fixtures)
//   k6 run -e BASE_URL=http://localhost:3000 _tests_/load/05_concurrency.js

import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import {
  BASE_URL,
  LAT,
  LNG,
  PICKUP_WIN_ID,
  authJsonHeaders,
  jsonBody,
  tomorrowISO,
} from "./config.js";

const fixtures = JSON.parse(open("../results/race-test-fixtures.json"));
const { productId, pickupWindowId, buyerJwts } = fixtures;
// Fall back to env PICKUP_WIN_ID if the fixtures file uses a different product
// than the one passed for this run.
const effectivePickupWindowId = pickupWindowId || PICKUP_WIN_ID;

const EXPECTED_REQUESTS = 50;

// ── Scenario A metrics — every request increments exactly one of these ────
const cart_success = new Counter("cart_add_success");
const cart_conflict = new Counter("cart_add_conflict");
const cart_client_error = new Counter("cart_client_error");
const cart_error = new Counter("cart_add_error");
const cart_unknown_error = new Counter("cart_unknown_error");

// ── Scenario B metrics ──────────────────────────────────────────────────────
const cold_latency = new Trend("cache_cold_latency_ms");
const warm_latency = new Trend("cache_warm_latency_ms");
const read_ok = new Rate("read_success_rate");

export const options = {
  scenarios: {
    cart_concurrent: {
      executor: "shared-iterations",
      vus: 50,
      iterations: 50,
      maxDuration: "30s",
      exec: "cartScenario",
    },

    // Phase 1: cold reads (unique query params → guaranteed cache miss)
    cache_cold: {
      executor: "shared-iterations",
      vus: 20,
      iterations: 20,
      maxDuration: "20s",
      exec: "cacheColdScenario",
      startTime: "35s",
    },

    // Phase 2: warm reads (identical query params → should hit cache)
    cache_warm: {
      executor: "shared-iterations",
      vus: 20,
      iterations: 20,
      maxDuration: "20s",
      exec: "cacheWarmScenario",
      startTime: "60s",
    },
  },
  thresholds: {
    cart_add_error: ["count==0"],
    read_success_rate: ["rate>0.99"],
  },
};

// ── Scenario A: 50 VUs add to cart simultaneously ─────────────────────────
// This is a stability check, not a correctness proof. cartService.addItem
// only does an advisory stock check — the hard guarantee is SELECT FOR
// UPDATE inside the order transaction, tested separately in test 03.
export function cartScenario() {
  const jwt = buyerJwts[__ITER % buyerJwts.length];
  const res = http.post(
    `${BASE_URL}/api/cart`,
    jsonBody({
      productId,
      quantity: 1,
      pickupWindowId: effectivePickupWindowId,
      pickupDate: tomorrowISO(),
    }),
    { headers: authJsonHeaders(jwt) },
  );

  const s = res.status;

  // Every request increments exactly one counter — no response disappears.
  if (s === 200 || s === 201) cart_success.add(1);
  else if (s === 409) cart_conflict.add(1);
  else if (s >= 400 && s < 500) cart_client_error.add(1);
  else if (s >= 500) cart_error.add(1);
  else cart_unknown_error.add(1);

  // Log anything unexpected (not 2xx, not a clean 409) for visibility.
  if (s >= 400 && s !== 409) {
    console.error(`CART vu=${__VU} status=${s} body=${res.body}`);
  }

  check(res, {
    "cart no 500": (r) => r.status !== 500,
    "cart added or conflicted": (r) =>
      r.status === 201 || r.status === 200 || r.status === 409,
  });
}

// ── Scenario B, phase 1: cold reads — unique params force a cache miss ────
export function cacheColdScenario() {
  // Unique radius value per iteration defeats the cache key on purpose,
  // forcing every request through to PostGIS.
  const uniqueRadius = 10 + (__ITER % 50) * 0.001;
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/api/products?lat=${LAT}&lng=${LNG}&radius=${uniqueRadius}&page=1`,
  );
  cold_latency.add(Date.now() - start);
  read_ok.add(res.status === 200);

  check(res, { "cold read 200": (r) => r.status === 200 });
}

// ── Scenario B, phase 2: warm reads — identical params, should hit cache ──
export function cacheWarmScenario() {
  // Fixed params, repeated by every VU — first request of this phase
  // populates the cache, the rest should be served from Redis.
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/api/products?lat=${LAT}&lng=${LNG}&radius=10&page=1`,
  );
  warm_latency.add(Date.now() - start);
  read_ok.add(res.status === 200);

  check(res, { "warm read 200": (r) => r.status === 200 });
}

export function handleSummary(data) {
  const m = data.metrics;

  const cartSuccess = m.cart_add_success?.values?.count ?? 0;
  const cartConflict = m.cart_add_conflict?.values?.count ?? 0;
  const cartClientErrors = m.cart_client_error?.values?.count ?? 0;
  const cartServerErrors = m.cart_add_error?.values?.count ?? 0;
  const cartUnknown = m.cart_unknown_error?.values?.count ?? 0;

  const executedRequests =
    cartSuccess +
    cartConflict +
    cartClientErrors +
    cartServerErrors +
    cartUnknown;
  const accountingOk = executedRequests === EXPECTED_REQUESTS;

  const scenarioAResult =
    cartServerErrors === 0 && cartUnknown === 0 && accountingOk
      ? "✅ PASS"
      : !accountingOk
        ? "⚠ Accounting mismatch"
        : "❌ FAIL";

  const coldP95 = m.cache_cold_latency_ms?.values?.["p(95)"] ?? 0;
  const warmP95 = m.cache_warm_latency_ms?.values?.["p(95)"] ?? 0;
  const speedup =
    coldP95 > 0 ? (coldP95 / Math.max(warmP95, 1)).toFixed(2) : "N/A";
  const scenarioBResult =
    warmP95 > 0 && warmP95 < coldP95 ? "✅ PASS" : "❌ FAIL";
  const readSuccessRate = (
    (m.read_success_rate?.values?.rate ?? 0) * 100
  ).toFixed(2);

  const report = `
════════════════════════════════════════════════════════
KRIDHA — CONCURRENCY & PERFORMANCE
════════════════════════════════════════════════════════
SCENARIO A
Concurrent Cart Operations
--------------------------
Successful Adds    : ${cartSuccess}
Conflicts (409)     : ${cartConflict}
Client Errors (4xx) : ${cartClientErrors}
Server Errors (5xx) : ${cartServerErrors}
Unknown Responses   : ${cartUnknown}

Expected Requests   : ${EXPECTED_REQUESTS}
Executed Requests   : ${executedRequests}
Result: ${scenarioAResult}

SCENARIO B
Redis Cache
------------
Cold P95         : ${coldP95.toFixed(0)}ms
Warm P95         : ${warmP95.toFixed(0)}ms
Speedup          : ${speedup}x
Read Success %   : ${readSuccessRate}%
Result: ${scenarioBResult}
════════════════════════════════════════════════════════

Stock-lock correctness: See 03_race_condition.js
Authentication rate limiting: Covered by middleware + integration tests.`;

  console.log(report);
  return {
    "_tests_/results/05_concurrency.txt": report,
    "_tests_/results/05_concurrency.json": JSON.stringify(data, null, 2),
    stdout: "\n",
  };
}
