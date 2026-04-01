import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { ResetPinSchema } from "@/schemas";
import { authService } from "@/services/auth.service";

export async function POST(req: NextRequest) {
  try {
    const body = ResetPinSchema.parse(await req.json());
    await authService.resetPin(body);
    return NextResponse.json({
      success: true,
      message: "PIN reset successfully. Login to continue.",
    });
  } catch (err) {
    return handleError(err);
  }
}
