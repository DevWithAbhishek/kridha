// No body — browser sends kridha_refresh cookie automatically (path=/api/auth).
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { tokenService } from "@/services/token.service";
import { setAuthCookies } from "@/lib/cookies";
import { ERR } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const raw = req.cookies.get("kridha_refresh")?.value;
    if (!raw) throw ERR.REFRESH_TOKEN_INVALID;
    const ip =
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      "unknown";
    const { lang, accessToken, refreshToken } =
      await tokenService.rotateTokens(raw, ip); // Read preferred lang for the new token's user
    const res = NextResponse.json({ success: true });
    setAuthCookies(res, { accessToken, refreshToken }, lang);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
