// Replaces the previous version. Rate limiting added before auth check.
// Auth endpoints: 5 req/min per IP. All other: 60 req/min per IP.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

interface JwtPayload {
  userId: string;
  roles: string[];
}
interface AdminJwtPayload {
  adminId: string;
  role: string;
  type: "admin";
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Two limiters — tighter for auth endpoints to slow brute-force
const generalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: false,
});

const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: false,
});

// Admin login is rate-limited the hardest — 2 attempts per minute per IP
const adminAuthLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, "1 m"),
  analytics: false,
});

const PUBLIC_EXACT = new Set([
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/reset-pin-request",
  "/api/auth/reset-pin",
  "/api/health",
  "/api/webhooks/razorpay",
  "/api/pincode",
  "/api/admin/auth/login", // admin login is public (has its own limiter)
]);

const PUBLIC_GET_PATTERNS = [
  /^\/api\/products(\/[^\/]+)?$/,
  /^\/api\/products\/deals$/,
  /^\/api\/reviews$/,
];

const AUTH_PATHS = new Set([
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/reset-pin-request",
  "/api/auth/reset-pin",
]);

function unauthenticated() {
  return NextResponse.json(
    {
      success: false,
      code: "UNAUTHENTICATED",
      message: "Please login to continue.",
    },
    { status: 401 },
  );
}

function rateLimited(remaining: number) {
  return NextResponse.json(
    {
      success: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Try again later.",
    },
    { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } },
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Cron endpoints — Bearer CRON_SECRET only
  if (pathname.startsWith("/api/cron/")) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return unauthenticated();
    }
    return NextResponse.next();
  }

  // ── Admin routes: /api/admin/* ─────────────────────────────────────────
  // Handled BEFORE user auth — completely separate path.
  if (pathname.startsWith("/api/admin/")) {
    // Admin login route: rate limit hard, then pass through (no token needed)
    if (pathname === "/api/admin/auth/login") {
      const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
      try {
        const { success, remaining } = await adminAuthLimiter.limit(
          `admin_login:${ip}`,
        );
        if (!success) {
          logger.warn({ ip, path: pathname }, "Admin login rate limited");
          return rateLimited(remaining);
        }
      } catch (err) {
        logger.error({ err }, "Admin rate limiter failed");
      }
      return NextResponse.next();
    }

    // All other /api/admin/* routes: verify kridha_admin cookie
    const adminToken = req.cookies.get("kridha_admin")?.value;
    if (!adminToken) return unauthenticated();

    try {
      const payload = jwt.verify(
        adminToken,
        process.env.ADMIN_JWT_SECRET!,
      ) as AdminJwtPayload;

      // type guard — reject user tokens even if somehow signed with same secret
      if (payload.type !== "admin") return unauthenticated();

      const headers = new Headers(req.headers);
      headers.set("x-admin-id", payload.adminId);
      headers.set("x-admin-role", payload.role);
      return NextResponse.next({ request: { headers } });
    } catch {
      return unauthenticated();
    }
  }

  // Fully public routes
  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next();

  // Rate limiting — applied to all routes except webhooks (Razorpay must never be 429'd)
  if (pathname !== "/api/webhooks/razorpay") {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const limiter = AUTH_PATHS.has(pathname) ? authLimiter : generalLimiter;
    try {
      const { success, remaining } = await limiter.limit(ip);
      if (!success) {
        return NextResponse.json(
          {
            success: false,
            code: "RATE_LIMITED",
            message: "Too many requests. Try again later.",
          },
          {
            status: 429,
            headers: { "X-RateLimit-Remaining": String(remaining) },
          },
        );
      }
    } catch (err) {
      logger.error({ err, path: pathname }, "Rate limiter failed");
    }
  }

  // Public GET — optional auth (for INV-14 seller exclusion)
  const isPublicGet =
    req.method === "GET" && PUBLIC_GET_PATTERNS.some((r) => r.test(pathname));

  // Extract token
  const token = req.cookies.get("kridha_access")?.value;

  if (isPublicGet) {
    if (!token) return NextResponse.next();
    if (token) {
      try {
        const payload = jwt.verify(
          token,
          process.env.JWT_SECRET!,
        ) as JwtPayload;
        const headers = new Headers(req.headers);
        headers.set("x-user-id", payload.userId);
        headers.set("x-user-roles", JSON.stringify(payload.roles));
        return NextResponse.next({ request: { headers } });
      } catch {
        return NextResponse.next();
      }
    }
  }

  // Protected — require valid access token
  if (!token) {
    return unauthenticated();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    const headers = new Headers(req.headers);
    headers.set("x-user-id", payload.userId);
    headers.set("x-user-roles", JSON.stringify(payload.roles));
    return NextResponse.next({ request: { headers } });
  } catch {
    // try refresh
    const refresh = req.cookies.get("kridha_refresh")?.value;
    if (refresh) {
      return NextResponse.redirect(new URL("/api/auth/refresh", req.url));
    }
    return unauthenticated();
  }
}

export const config = { matcher: ["/api/:path*"] };
