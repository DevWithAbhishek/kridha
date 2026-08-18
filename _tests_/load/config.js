// tests/load/config.js
// ── Shared config for all Kridha k6 tests ─────────────────────────────────
//
// How to run (Windows cmd):
//   Step 1 — Get test IDs:     npx tsx _tests_/scripts/get-test-ids.js
//   Step 2 — Get JWTs:         npx tsx _tests_/scripts/get-jwts.js 6834520708 9288110089
//   Step 3 — Run a test:
//     k6 run ^
//       -e BASE_URL=http://localhost:3000 ^
//       -e BUYER_JWT=eyJhbGc... ^
//       -e PRODUCT_ID=clxabc123 ^
//       -e PICKUP_WIN_ID=clxwin456 ^
//       -e WEBHOOK_SECRET=your-secret ^
//       _tests_/load/01_percentiles.js

export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
export const BUYER_JWT = __ENV.BUYER_JWT || "";
export const SELLER_JWT = __ENV.SELLER_JWT || "";
export const PRODUCT_ID = __ENV.PRODUCT_ID || "";
export const PRODUCT_ID_A = __ENV.PRODUCT_ID_A || "";
export const PRODUCT_ID_B = __ENV.PRODUCT_ID_B || "";
export const PICKUP_WIN_ID = __ENV.PICKUP_WIN_ID || "";
export const BUYER_PHONE = __ENV.BUYER_PHONE || "";
export const SELLER_PHONE = __ENV.SELLER_PHONE || "";
export const PIN = __ENV.PIN || "1234";

// Gorakhpur coordinates — matches seed data
export const LAT = "26.713";
export const LNG = "83.330";

// Must match RAZORPAY_WEBHOOK_SECRET in .env.local
export const WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || "";

// ── Header helpers ─────────────────────────────────────────────────────────

export function cookieHeader(jwt) {
  return { Cookie: `kridha_access=${jwt}` };
}

export function authJsonHeaders(jwt) {
  return {
    "Content-Type": "application/json",
    Cookie: `kridha_access=${jwt}`,
  };
}

export const JSON_HEADERS = { "Content-Type": "application/json" };

// ── Body helper ────────────────────────────────────────────────────────────

export function jsonBody(obj) {
  return JSON.stringify(obj);
}

// ── Date helpers ───────────────────────────────────────────────────────────

export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Validation ─────────────────────────────────────────────────────────────
// Call at the top of setup() in any test that needs these

export function requireEnv(names) {
  const envMap = {
    BUYER_JWT,
    SELLER_JWT,
    PRODUCT_ID,
    PICKUP_WIN_ID,
    BUYER_PHONE,
    SELLER_PHONE,
    WEBHOOK_SECRET,
  };
  const missing = names.filter((n) => !envMap[n]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(", ")}\n` +
        `Pass them with: -e VAR=value\n` +
        `Run: node tests/scripts/get-test-ids.js  (for IDs)\n` +
        `Run: node tests/scripts/get-jwts.js      (for JWTs)`,
    );
  }
}
