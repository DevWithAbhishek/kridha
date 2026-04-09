import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { SignupSchema } from "@/schemas";
import { authService } from "@/services/auth.service";
import { withRetry } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = SignupSchema.parse(await req.json());
    // Wrap only the DB-touching service call
    await withRetry(() => authService.signup(body));
    return NextResponse.json(
      { success: true, message: "Account created. Login to continue." },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
