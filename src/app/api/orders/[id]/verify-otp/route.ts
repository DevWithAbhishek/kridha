import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { VerifyOtpSchema } from "@/schemas";
import { paymentService } from "@/services/payment.service";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(req, Role.SELLER);
    const { id } = await params;
    const body = VerifyOtpSchema.parse(await req.json());
    const result = await paymentService.verifyOtp(id, user.userId, body.otp);
    return NextResponse.json({
      success: true,
      data: {
        id: result.subOrder.id,
        shortId: result.subOrder.shortId,
        status: "COMPLETED",
      },
      payoutId: result.payoutId,
    });
  } catch (err) {
    return handleError(err);
  }
}
