// Runs at 8 PM daily.
// 1. Moves PENDING payouts for COMPLETED SubOrders → PROCESSING.
// 2. Creates payout records for no-show SubOrders (seller keeps advance).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST() {
  // 1. Batch payouts: PENDING → PROCESSING
  const batch = await prisma.payout.updateMany({
    where: {
      status: "PENDING",
      subOrder: { status: "COMPLETED" },
    },
    data: { status: "PROCESSING", processedAt: new Date() },
  });

  // 2. No-show cancellations: advance stays with seller — create payout if not already present
  const noShowSubs = await prisma.subOrder.findMany({
    where: {
      status: "CANCELLED",
      cancelledBy: "CRON",
      payout: null,
      advanceAmount: { gt: 0 },
    },
  });

  let noShowPayouts = 0;
  for (const sub of noShowSubs) {
    await prisma.payout.create({
      data: {
        subOrderId: sub.id,
        sellerId: sub.sellerId,
        amount: sub.advanceAmount,
        status: "PROCESSING",
        processedAt: new Date(),
      },
    });
    noShowPayouts++;
  }

  logger.info({ batch: batch.count, noShowPayouts }, "cron:transfer-advances");
  return NextResponse.json({ processing: batch.count, noShowPayouts });
}
