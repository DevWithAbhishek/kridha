
// src/app/api/admin/auth/logout/route.ts

import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/adminCookies";

export async function POST() {
  const res = NextResponse.json({ success: true });
  clearAdminCookie(res);
  return res;
}
