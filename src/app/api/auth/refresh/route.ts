// No body — browser sends kridha_refresh cookie automatically (path=/api/auth).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { tokenService } from "@/services/token.service";
import { setAuthCookies } from "@/lib/cookies";
import { ERR } from "@/lib/errors";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const raw = req.cookies.get("kridha_refresh")?.value;
    if (!raw) throw ERR.REFRESH_TOKEN_INVALID;

    const tokens = await tokenService.rotate(raw);

    // Read preferred lang for the new token's user
    const stored = await prisma.refreshToken.findFirst({
      where: { revoked: false },
      include: { user: { select: { preferredLang: true } } },
      orderBy: { createdAt: "desc" },
    });
    const lang = stored?.user?.preferredLang ?? "hi";

    const res = NextResponse.json({ success: true });
    setAuthCookies(res, tokens, lang);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
