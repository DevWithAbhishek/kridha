import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
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
    const result = await paymentService.requestPaymentLink(id, user.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleError(err);
  }
}
