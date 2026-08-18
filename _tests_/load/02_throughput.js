// tests/load/02_throughput.js
// ── TEST 2: Throughput + Error Rate ────────────────────────────────────────
// Ramps from 10 → 100 → 500 VUs. Measures req/s and error breakdown.
// Run: k6 run -e BASE_URL=http://localhost:3000 _tests_/load/02_throughput.js

import http    from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter, Trend } from "k6/metrics";
import { BASE_URL, LAT, LNG, BUYER_JWT, cookieHeader } from "./config.js";

// ── Metrics ────────────────────────────────────────────────────────────────
const errorRate   = new Rate("error_rate");
const successRate = new Rate("success_rate");
const http_5xx    = new Counter("http_5xx_count");
const http_4xx    = new Counter("http_4xx_count");
const http_2xx    = new Counter("http_2xx_count");
const timeoutCnt  = new Counter("timeout_count");
const rtt         = new Trend("rtt_all_endpoints");

// ── Weighted endpoint pool ─────────────────────────────────────────────────
// Mirrors realistic Kridha traffic distribution
const ENDPOINTS = [
  // weight 40 — product feed (most common action)
  { url: () => `${BASE_URL}/api/products?lat=${LAT}&lng=${LNG}&radius=10`,        weight: 40, auth: false },
  // weight 25 — deals
  { url: () => `${BASE_URL}/api/products/deals?lat=${LAT}&lng=${LNG}&radius=10`,  weight: 25, auth: false },
  // weight 10 — health
  { url: () => `${BASE_URL}/api/health`,                                           weight: 10, auth: false },
  // weight 15 — orders (auth)
  { url: () => `${BASE_URL}/api/orders`,                                           weight: 15, auth: true  },
  // weight 10 — notifications (auth)
  { url: () => `${BASE_URL}/api/notifications`,                                    weight: 10, auth: true  },
];

function pickEndpoint() {
  const total = ENDPOINTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of ENDPOINTS) { r -= e.weight; if (r <= 0) return e; }
  return ENDPOINTS[0];
}

// ── Test stages ────────────────────────────────────────────────────────────
export let options = {
  stages: [
    { duration: "30s", target: 10  },  // warm-up
    { duration: "1m",  target: 100 },  // ramp: 10→100
    { duration: "3m",  target: 100 },  // hold 100 VUs → record throughput@100
    { duration: "1m",  target: 300 },  // ramp: 100→300
    { duration: "3m",  target: 300 },  // hold 300 VUs → record throughput@300
    { duration: "1m",  target: 500 },  // ramp: 300→500
    { duration: "3m",  target: 500 },  // hold 500 VUs → record throughput@500
    { duration: "30s", target: 0   },  // cool down
  ],
  thresholds: {
    "error_rate":        ["rate<0.01"],   // < 1% errors
    "http_req_duration": ["p(95)<500"],   // P95 < 500ms
    "http_req_failed":   ["rate<0.01"],
    "http_5xx_count":    ["count<20"],    // < 20 server errors total
    "timeout_count":     ["count<5"],
  },
};

export default function () {
  const ep = pickEndpoint();
  const headers = ep.auth && BUYER_JWT ? cookieHeader(BUYER_JWT) : {};
  const timeout = "10s";

  const start = Date.now();
  const res = http.get(ep.url(), { headers, timeout });
  const ms = Date.now() - start;

  rtt.add(ms);
  const ok = res.status >= 200 && res.status < 400;
  errorRate.add(!ok);
  successRate.add(ok);

  if (res.status >= 500)      http_5xx.add(1);
  else if (res.status >= 400) http_4xx.add(1);
  else if (res.status >= 200) http_2xx.add(1);
  if (ms >= 10000)            timeoutCnt.add(1);

  check(res, {
    "not 500":     r => r.status !== 500,
    "not timeout": () => ms < 10000,
  });

  sleep(Math.random() * 1.5 + 0.5); // 0.5–2s think time
}

export function handleSummary(data) {
  const m   = data.metrics;
  const rps = (m.http_reqs?.values?.rate ?? 0).toFixed(2);
  const dur = m.http_req_duration?.values;

  const report = `
╔══════════════════════════════════════════════════════╗
║          KRIDHA — THROUGHPUT & ERROR REPORT          ║
╠══════════════════════════════════════════════════════╣
║ THROUGHPUT                                           ║
║   Total Requests : ${String(m.http_reqs?.values?.count ?? 0).padEnd(33)}║
║   Req/sec (avg)  : ${String(rps + " req/s").padEnd(33)}║
║   VUs Max        : ${String(m.vus_max?.values?.max ?? 0).padEnd(33)}║
╠══════════════════════════════════════════════════════╣
║ RESPONSE TIMES (all endpoints)                       ║
║   Min  : ${String((dur?.min ?? 0).toFixed(0) + "ms").padEnd(43)}║
║   Avg  : ${String((dur?.avg ?? 0).toFixed(0) + "ms").padEnd(43)}║
║   P50  : ${String((dur?.["p(50)"] ?? 0).toFixed(0) + "ms").padEnd(43)}║
║   P90  : ${String((dur?.["p(90)"] ?? 0).toFixed(0) + "ms").padEnd(43)}║
║   P95  : ${String((dur?.["p(95)"] ?? 0).toFixed(0) + "ms").padEnd(43)}║
║   P99  : ${String((dur?.["p(99)"] ?? 0).toFixed(0) + "ms").padEnd(43)}║
║   Max  : ${String((dur?.max ?? 0).toFixed(0) + "ms").padEnd(43)}║
╠══════════════════════════════════════════════════════╣
║ STATUS CODE BREAKDOWN                                ║
║   HTTP 2xx : ${String(m.http_2xx_count?.values?.count ?? 0).padEnd(39)}║
║   HTTP 4xx : ${String(m.http_4xx_count?.values?.count ?? 0).padEnd(39)}║
║   HTTP 5xx : ${String(m.http_5xx_count?.values?.count ?? 0).padEnd(39)}║
║   Timeouts : ${String(m.timeout_count?.values?.count ?? 0).padEnd(39)}║
║   Error %  : ${String(((m.error_rate?.values?.rate ?? 0) * 100).toFixed(2) + "%").padEnd(39)}║
║   Success %: ${String(((m.success_rate?.values?.rate ?? 1) * 100).toFixed(2) + "%").padEnd(39)}║
╚══════════════════════════════════════════════════════╝`;

  console.log(report);
  return {
    "_tests_/results/02_throughput.txt":  report,
    "_tests_/results/02_throughput.json": JSON.stringify(data, null, 2),
    stdout: "\n",
  };
}
