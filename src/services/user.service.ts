// No-show penalty + seller cancellation penalty.
// Called from cron expire-orders and order cancel.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { notificationService } from "./notification.service";

export const userService = {
  async applyNoShowPenalty(buyerId: string): Promise<void> {
    const buyer = await prisma.user.findUnique({
      where: { id: buyerId },
      select: { noShowCount: true, creditBalance: true },
    });
    if (!buyer) return;

    const newCount = buyer.noShowCount + 1;
    const newBalance = parseFloat((buyer.creditBalance - 20).toFixed(2));

    await prisma.user.update({
      where: { id: buyerId },
      data: {
        noShowCount: newCount,
        creditBalance: newBalance,
        isFlagged: newCount >= 3,
      },
    });

    notificationService.noShowPenalty(buyerId, newCount).catch(console.error);
  },

  async applySellerCancellationPenalty(sellerId: string): Promise<void> {
    await prisma.sellerProfile.update({
      where: { userId: sellerId },
      data: { reliabilityScore: { decrement: 15 } },
    });
  },
};
