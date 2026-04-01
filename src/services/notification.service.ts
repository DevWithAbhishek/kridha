import { prisma } from "@/lib/db";
import { NotificationType } from "@prisma/client";
import { notifStrings } from "@/lib/i18n-strings";

type Lang = "en" | "hi";

async function getLang(userId: string): Promise<Lang> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLang: true },
  });
  return u?.preferredLang === "hi" ? "hi" : "en";
}

async function insertNotification(
  userId: string,
  subOrderId: string | null,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  await prisma.notification.create({
    data: { userId, subOrderId, type, title, body },
  });
}

export const notificationService = {
  async orderConfirmed(subOrderId: string, otp: string): Promise<void> {
    const sub = await prisma.subOrder.findUnique({
      where: { id: subOrderId },
      include: { order: { select: { buyerId: true } } },
    });
    if (!sub) return;
    const [buyerLang, sellerLang] = await Promise.all([
      getLang(sub.order.buyerId),
      getLang(sub.sellerId),
    ]);
    const bc = notifStrings.orderConfirmed[buyerLang](sub.shortId, otp);
    const sc = notifStrings.newOrder[sellerLang](sub.shortId);
    await Promise.all([
      insertNotification(
        sub.order.buyerId,
        subOrderId,
        NotificationType.ORDER_CONFIRMED,
        bc.title,
        bc.body,
      ),
      insertNotification(
        sub.sellerId,
        subOrderId,
        NotificationType.NEW_ORDER,
        sc.title,
        sc.body,
      ),
    ]);
  },

  async readyForOtp(subOrderId: string): Promise<void> {
    const sub = await prisma.subOrder.findUnique({
      where: { id: subOrderId },
      include: { order: { select: { buyerId: true } } },
    });
    if (!sub) return;
    const [buyerLang, sellerLang] = await Promise.all([
      getLang(sub.order.buyerId),
      getLang(sub.sellerId),
    ]);
    const bc = notifStrings.readyForPickup[buyerLang](sub.shortId);
    const sc = notifStrings.readyForOtpSeller[sellerLang](sub.shortId);
    await Promise.all([
      insertNotification(
        sub.order.buyerId,
        subOrderId,
        NotificationType.READY_FOR_PICKUP,
        bc.title,
        bc.body,
      ),
      insertNotification(
        sub.sellerId,
        subOrderId,
        NotificationType.AWAITING_PAYMENT,
        sc.title,
        sc.body,
      ),
    ]);
  },

  async orderCompleted(subOrderId: string): Promise<void> {
    const sub = await prisma.subOrder.findUnique({
      where: { id: subOrderId },
      include: { order: { select: { buyerId: true } }, payout: true },
    });
    if (!sub) return;
    const [buyerLang, sellerLang] = await Promise.all([
      getLang(sub.order.buyerId),
      getLang(sub.sellerId),
    ]);
    const bc = notifStrings.orderCompleted[buyerLang](sub.shortId);
    const sc = notifStrings.payoutQueued[sellerLang](sub.payout?.amount ?? 0);
    await Promise.all([
      insertNotification(
        sub.order.buyerId,
        subOrderId,
        NotificationType.ORDER_COMPLETED,
        bc.title,
        bc.body,
      ),
      insertNotification(
        sub.sellerId,
        subOrderId,
        NotificationType.ORDER_COMPLETED,
        sc.title,
        sc.body,
      ),
    ]);
  },

  async orderCancelled(
    subOrderId: string,
    cancelledByUserId: string,
    refundAmount: number,
  ): Promise<void> {
    const sub = await prisma.subOrder.findUnique({
      where: { id: subOrderId },
      include: { order: { select: { buyerId: true } } },
    });
    if (!sub) return;
    const isBuyerCancel = cancelledByUserId === sub.order.buyerId;

    if (isBuyerCancel) {
      const sellerLang = await getLang(sub.sellerId);
      const sc = notifStrings.orderCancelledSeller[sellerLang](sub.shortId);
      await insertNotification(
        sub.sellerId,
        subOrderId,
        NotificationType.ORDER_CANCELLED,
        sc.title,
        sc.body,
      );
    } else {
      const buyerLang = await getLang(sub.order.buyerId);
      const bc = notifStrings.sellerCancelledBuyer[buyerLang](sub.shortId);
      await insertNotification(
        sub.order.buyerId,
        subOrderId,
        NotificationType.ORDER_CANCELLED,
        bc.title,
        bc.body,
      );
    }

    if (refundAmount > 0) {
      const buyerLang = await getLang(sub.order.buyerId);
      const rc = notifStrings.refundInitiated[buyerLang](refundAmount);
      await insertNotification(
        sub.order.buyerId,
        subOrderId,
        NotificationType.REFUND_INITIATED,
        rc.title,
        rc.body,
      );
    }
  },

  async noShowPenalty(buyerId: string, noShowCount: number): Promise<void> {
    const lang = await getLang(buyerId);
    const nc = notifStrings.noShowPenalty[lang](noShowCount);
    await insertNotification(
      buyerId,
      null,
      NotificationType.NO_SHOW_PENALTY,
      nc.title,
      nc.body,
    );
    if (noShowCount >= 3) {
      const fc = notifStrings.accountFlagged[lang]();
      await insertNotification(
        buyerId,
        null,
        NotificationType.FLAGGED_BUYER,
        fc.title,
        fc.body,
      );
    }
  },

  // productName passed as resolved string (caller picks nameHi if seller lang is hi)
  async newReview(
    sellerId: string,
    productName: string,
    rating: number,
  ): Promise<void> {
    const lang = await getLang(sellerId);
    const rc = notifStrings.newReview[lang](productName, rating);
    // NotificationType has no REVIEW_RECEIVED — using NEW_ORDER as closest available
    await insertNotification(
      sellerId,
      null,
      NotificationType.NEW_ORDER,
      rc.title,
      rc.body,
    );
  },
};
