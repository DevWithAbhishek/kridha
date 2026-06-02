import { prisma } from "@/lib/db";
import { logger } from "./logger";
import { cacheInvalidate } from "@/lib/redis";

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
      orderItems: true,
    },
  });

  if (!stale.length) return;
  // Collect all affected productIds before the transactions
  const affectedProductIds = [
    ...new Set(stale.flatMap((sub) => sub.orderItems.map((oi) => oi.productId))),
  ];

  await Promise.all(
    stale.map((sub) =>
      prisma.$transaction([
        prisma.subOrder.update({
          where: { id: sub.id, status: "PENDING", },
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

  // Invalidate after writes complete — not before, not fire-and-forget
  if (affectedProductIds.length > 0) {
    await Promise.all(
      affectedProductIds.map((id) => cacheInvalidate.product(id, ""))
    );
    // product list pages contain distance_km + min_price — must invalidate all
    // cacheInvalidate.product already calls cacheDelPattern("kridha:products:*")
  }
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
  // Collect all affected productIds before the transactions
  const affectedProductIds = [
    ...new Set(stale.flatMap((sub) => sub.orderItems.map((oi) => oi.productId))),
  ];

  await Promise.all(
    stale.map((sub) =>
      prisma.$transaction([
        prisma.subOrder.update({
          where: { id: sub.id, status: "PENDING", },
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

  // Invalidate after writes complete — not before, not fire-and-forget
  if (affectedProductIds.length > 0) {
    await Promise.all(
      affectedProductIds.map((id) => cacheInvalidate.product(id, ""))
    );
    // product list pages contain distance_km + min_price — must invalidate all
    // cacheInvalidate.product already calls cacheDelPattern("kridha:products:*")
  }
}