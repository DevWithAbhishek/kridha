import { clearAuthCookies, setAuthCookies } from "@/lib/cookies";
import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { RegisterAsSellerSchema } from "@/schemas";
import { authService } from "@/services/auth.service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    // Revoke all tokens for the user
    const body = RegisterAsSellerSchema.parse(req.json());
    const tokens = await authService.registerAsSeller(user.userId, body);

    const response = NextResponse.json({ success: true }, { status: 201 });
    clearAuthCookies(response);
    setAuthCookies(response, tokens);
    return response;
  } catch (err) {
    handleError(err);
  }
}
