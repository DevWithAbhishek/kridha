
// src/lib/adminCookies.ts
// kridha_admin cookie: separate name, path=/api/admin, 2h lifetime.
// Never conflicts with user cookies (kridha_access / kridha_refresh).

import { NextResponse } from "next/server";

const IS_PROD = process.env.NODE_ENV === "production";

export function setAdminCookie(res: NextResponse, token: string): void {
  res.cookies.set("kridha_admin", token, {
    httpOnly: true,
    secure:   IS_PROD,
    // sameSite: "strict",
    // path:     "/api/admin",  // only sent on /api/admin/* requests
    sameSite: 'lax',
    path: '/',
    maxAge:   60 * 60 * 2,  // 2 hours
  });
}

export function clearAdminCookie(res: NextResponse): void {
  res.cookies.set("kridha_admin", "", {
    maxAge: 0,
    path:   "/api/admin",
  });
}
