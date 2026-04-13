
// src/app/api/admin/auth/login/route.ts
// Public — no admin cookie needed. Rate limited to 2/min in middleware.

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { AdminLoginSchema } from "@/schemas/admin.schemas";
import { adminService } from "@/services/admin.service";
import { setAdminCookie } from "@/lib/adminCookies";

export async function POST(req: NextRequest) {
  try {
    const ip   = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const body = AdminLoginSchema.parse(await req.json());
    const { token, admin } = await adminService.login(body, ip);
    const res = NextResponse.json({ success: true, data: { admin } });
    setAdminCookie(res, token);
    console.log("Admin Cookie: ", res.cookies.get("kridha_admin"));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
