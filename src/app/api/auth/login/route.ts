import { NextRequest, NextResponse } from "next/server";
import { LoginSchema } from "@/schemas";
import { authService } from "@/services/auth.service";
import { handleError } from "@/lib/handleError";
import { setAuthCookies } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  try {
    const body = LoginSchema.parse(await req.json());
    const tokens = await authService.login(body);
    const response = NextResponse.json(
      { success: true, message: "Welcome back to Kridha" },
      { status: 200 },
    );

    setAuthCookies(response, tokens);
    return response;
  } catch (err) {
    return handleError(err);
  }
}
