// tests/load/01_percentiles.js
// ── TEST 1: P50 / P90 / P95 / P99 / Max / Min / Avg per endpoint ──────────
//
// Run:
  // k6 run -e BASE_URL=http://localhost:3000 -e BUYER_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbXBwaWtlZ2owMHk0cWtna2x1azBjamoxIiwicm9sZXMiOlsiQlVZRVIiXSwiaWF0IjoxNzc5OTc2NDAxLCJleHAiOjE3Nzk5NzczMDF9.KRtntPg6gSaIdH1mN8RObPecEDBb2_BxgzxnU085pDQ -e PRODUCT_ID=cmppike0500c2qkgkc9xd6fyg _tests_/load/01_percentiles.js
//
// Without BUYER_JWT → cart/orders/notifications skipped (warns, doesn't crash)
// Without PRODUCT_ID → product_detail skipped

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import {
  BASE_URL,
  LAT,
  LNG,
  BUYER_JWT,
  PRODUCT_ID,
  cookieHeader,
} from "./config.js";

// ── Metrics ────────────────────────────────────────────────────────────────
// Do NOT pass `true` as second arg — native histograms change key names in summary
const t_health = new Trend("latency_health");
const t_products = new Trend("latency_products");
const t_product_detail = new Trend("latency_product_detail");
const t_deals = new Trend("latency_deals");
const t_cart_get = new Trend("latency_cart_get");
const t_orders = new Trend("latency_orders");
const t_notifications = new Trend("latency_notifications");

const errorRate = new Rate("error_rate");
const http_5xx = new Counter("http_5xx_count");
const http_4xx = new Counter("http_4xx_count");
const http_2xx = new Counter("http_2xx_count");

const hasAuth = !!BUYER_JWT;
const hasProductId = !!PRODUCT_ID;

// ── Thresholds ─────────────────────────────────────────────────────────────
// These reflect realistic Vercel serverless + Supabase targets.
// If you have Redis cache active, tighten products/deals to p(95)<150.
// If hitting production (not local), cold starts will push these higher.
export let options = {
  stages: [
    { duration: "30s", target: 10 }, // warm up — let Vercel functions warm
    { duration: "1m", target: 50 }, // ramp
    { duration: "3m", target: 100 }, // steady state — screenshot this window
    { duration: "30s", target: 0 }, // cool down
  ],
  thresholds: {
    // Adjust these to your actual SLOs
    // Local Docker: much faster (no network latency)
    // Vercel + Supabase: expect 300-800ms on cold paths
    latency_health: ["p(95)<500", "p(99)<1000"],
    latency_products: ["p(95)<1500", "p(99)<3000"],
    latency_product_detail: ["p(95)<1500", "p(99)<3000"],
    latency_deals: ["p(95)<1500", "p(99)<3000"],
    latency_cart_get: ["p(95)<1500", "p(99)<3000"],
    latency_orders: ["p(95)<1500", "p(99)<3000"],
    latency_notifications: ["p(95)<1500", "p(99)<3000"],
    error_rate: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
  },
};

export function setup() {
  console.log("=== PERCENTILES TEST SETUP ===");
  console.log(`BASE_URL:    ${BASE_URL}`);
  console.log(
    `BUYER_JWT:   ${hasAuth ? "✅ set" : "❌ not set — auth endpoints skipped"}`,
  );
  console.log(
    `PRODUCT_ID:  ${hasProductId ? PRODUCT_ID : "❌ not set — product detail skipped"}`,
  );
  console.log("==============================\n");
}

function safeJson(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}

function track(res) {
  if (res.status >= 500) http_5xx.add(1);
  else if (res.status >= 400) http_4xx.add(1);
  else if (res.status >= 200) http_2xx.add(1);
  errorRate.add(res.status >= 400);
}

