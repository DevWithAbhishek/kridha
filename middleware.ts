import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { JwtPayload } from "@/services/token.service";

// Completely public — no token needed, not even optional
const PUBLIC_EXACT = new Set([
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/reset-pin-request",
  "/api/auth/reset-pin",
  "/api/health",
  "/api/webhooks/razorpay",
]);

const PUBLIC_GET = [
  /^\/api\/products(\/[^\/]+)?$/,
  /^\/api\/products\/deals$/,
  /^\/api\/reviews$/,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // Cron endpoints — verify CRON_SECRET
  if (pathname.startsWith("/api/cron/")) {
    const auth = req.headers.get("authorization");
    // if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    //   }
    if (!auth?.startsWith("Bearer "))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = auth.slice(7);

    if (token !== process.env.CRON_SECRET)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  // Fully public route
  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next();

  // Public GET — try to attach user but never reject
  const isPublicGet =
    method === "GET" && PUBLIC_GET.some((r) => r.test(pathname));

  const token = req.cookies.get("kridha_access")?.value;

  if (isPublicGet) {
    if (token) {
      try {
        const payload = jwt.verify(
          token,
          process.env.JWT_SECRET!,
        ) as JwtPayload;
        const h = new Headers(req.headers);
        h.set("x-user-id", payload.userId);
        h.set("x-user-roles", JSON.stringify(payload.roles));
        return NextResponse.next({ request: { headers: h } });
      } catch {}
    }
    return NextResponse.next();
  }

  // Protected route — reject if no valid token
  if (!token) {
    return NextResponse.json(
      {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Please login to continue.",
      },
      { status: 401 },
    );
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    const h = new Headers(req.headers);
    h.set("x-user-id", payload.userId);
    h.set("x-user-roles", JSON.stringify(payload.roles));
    return NextResponse.next({ request: { headers: h } });
  } catch {
    return NextResponse.json(
      {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Please login to continue.",
      },
      { status: 401 },
    );
  }
}

export const config = { matcher: ["/api/:path*"] };
