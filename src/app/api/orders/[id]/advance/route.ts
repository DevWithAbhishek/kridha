import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { releaseExpiredHoldsForProduct } from "@/lib/expiry";
import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { paymentService } from "@/services/payment.service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser(req);
    const { id } = await params;

    const sub = await prisma.subOrder.findUnique({
      where: { id },
      include: { order: true, payments: true },
    });

    if (!sub) throw ERR.SUBORDER_NOT_FOUND;

    // If PENDING and payment window expired — auto-cancel and tell frontend
    const isExpired =
      sub.status === "PENDING" &&
      sub.createdAt < new Date(Date.now() - 15 * 60_000) &&
      !sub.payments.some((p) => p.status === "PAID");

    if (isExpired) {
      // Cancel  and Release stock
      // await releaseExpiredHoldsForProduct(
      //   (
      //     await prisma.orderItem.findFirst({
      //       where: { subOrderId: id },
      //     })
      //   )?.productId ?? "",
      // ).catch(() => {});

      // Return a specific code so frontend can redirect to Product Page
      return NextResponse.json(
        {
          success: false,
          code: "ORDER_EXPIRED",
          message: "PAyment window expired. Please place a new order",
        },
        { status: 410 }, // 410 Gone - resource no longer valid
      );
    }

    const result = await paymentService.createAdvance(id, user.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleError(err);
  }
}
