// tests/load/04_webhook_idempotency.js
// ── TEST 4: Webhook Idempotency Stress Test ────────────────────────────────
// Sends 100 identical Razorpay webhooks concurrently.
// ALL must return 200. DB must have exactly 1 WebhookLog row.
// Proves @unique constraint + prisma.$transaction() guarantees exactly-once.
//
// Run: k6 run -e BASE_URL=http://localhost:3000 -e WEBHOOK_SECRET=a7F9xQ2mLp8VzK4nRw1TcY6uHb3JeD4s _tests_/load/04_webhook_idempotency.js

import http    from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import crypto   from "k6/crypto";
import { BASE_URL, WEBHOOK_SECRET, JSON_HEADERS } from "./config.js";

const ok_count     = new Counter("webhook_200");
const error_count  = new Counter("webhook_error");

// Fixed payment ID — same for all 100 concurrent requests
// Use a timestamp so re-runs don't conflict with previous runs
const PAYMENT_ID = `pay_idem_test_${Date.now()}`;
const ORDER_ID   = `order_idem_test_${Date.now()}`;

export let options = {
  scenarios: {
    idempotency: {
      executor:    "shared-iterations",
      vus:          100,
      iterations:   100,  // 100 concurrent identical webhook deliveries
      maxDuration: "30s",
    },
  },
  thresholds: {
    "webhook_error":     ["count==0"],  // ZERO non-200 responses
    "http_req_failed":   ["rate==0"],
  },
};

function makePayload() {
  return JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id:       PAYMENT_ID,
          order_id: ORDER_ID,
          amount:   50000,
          currency: "INR",
          status:   "captured",
          method:   "upi",
          fee:      100,
          tax:      18,
        },
      },
    },
  });
}

function sign(body) {
  return crypto.hmac("sha256", WEBHOOK_SECRET, body, "hex");
}

export function setup() {
  console.log("=== WEBHOOK IDEMPOTENCY TEST ===");
  console.log(`Payment ID: ${PAYMENT_ID}`);
  console.log(`Order ID:   ${ORDER_ID}`);
  console.log("Sending 100 identical webhooks simultaneously");
  console.log("Expected: 100 × 200 OK, DB: WebhookLog COUNT = 1");
  console.log("================================\n");
}

export default function () {
  const body = makePayload();
  const sig  = sign(body);

  const res = http.post(
    `${BASE_URL}/api/webhooks/razorpay`,
    body,
    {
      headers: {
        ...JSON_HEADERS,
        "x-razorpay-signature": sig,
      },
    }
  );

  const ok = check(res, {
    "status 200":    r => r.status === 200,
    "received true": r => {
      try { return JSON.parse(r.body).received === true; }
      catch { return false; }
    },
  });

  if (ok) ok_count.add(1);
  else    error_count.add(1);
}

export function teardown() {
  console.log("\n=== VERIFY IN DB ===");
  console.log(`SELECT COUNT(*) FROM "WebhookLog" WHERE "razorpayPaymentId" = '${PAYMENT_ID}';`);
  console.log("Must return: 1 (not 100)");
  console.log(`\nSELECT COUNT(*) FROM "Payment" WHERE "razorpayPaymentId" = '${PAYMENT_ID}';`);
  console.log("Must return: 1");
}

export function handleSummary(data) {
  const m       = data.metrics;
  const ok      = m.webhook_200?.values?.count ?? 0;
  const errors  = m.webhook_error?.values?.count ?? 0;
  const passed  = errors === 0;

  const report = `
=== WEBHOOK IDEMPOTENCY RESULTS ===
Status:            ${passed ? "✅ PASSED" : "❌ FAILED"}

Total webhooks:    100
HTTP 200 received: ${ok}      (expected: 100)
Non-200 received:  ${errors}  (expected: 0)

Verify in DB (run after test):
  SELECT COUNT(*) FROM "WebhookLog"
  WHERE "razorpayPaymentId" = '${PAYMENT_ID}';
  Must return: 1

  SELECT COUNT(*) FROM "Payment"
  WHERE "razorpayPaymentId" = '${PAYMENT_ID}';
  Must return: 1

Payment ID tested: ${PAYMENT_ID}
=====================================`;

  console.log(report);
  return {
    "_tests_/results/04_webhook_idempotency.txt":  report,
    "_tests_/results/04_webhook_idempotency.json": JSON.stringify(data, null, 2),
    stdout: "\n",
  };
}
