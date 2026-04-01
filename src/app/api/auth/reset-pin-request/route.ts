import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { ResetPinRequestSchema } from "@/schemas";
import { authService } from "@/services/auth.service";

export async function POST(req: NextRequest) {
  try {
    const body = ResetPinRequestSchema.parse(await req.json());
    await authService.resetPinRequest(body);
    return NextResponse.json({
      success: true,
      message: "OTP sent to your registered mobile number.",
    });
  } catch (err) {
    return handleError(err);
  }
}
