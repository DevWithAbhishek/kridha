import { clearAuthCookies } from "@/lib/cookies";
import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { tokenService } from "@/services/token.service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const user = getUser(req);
    // Revoke all tokens for the user
    await tokenService.revokeAll(user.userId);

    const response = NextResponse.json(
      { success: true, message: "Logged out from all devices successfully" },
      { status: 200 },
    );
    clearAuthCookies(response);
    return response;
  } catch (err) {
    handleError(err);
  }
}
