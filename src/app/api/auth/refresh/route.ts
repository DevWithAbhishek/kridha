import { setAuthCookies } from "@/lib/cookies";
import { ERR } from "@/lib/errors";
import { handleError } from "@/lib/handleError";
import { tokenService } from "@/services/token.service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const rawToken = req.cookies.get("kridha_refresh")?.value;
    if (!rawToken) throw ERR.REFRESH_TOKEN_INVALID;

    const tokens = await tokenService.rotateTokens(rawToken);
    const response = NextResponse.json({ success: true }, { status: 200 });
    setAuthCookies(response, tokens);
    return response;
  } catch (err) {
    return handleError(err);
  }
}
