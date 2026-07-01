import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { getRazorPay } from "@/lib/razorpay";
import { validateTransition } from "@/lib/state-machine";
import { notificationService } from "./notification.service";
import { logger } from "@/lib//logger";
import * as Sentry from "@sentry/nextjs";
import { paymentRepo } from "@/repo/payment.repo";

type RzOrder = {
  id: string;
  status: string;
  amount: number;
};

export const paymentService = {
  async createAdvance(subOrderId: string, buyerId: string) {
    const sub = await paymentRepo.findSubOrderWithOrderById(subOrderId);
    if (!sub) throw ERR.SUBORDER_NOT_FOUND;
    if (sub.order.buyerId !== buyerId) throw ERR.FORBIDDEN;
    if (sub.status !== "PENDING")
      throw ERR.INVALID_TRANSITION({
        currentStatus: sub.status,
        allowedNext: ["PENDING"],
      });

    const rz = getRazorPay();
    let rzOrder: RzOrder | null = null;
    // Reuse existing Razorpay order if it hasn't changed
    if (sub.razorpayAdvanceId) {
      try {
        rzOrder = (await rz.orders.fetch(sub.razorpayAdvanceId)) as RzOrder;
        if (rzOrder.status === "paid")
          throw ERR.INVALID_TRANSITION({
            currentStatus: sub.status,
            note: "Advance already paid",
          });
      } catch (err) {
        /* expired — create new */
      }
    }

    if (!rzOrder) {
      rzOrder = (await rz.orders
        .create({
          amount: Math.round(sub.advanceAmount * 100),
          currency: "INR",
          receipt: sub.shortId,
        })
        .catch(() => {
          throw ERR.RAZORPAY_ERROR;
        })) as RzOrder;
      await paymentRepo.updateSubOrderAdvanceId(subOrderId, rzOrder.id);
    }
    return {
      razorpayOrderId: rzOrder.id,
      amount: sub.advanceAmount,
      currency: "INR",
    };
  },

  async requestPaymentLink(subOrderId: string, sellerId: string) {
    const sub = await paymentRepo.findSubOrderWithOrderById(subOrderId);
    if (!sub) throw ERR.SUBORDER_NOT_FOUND;
    if (sub.sellerId !== sellerId) throw ERR.FORBIDDEN;
    validateTransition(sub.status, "AWAITING_PAYMENT");

    const rz = getRazorPay();
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes
    const buyer = await prisma.user.findUnique({
      where: { id: sub.order.buyerId },
    });
    if (!buyer) throw ERR.INVALID_CREDENTIALS;
    const link = await rz.paymentLink
      .create({
        amount: Math.round(sub.remainingAmount * 100),
        currency: "INR",
        expire_by: expiresAt,
        reference_id: sub.shortId,
        description: `Remaining payment for order ${sub.shortId}`,
        customer: {
          name: buyer.name,
          contact: buyer.phone, // must be string
        },
      })
      .catch(() => {
        throw ERR.RAZORPAY_ERROR;
      });

    await paymentRepo.updateSubOrderToAwaitingPayment(
      subOrderId,
      link.id,
      link.short_url,
      expiresAt,
      sub.orderId,
    );

    return {
      paymentLinkUrl: link.short_url,
      paymentLinkId: link.id,
      expiresAt: new Date(expiresAt * 1000),
      remainingPayment: sub.remainingAmount,
    };
  },

  async verifyOtp(subOrderId: string, sellerId: string, otp: string) {
    const sub = await paymentRepo.findSubOrderWithOrderById(subOrderId);
    if (!sub) throw ERR.SUBORDER_NOT_FOUND;
    if (sub.sellerId !== sellerId) throw ERR.FORBIDDEN;
    validateTransition(sub.status, "COMPLETED");

    if (sub.otpAttempts >= 3) throw ERR.OTP_ATTEMPTS;
    if (!sub.deliveryOtp || sub.deliveryOtp !== otp) {
      const newAttempts = sub.otpAttempts + 1;
      if (newAttempts >= 3) {
        // DISPUTED after 3 wrong attempts
        await paymentRepo.updateSubOrderToDisputed(
          subOrderId,
          newAttempts,
          sub.orderId,
          sub.status,
        );
      } else {
        await paymentRepo.updateSubOrderOtpVerifyAttempts(
          subOrderId,
          newAttempts,
        );
      }
      throw ERR.INVALID_OTP;
    }

    const payoutAmount = parseFloat(
      (sub.totalAmount - sub.platformFee).toFixed(2),
    );

    const [updatedSub, payout, _] = await paymentRepo.updateSubOrderToCompleted(
      subOrderId,
      sellerId,
      payoutAmount,
      sub.orderId,
    );

    // Fire and Forget notifications
    notificationService.orderCompleted(subOrderId).catch(console.error);
    return { subOrder: updatedSub, payoutId: payout.id };
  },

  async handlePaymentCaptured(payload: any, paymentId: string | null) {
    const entity = payload.payload.payment.entity;
    const orderId = entity.order_id; // Razorpay order Id -> matches SubOrder.razorpayAdvanceId

    const order = await prisma.order.findFirst({
      where: {
        razorpayAdvanceId: orderId,
      },
      include: {
        subOrders: true,
      },
    });

    if (!order) {
      logger.warn(
        {
          event: "webhook.suborder_not_found",
          orderId,
        },
        "SubOrder not found for captured payment",
      );
      await paymentRepo.createMissingSubOrderWebhookLog(paymentId!);
      return;
    }

    // Atomic: log + update status + generate OTP in one transaction
    for (const subOrder of order.subOrders) {
      if (subOrder.status !== "PENDING") continue;

      const otp = Math.floor(1000 + Math.random() * 9000).toString();

      await paymentRepo.createAdvancePayment(
        paymentId!,
        subOrder.id,
        subOrder.advanceAmount, // NOT entity.amount
        orderId,
        otp,
      );

      notificationService
        .orderConfirmed(subOrder.id, otp)
        .catch(console.error);
    }

    logger.info(
      {
        event: "payment.captured.processed",
        orderId: order.id,
        processedSubOrders: order.subOrders.length,
      },
      "Advance payment processed for all pending suborders",
    );
  },

  async handlePaymentLinkPaid(payload: any, paymentId: string | null) {
    const entity = payload.payload.payment_link.entity;
    const paymentLinkId = entity.id;

    const subOrder =
      await paymentRepo.findSubOrderByPaymentLinkId(paymentLinkId);

    if (!subOrder || subOrder.status !== "AWAITING_PAYMENT") {
      await paymentRepo.createMissingSubOrderWebhookLog(paymentId!);
      return;
    }

    validateTransition(subOrder.status, "READY_FOR_OTP_VERIFICATION");

    await paymentRepo.createRemainingPayment(
      paymentId,
      paymentLinkId,
      subOrder.id,
      subOrder.remainingAmount,
    );

    notificationService.readyForOtp(subOrder.id).catch(console.error);
  },

  async handlePaymentFailed(payload: any) {
    const entity = payload.payload.payment.entity;
    const orderId = entity.order_id;

    const order = await prisma.order.findFirst({
      where: { razorpayAdvanceId: orderId },
      include: { subOrders: true },
    });

    if (!order) return;

    for (const subOrder of order.subOrders) {
      if (subOrder.status !== "PENDING") continue;

      await paymentRepo.createPaymentFailed(
        subOrder.id,
        subOrder.advanceAmount,
        orderId,
        entity.id,
      );
    }

    logger.warn(
      {
        event: "payment.failed",
        orderId: order.id,
        reason: entity.error_description,
      },
      "advance payment failed",
    );
  },

  async handlePaymentLinkExpired(payload: any) {
    const entity = payload.payload.payment_link.entity;
    const paymentLinkId = entity.id;

    const subOrder =
      await paymentRepo.findSubOrderWithPendingPayment(paymentLinkId);

    if (!subOrder) {
      await paymentRepo.createMissingSubOrderWebhookLog(paymentLinkId);
      return;
    }

    logger.warn(
      {
        event: "payment_link.expired",
        subOrderId: subOrder.id,
      },
      "Payment link expired - seller must regenerate",
    );
  },

  async handleRefundProcessed(payload: any) {
    const entity = payload.payload.refund.entity;
    const refundId = entity.id;
    await paymentRepo.updateRefundsToProcessed(refundId);

    logger.info(
      {
        event: "refund.processed",
        refundId,
      },
      "refund processed",
    );
  },

  async handleRefundFailed(payload: any) {
    const entity = payload.payload.refund.entity;
    const refundId = entity.id;

    await paymentRepo.updateRefundsToFailed(refundId);

    Sentry.captureMessage(
      `Refund failed: ${refundId} - manual intervention required`,
      "error",
    );
    logger.error(
      {
        event: "refund.failed",
        refundId,
      },
      "refund failed - needs manual action",
    );
  },

  async handleDisputeCreated(payload: any) {
    const dispute = payload.payload.dispute.entity;
    const entityId = dispute.payment_id;

    logger.warn(
      {
        event: "payment.dispute.created",
        paymentId: entityId,
        amount: dispute.amount,
      },
      "DISPUTE CREATED - admin action required",
    );

    Sentry.captureMessage(
      `Razorpay dispute created for payment ${entityId}`,
      "error",
    );
  },

  async handleDisputeResolved(payload: any, event: string) {
    const dispute = payload.payload.dispute.entity;
    logger.info(
      {
        event: "dispute.resolved",
        result: event,
        paymentId: dispute.payment_id,
      },
      "dispute resolved",
    );
  },
};
