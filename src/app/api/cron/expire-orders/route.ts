// Expire PENDING SubOrders where advance was never paid (15 min timeout)
// Restores stock for each item

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
  // Keep Neon compute warm — belt + suspenders alongside cron-job.org
  await prisma.$queryRaw`SELECT 1`;
  const cutoff = new Date(Date.now() - 15 * 60_000);

  const stale = await prisma.subOrder.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      razorpayAdvanceId: null,
    },
    include: { orderItems: true },
  });

  let expired = 0;

  for (const sub of stale) {
    await prisma.$transaction([
      prisma.subOrder.update({
        where: { id: sub.id },
        data: { status: "CANCELLED" },
      }),
      prisma.orderStatusHistory.create({
        data: {
          subOrderId: sub.id,
          orderId: sub.orderId,
          fromStatus: "PENDING",
          toStatus: "CANCELLED",
          note: "Auto-expired: advance not paid within 15 minutes",
        },
      }),
      // Restore stock for each order item (INV-01)
      ...sub.orderItems.map((oi: { productId: string; quantity: number }) =>
        prisma.product.update({
          where: { id: oi.productId },
          data: { available: { increment: oi.quantity } },
        }),
      ),
    ]);
    expired++;
  }

  console.log(
    `[CRON] expire-orders: ${expired} SubOrders cancelled, stock restored`,
  );
  return NextResponse.json({ expired });
}
