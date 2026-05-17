import { describe, it, expect } from "@jest/globals";

// The routes which need auth
const PROTECTED_ROUTES = [
  // Seller-only routes
  { method: "GET", path: "/api/products/mine", role: "SELLER" },
  { method: "POST", path: "/api/products", role: "SELLER" },
  { method: "GET", path: "/api/pickup-windows", role: "SELLER" },
  { method: "POST", path: "/api/pickup-windows", role: "SELLER" },
  { method: "GET", path: "/api/sellers/profile", role: "SELLER" },
  { method: "PATCH", path: "/api/sellers/profile", role: "SELLER" },

  // Buyer-only routes
  { method: "GET", path: "/api/cart", role: "BUYER" },
  { method: "POST", path: "/api/cart/checkout", role: "BUYER" },
  { method: "GET", path: "/api/saved", role: "BUYER" },

  // Any authenticated user
  { method: "GET", path: "/api/users/me", role: "ANY" },
  { method: "GET", path: "/api/orders", role: "ANY" },
  { method: "GET", path: "/api/notifications", role: "ANY" },

  // Admin only
  { method: "GET", path: "/api/admin/sellers", role: "ADMIN" },
  { method: "PATCH", path: "/api/admin/sellers/test-id", role: "ADMIN" },
];

const BASE = "http://localhost:3000";

describe("Access Control - unauthenticated requests", () => {
    for (const route of PROTECTED_ROUTES) {
        it(`${route.method} ${route.path} returns 401 without token`, async () => {
            const res = await fetch(`${BASE}${route.path}`, {
                method: route.method,
                headers: { "Content-Type": "application/json" },
                // No cookies - no auth token
            });
            expect(res.status).toBe(401);
        });
    }
});

describe("Access-Control - wrong role", () => {
    it("Buyer cannot access seller routes", async () => {
        // Login as Buyer, try seller route
        const loginRes = await fetch(`${BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: "9555419808", pin: "1234" }),
        });
        const cookie = loginRes.headers.get("set-cookie") ?? "";
        const sellerRes = await fetch(`${BASE}/api/products/mine`, {
            method: "GET",
            headers: { Cookie: cookie }
        });
        expect(sellerRes.status).toBe(403);
    });

    it("Seller cannot access admin routes", async () => {
        const loginRes = await fetch(`${BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: "9555419808", pin: "1234" }),
        });

        const cookie = loginRes.headers.get("set-cookie") ?? "";
        const adminRes = await fetch(`${BASE}/api/admin/sellers`, {
            method: "GET",
            headers: { Cookie: cookie }
        });

        expect(adminRes.status).toBe(403); // kridha_admin cookie missing
    })
})