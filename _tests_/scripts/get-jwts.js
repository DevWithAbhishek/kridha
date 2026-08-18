// tests/scripts/get-jwts.js
// Gets real JWTs by calling your auth API
// Run AFTER get-test-ids.js
// Usage: node _tests_/scripts/get-jwts.js

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BUYER_PHONE = process.env.BUYER_PHONE || process.argv[2];
const SELLER_PHONE = process.env.SELLER_PHONE || process.argv[3];
const PIN = "1234";

async function login(phone, pin) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, pin }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed for ${phone}: ${res.status} ${body}`);
  }

  // Extract JWT from Set-Cookie header
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/kridha_access=([^;]+)/);
  if (!match) throw new Error(`No kridha_access cookie for ${phone}`);
  return match[1];
}

async function main() {
  if (!BUYER_PHONE || !SELLER_PHONE) {
    console.error(
      "Usage: BUYER_PHONE=+91xxx SELLER_PHONE=+91xxx node get-jwts.js",
    );
    console.error("Or:    node get-jwts.js +91buyer +91seller");
    process.exit(1);
  }

  console.log(`Logging in buyer:  ${BUYER_PHONE}`);
  const buyerJwt = await login(BUYER_PHONE, PIN);

  console.log(`Logging in seller: ${SELLER_PHONE}`);
  const sellerJwt = await login(SELLER_PHONE, PIN);

  console.log("\n=== JWTs (valid for 15 min — re-run if expired) ===");
  console.log(`set BUYER_JWT=${buyerJwt}`);
  console.log(`set SELLER_JWT=${sellerJwt}`);
  console.log("\nPaste these into run-all.cmd");
}

main().catch(console.error);