export default function () {
  // ── 1. Health ─────────────────────────────────────────────────────────────
  group("health", () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/health`);
    t_health.add(Date.now() - start);
    track(res);
    check(res, { "health 200": (r) => r.status === 200 });
  });

  sleep(0.3);

  // ── 2. Products ───────────────────────────────────────────────────────────
  group("products", () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/products?lat=${LAT}&lng=${LNG}&radius=10&page=1&limit=20`,
    );
    t_products.add(Date.now() - start);
    track(res);
    const body = safeJson(res);
    check(res, {
      "products 200": (r) => r.status === 200,
      "has products array": () => Array.isArray(body?.data?.products),
      "has meta": () => body?.data?.meta != null,
      "meta total is number": () => typeof body?.data?.meta?.total === "number",
    });
  });

  sleep(0.5);

  // ── 3. Product detail ─────────────────────────────────────────────────────
  if (hasProductId) {
    group("product_detail", () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/products/${PRODUCT_ID}`);
      t_product_detail.add(Date.now() - start);
      track(res);
      const body = safeJson(res);
      check(res, {
        "detail 200": (r) => r.status === 200,
        "detail success true": () => body?.success === true,
        "detail has product": () => body?.data != null,
        "detail has priceTiers": () => Array.isArray(body?.data?.priceTiers),
        "detail has pickupWindows": () =>
          Array.isArray(body?.data?.pickupWindows),
      });
    });
    sleep(0.3);
  }

  // ── 4. Deals ──────────────────────────────────────────────────────────────
  group("deals", () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/products/deals?lat=${LAT}&lng=${LNG}&radius=10`,
    );
    t_deals.add(Date.now() - start);
    track(res);
    const body = safeJson(res);
    check(res, {
      "deals 200": (r) => r.status === 200,
      "deals success true": () => body?.success === true,
      "deals has products": () => Array.isArray(body?.data?.products),
    });
  });

  sleep(0.3);

  // ── 5. Cart ───────────────────────────────────────────────────────────────
  if (hasAuth) {
    group("cart", () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/cart`, {
        headers: cookieHeader(BUYER_JWT),
      });
      t_cart_get.add(Date.now() - start);
      track(res);
      const body = res.status === 200 ? safeJson(res) : null;
      check(res, {
        "cart 200 or 401": (r) => r.status === 200 || r.status === 401,
        "cart success true": () => res.status !== 200 || body?.success === true,
        "cart has items array": () =>
          res.status !== 200 || Array.isArray(body?.data?.cart?.items),
      });
    });
    sleep(0.3);
  }

  // ── 6. Orders ─────────────────────────────────────────────────────────────
  if (hasAuth) {
    group("orders", () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/orders`, {
        headers: cookieHeader(BUYER_JWT),
      });
      t_orders.add(Date.now() - start);
      track(res);
      const body = res.status === 200 ? safeJson(res) : null;
      check(res, {
        "orders 200 or 401": (r) => r.status === 200 || r.status === 401,
        "orders success true": () =>
          res.status !== 200 || body?.success === true,
        "orders data is array": () =>
          res.status !== 200 || Array.isArray(body?.data),
        "orders meta exists": () => res.status !== 200 || body?.meta != null,
      });
    });
    sleep(0.3);
  }

  // ── 7. Notifications ──────────────────────────────────────────────────────
  if (hasAuth) {
    group("notifications", () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/notifications`, {
        headers: cookieHeader(BUYER_JWT),
      });
      t_notifications.add(Date.now() - start);
      track(res);
      const body = res.status === 200 ? safeJson(res) : null;
      check(res, {
        "notifs 200 or 401": (r) => r.status === 200 || r.status === 401,
        "notifs success true": () =>
          res.status !== 200 || body?.success === true,
        "notifs data is array": () =>
          res.status !== 200 || Array.isArray(body?.data),
      });
    });
  }

  sleep(1);
}

// ── Summary ────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const m = data.metrics;

  function row(label, key) {
    const metric = m[key];
    if (!metric)
      return `║ ${label.padEnd(25)} ║  N/A ║  N/A ║  N/A ║  N/A ║ N/A ║`;
    const v = metric.values;
    const p50 = fmtMs(v["p(50)"]);
    const p90 = fmtMs(v["p(90)"]);
    const p95 = fmtMs(v["p(95)"]);
    const p99 = fmtMs(v["p(99)"]);
    const max = fmtMs(v["max"]);
    return `║ ${label.padEnd(25)} ║ ${p50.padStart(4)} ║ ${p90.padStart(4)} ║ ${p95.padStart(4)} ║ ${p99.padStart(4)} ║ ${max.padStart(3)} ║`;
  }

  const lines = [
    "",
    "╔══════════════════════════════════════════════════════════════╗",
    "║          KRIDHA — RESPONSE TIME PERCENTILES (ms)            ║",
    "╠═══════════════════════════╦══════╦══════╦══════╦══════╦═════╣",
    "║ Endpoint                  ║  P50 ║  P90 ║  P95 ║  P99 ║ Max ║",
    "╠═══════════════════════════╬══════╬══════╬══════╬══════╬═════╣",
    row("health", "latency_health"),
    row("products", "latency_products"),
    row("product_detail", "latency_product_detail"),
    row("deals", "latency_deals"),
    row("cart", "latency_cart_get"),
    row("orders", "latency_orders"),
    row("notifications", "latency_notifications"),
    "╚═══════════════════════════╩══════╩══════╩══════╩══════╩═════╝",
    "",
    `Total Requests : ${m.http_reqs?.values?.count ?? 0}`,
    `Throughput     : ${(m.http_reqs?.values?.rate ?? 0).toFixed(2)} req/s`,
    `Error Rate     : ${((m.error_rate?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    `HTTP 2xx       : ${m.http_2xx_count?.values?.count ?? 0}`,
    `HTTP 4xx       : ${m.http_4xx_count?.values?.count ?? 0}`,
    `HTTP 5xx       : ${m.http_5xx_count?.values?.count ?? 0}`,
    `VUs Max        : ${m.vus_max?.values?.max ?? 0}`,
    "",
    hasAuth
      ? ""
      : "⚠  BUYER_JWT not set — cart/orders/notifications not tested",
    hasProductId ? "" : "⚠  PRODUCT_ID not set — product_detail not tested",
  ].filter((l) => l !== undefined);

  const report = lines.join("\n");
  console.log(report);

  return {
    "_tests_/results/01_percentiles.txt": report,
    "_tests_/results/01_percentiles.json": JSON.stringify(data, null, 2),
    stdout: "\n",
  };
}

function fmtMs(v) {
  if (v == null || v === 0) return "N/A";
  return Math.round(v).toString();
}
