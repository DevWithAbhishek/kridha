import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { CancelOrderSchema } from "@/schemas";
import { orderService } from "@/services/order.service";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getUser(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason } = CancelOrderSchema.parse(body);
    const result = await orderService.cancel(id, user.userId, reason);
    return NextResponse.json({
      success: true,
      data: {
        subOrder: { id, status: "CANCELLED" },
        refundAmount: result.refundAmount,
        refundStatus: result.refundStatus,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
