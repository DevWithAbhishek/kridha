import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { LoginSchema } from "@/schemas";
import { authService } from "@/services/auth.service";
import { setAuthCookies } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  try {
    const body = LoginSchema.parse(await req.json());
    const result = await authService.login(body);
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
