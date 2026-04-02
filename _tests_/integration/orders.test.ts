// Supertest against live dev server.
// Requires: TEST_BASE_URL + seeded test product + two buyer tokens.
// Run: npm run test:integration
// ─────────────────────────────────────────────────────────────────────────────

import request from "supertest";
import crypto from "crypto";
import { prisma } from "@/lib/db";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

function makeHmac(body: string): string {
  return crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET ?? "test-secret")
    .update(body)
    .digest("hex");
}

// Helper: login and return access token cookie string
async function loginAndGetCookie(phone: string, pin: string): Promise<string> {
  const res = await request(BASE_URL)
    .post("/api/auth/login")
    .send({ phone, pin });
  const raw = res.headers["set-cookie"];

  const setCookie = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? [raw]
      : [];
  const access = setCookie?.find((c) => c.startsWith("kridha_access="));
  if (!access) throw new Error(`Login failed for ${phone}`);
  return access.split(";")[0]; // just "kridha_access=<token>"
}

describe("POST /api/orders — concurrent inventory", () => {
  it("exactly one 201 and one 409 when two buyers order the last item", async () => {
    const productId = process.env.TEST_PRODUCT_ID!;
    const pickupWindowId = process.env.TEST_WINDOW_ID!;
    const pickupDate = new Date(Date.now() + 2 * 24 * 3_600_000).toISOString();

    const [cookie1, cookie2] = await Promise.all([
      loginAndGetCookie("9876540010", "1234"),
      loginAndGetCookie("9876540011", "1234"),
    ]);

    const payload = {
      items: [{ productId, quantity: 1, pickupWindowId, pickupDate }],
    };

    const [r1, r2] = await Promise.all([
      request(BASE_URL)
        .post("/api/orders")
        .set("Cookie", cookie1)
        .send(payload),
      request(BASE_URL)
        .post("/api/orders")
        .set("Cookie", cookie2)
        .send(payload),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failed = [r1, r2].find((r) => r.status === 409)!;
    expect(failed.body.code).toBe("INSUFFICIENT_STOCK");

    // INV-01: available must be exactly 0, never negative
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    expect(Number(product!.available)).toBe(0);
  }, 15_000);
});

describe("POST /api/webhooks/razorpay — idempotency", () => {
  it("processes first event, ignores exact duplicate (INV-03)", async () => {
    const paymentId = "pay_test_idem_" + Date.now();
    const body = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: { entity: { id: paymentId, order_id: "order_no_match" } },
      },
    });
    const sig = makeHmac(body);

    const sendWebhook = () =>
      request(BASE_URL)
        .post("/api/webhooks/razorpay")
        .set("x-razorpay-signature", sig)
        .set("content-type", "application/json")
        .send(body);

    const [r1, r2] = await Promise.all([sendWebhook(), sendWebhook()]);

    // Both must return 200 — Razorpay never retries on 200
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    // WebhookLog has exactly one entry — idempotency enforced
    const logs = await prisma.webhookLog.findMany({
      where: { razorpayPaymentId: paymentId },
    });
    expect(logs.length).toBe(1);
  }, 10_000);
});

describe("POST /api/auth/login", () => {
  it("sets HttpOnly cookies on success", async () => {
    const res = await request(BASE_URL)
      .post("/api/auth/login")
      .send({ phone: "9876540099", pin: "1234" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.roles).toContain("BUYER");

    const raw = res.headers["set-cookie"];

    const cookies = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? [raw]
        : [];
    expect(
      cookies.some(
        (c) => c.includes("kridha_access") && c.includes("HttpOnly"),
      ),
    ).toBe(true);
    expect(
      cookies.some(
        (c) => c.includes("kridha_refresh") && c.includes("HttpOnly"),
      ),
    ).toBe(true);
    // kridha_lang must NOT be HttpOnly (next-intl reads it)
    expect(
      cookies.some((c) => c.includes("kridha_lang") && !c.includes("HttpOnly")),
    ).toBe(true);
  });
});

describe("GET /api/products — public access", () => {
  it("returns products with distance_km without auth token", async () => {
    const res = await request(BASE_URL).get(
      "/api/products?lat=26.8467&lng=80.9462&radius=10",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.products).toBeInstanceOf(Array);
    if (res.body.data.products.length > 0) {
      expect(typeof res.body.data.products[0].distance_km).toBe("number");
    }
  });
});
