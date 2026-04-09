import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { LoginSchema } from "@/schemas";
import { authService } from "@/services/auth.service";
import { setAuthCookies } from "@/lib/cookies";
import { withRetry } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = LoginSchema.parse(await req.json());
    // Wrap only the DB-touching service call
    const result = await withRetry(() => authService.login(body));
    const res = NextResponse.json({
      success: true,
      data: { user: result.user },
    });
    setAuthCookies(res, result.tokens, result.user.preferredLang);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
