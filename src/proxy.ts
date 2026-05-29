import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { logger } from "@/lib/logger";
import { limiters } from "@/lib/rateLimiter";
import * as Sentry from "@sentry/nextjs";
import crypto from "crypto";

interface JwtPayload {
  userId: string;
  roles: string[];
}
interface AdminJwtPayload {
  adminId: string;
  role: string;
  type: "admin";
}

const PUBLIC_EXACT = new Set([
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/reset-pin-request",
  "/api/auth/reset-pin",
  "/api/auth/me",
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

// src/proxy.ts — reorder sections

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Cron — secret check first, no rate limiting needed
  if (pathname.startsWith("/api/cron/")) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) return unauthenticated();
    return NextResponse.next();
  }

  const isLoadTest = process.env.LOAD_TEST_MODE === "true";

  const ip = req.headers.get("x-real-ip") ?? "127.0.0.1";

  // 2. Admin routes — separate auth surface
  if (pathname.startsWith("/api/admin/")) {
    if (pathname === "/api/admin/auth/login") {
      try {
        const { success, remaining } = await limiters.adminAuthLimiter.limit(`admin_login:${ip}`);
        if (!success) {
          logger.warn({ event: "security.rate_limited", ip, path: pathname }, "admin rate limited");
          return rateLimited(remaining);
        }
      } catch (err) {
        logger.error({ err }, "Admin rate limiter failed");
      }
      return NextResponse.next();
    }

    const adminToken = req.cookies.get("kridha_admin")?.value;
    if (!adminToken) return unauthenticated();

    try {
      const payload = jwt.verify(adminToken, process.env.ADMIN_JWT_SECRET!, {
        algorithms: ["HS256"],
      }) as AdminJwtPayload;
      if (payload.type !== "admin") return unauthenticated();

      const headers = new Headers(req.headers);
      headers.set("x-admin-id", payload.adminId);
      headers.set("x-admin-role", payload.role);
      return NextResponse.next({ request: { headers } });
    } catch {
      logger.warn({ event: "security.admin_auth_failed", path: pathname }, "invalid admin token");
      return unauthenticated();
    }
  }

  // 3. Layer 1 — Per-IP rate limiting (ALL routes except webhook and cron)
  // Runs before PUBLIC_EXACT so login/signup are also IP-rate-limited
  if (!isLoadTest && pathname !== "/api/webhooks/razorpay") {
    const limiter =
      pathname === "/api/auth/refresh"
        ? limiters.refreshLimiter
        : AUTH_PATHS.has(pathname)
          ? limiters.authLimiter
          : limiters.generalLimiter;

    try {
      const { success, remaining } = await limiter.limit(
        `ip:${pathname}:${ip}`,
      );
      if (!success) {
        logger.warn(
          { event: "security.rate_limited_ip", ip, path: pathname, layer: 1 },
          "IP rate limited",
        );
        return rateLimited(remaining);
      }
    } catch (err) {
      logger.error(
        { err, path: pathname },
        "Rate limiter layer 1 failed — fail open",
      );
    }
  }

  // 4. Layer 2 — Per-account (login only, distributed stuffing prevention)
  if (!isLoadTest && pathname === "/api/auth/login" && req.method === "POST") {
    try {
      const body = await req
        .clone()
        .json()
        .catch(() => ({}));
      const phone = body?.phone as string | undefined;

      if (phone && typeof phone === "string") {
        const normalizedPhone = phone.replace(/\D/g, "");

        const accountKey =
          "account:" +
          crypto.createHash("sha256").update(normalizedPhone).digest("hex");
        const { success } = await limiters.accountLimiter.limit(accountKey);

        if (!success) {
          logger.warn(
            {
              event: "security.rate_limited_account",
              phoneTail: phone.slice(-4),
              ip,
              layer: 2,
            },
            "Account rate limited — possible credential stuffing",
          );

          Sentry.captureMessage(
            `Account rate limit: ${phone.slice(-4)} from ${ip}`,
            "warning",
          );
          return rateLimited(0);
        }
      }
    } catch (err) {
      logger.error({ err }, "Rate limiter layer 2 failed — fail open");
    }
  }

  // 5. Layer 3 — Global auth (resource exhaustion / DDoS prevention)
  if (!isLoadTest && AUTH_PATHS.has(pathname)) {
    try {
      const { success } = await limiters.globalAuthLimiter.limit("global:auth");
      if (!success) {
        logger.error(
          {
            event: "security.global_auth_rate_limited",
            ip,
            path: pathname,
            layer: 3,
          },
          "CRITICAL: global auth rate limit — possible DDoS",
        );

        Sentry.captureMessage(
          "Global auth rate limit exceeded — possible DDoS",
          "fatal",
        );
        return rateLimited(0);
      }
    } catch (err) {
      logger.error({ err }, "Rate limiter layer 3 failed — fail open");
    }
  }

  // 6. Public exact routes — pass through (auth handled above already)
  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next();

  // 7. Public GET — optional auth for INV-14 (seller feed exclusion)
  const isPublicGet =
    req.method === "GET" && PUBLIC_GET_PATTERNS.some(r => r.test(pathname));

  const token = req.cookies.get("kridha_access")?.value;

  if (isPublicGet) {
    if (!token) return NextResponse.next();
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!, {
        algorithms: ["HS256"],
      }) as JwtPayload;
      if (!payload?.userId) return NextResponse.next();
      return NextResponse.next();
    } catch {
      return NextResponse.next(); // invalid token on public route — pass through
    }
  }

  // 8. Protected routes — require valid kridha_access cookie
  if (!token) return unauthenticated();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
    }) as JwtPayload;
    if (!payload?.userId) return unauthenticated();
    return NextResponse.next();
  } catch {
    const refresh = req.cookies.get("kridha_refresh")?.value;
    if (refresh) {
      return NextResponse.redirect(new URL("/api/auth/refresh", req.url));
    }
    logger.warn({ event: "security.auth_failed", path: pathname }, "invalid user token");
    return unauthenticated();
  }
}

export const config = { matcher: ["/api/:path*"] };
