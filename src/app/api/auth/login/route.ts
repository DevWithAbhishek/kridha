import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { LoginSchema } from "@/schemas";
import { authService } from "@/services/auth.service";
import { setAuthCookies } from "@/lib/cookies";
import { withLogger } from "@/lib/withLogger";
import { toast } from "@/lib/toastNotifications";

export const POST = withLogger(async (req: NextRequest) => {
  try {
    const body = LoginSchema.parse(await req.json());
    const ip = req.headers.get("x-real-ip") ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "";
    // Wrap only the DB-touching service call
    const result = await authService.login(body, ip, ua);
    const res = NextResponse.json({
      success: true,
      data: { user: result.user },
    });
    setAuthCookies(res, result.tokens, result.user.preferredLang);
    return res;
  } catch (err) {
    return handleError(err);
  }
}, "auth.login");
