import { prisma } from "@/lib/db";
import { logger } from "./logger";

//Release expired PENDING orders for a specific product
export async function releaseExpiredHoldsForProduct(
  productId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60_000);

  const stale = await prisma.subOrder.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      payments: { none: { status: "PAID" } },
      orderItems: { some: { productId } }, //only this product
    },
    include: {
      orderItems: { where: { productId } }, //only relevant items
    },
  });

  if (!stale.length) return;

  await Promise.all(
    stale.map((sub) =>
      prisma.$transaction([
        prisma.subOrder.update({
          where: { id: sub.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: "Auto-expired: payment timeout",
          },
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
        ...sub.orderItems.map((item) =>
          prisma.product.update({
            where: { id: item.productId },
            data: {
              available: { increment: item.quantity },
            },
          }),
        ),
      ]).catch((err) => 
        logger.warn({err, subOrderId: sub.id}, "product-level expiry failed")
    )
    ),
  );
}


// Release ALL expired PENDING orders platform-wide
// Called on product list load — no cron needed
export async function releaseAllExpiredPendingOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60_000);

  const stale = await prisma.subOrder.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      payments: { none: { status: "PAID" } },
    },
    include: { orderItems: true },
  });

  if (!stale.length) return;

  await Promise.all(
    stale.map((sub) =>
      prisma.$transaction([
        prisma.subOrder.update({
          where: { id: sub.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: "Auto-expired: payment timeout",
          },
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
        ...sub.orderItems.map((oi) =>
          prisma.product.update({
            where: { id: oi.productId },
            data: { available: { increment: oi.quantity } },
          }),
        ),
      ]).catch((err) =>
        logger.warn({ err, subOrderId: sub.id }, "batch expiry failed silently")
      ),
    ),
  );
}