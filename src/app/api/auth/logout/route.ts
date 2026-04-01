import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { tokenService } from "@/services/token.service";
import { clearAuthCookies } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  try {
    const raw = req.cookies.get("kridha_refresh")?.value;
    if (raw) await tokenService.revokeOne(raw);
    const res = NextResponse.json({ success: true, message: "Logged out." });
    clearAuthCookies(res);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
