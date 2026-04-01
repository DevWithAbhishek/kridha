import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { tokenService } from "@/services/token.service";
import { clearAuthCookies } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  try {
    const user = getUser(req);
    await tokenService.revokeAll(user.userId);
    const res = NextResponse.json({
      success: true,
      message: "Logged out from all devices.",
    });
    clearAuthCookies(res);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
