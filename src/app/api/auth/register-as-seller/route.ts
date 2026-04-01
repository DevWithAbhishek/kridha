import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { RegisterAsSellerSchema } from "@/schemas";
import { authService } from "@/services/auth.service";

export async function POST(req: NextRequest) {
  try {
    const user = getUser(req);
    const body = RegisterAsSellerSchema.parse(await req.json());
    const result = await authService.registerAsSeller(user.userId, body);
    return NextResponse.json(
      {
        success: true,
        message: "Application submitted. Verification takes 12-48 hours.",
        data: result,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
