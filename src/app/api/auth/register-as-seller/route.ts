import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { RegisterAsSellerSchema } from "@/schemas";
import { authService } from "@/services/auth.service";
import { setAuthCookies } from "@/lib/cookies";
import { tokenService } from "@/services/token.service";

export async function POST(req: NextRequest) {
  try {
    const user = getUser(req);
    const body = RegisterAsSellerSchema.parse(await req.json());
    const result = await authService.registerAsSeller(user.userId, body);
    const updatedUser = await authService.getUpdatedUser(user.userId);

    // Revoke old token family, issue new tokens with updated roles
    await tokenService.revokeAll(user.userId);
    const tokens = await tokenService.issueTokens(
      user.userId,
      updatedUser!.roles,
    );

    const res = NextResponse.json(
      { success: true, message: "Application submitted.", data: result },
      { status: 201 },
    );
    setAuthCookies(res, tokens, updatedUser!.preferredLang ?? "hi");
    return res;
  } catch (err) {
    return handleError(err);
  }
}
