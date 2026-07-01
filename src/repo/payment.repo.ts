import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";

export const paymentRepo = {
  async findSubOrderWithOrderById(id: string) {
    return await prisma.subOrder.findUnique({
      where: { id },
      include: { order: true },
    });
  },

  async updateSubOrderAdvanceId(id: string, razorpayAdvanceId: string) {
    await prisma.subOrder.update({
      where: { id },
      data: { razorpayAdvanceId },
    });
  },

  async updateSubOrderToAwaitingPayment(
    id: string,
    paymentLinkId: string,
    paymentLinkUrl: string,
    expiresAt: number,
    orderId: string,
  ) {
    await prisma.$transaction([
      prisma.subOrder.update({
        where: { id },
        data: {
          status: "AWAITING_PAYMENT",
          paymentLinkId,
          paymentLinkUrl,
          paymentLinkExpiresAt: new Date(expiresAt * 1000),
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          subOrderId: id,
          orderId,
          fromStatus: "CONFIRMED",
          toStatus: "AWAITING_PAYMENT",
        },
      }),
    ]);
  },

  async updateSubOrderToDisputed(
    id: string,
    otpAttempts: number,
    orderId: string,
    fromStatus: OrderStatus,
  ) {
    await prisma.$transaction([
      prisma.subOrder.update({
        where: { id },
        data: {
          otpAttempts,
          status: "DISPUTED",
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          subOrderId: id,
          orderId,
          fromStatus,
          toStatus: "DISPUTED",
          note: "Max OTP attempts exceeded",
        },
      }),
    ]);
  },

  async updateSubOrderOtpVerifyAttempts(id: string, otpAttempts: number) {
    await prisma.subOrder.update({
      where: { id },
      data: { otpAttempts },
    });
  },

  async updateSubOrderToCompleted(
    id: string,
    sellerId: string,
    amount: number,
    orderId: string,
  ) {
    return await prisma.$transaction([
      prisma.subOrder.update({
        where: { id },
        data: {
          status: "COMPLETED",
          deliveryOtp: null, // INV-06: cleared immediately
          otpVerifiedAt: new Date(),
        },
      }),
      prisma.payout.create({
        data: {
          subOrderId: id,
          sellerId,
          amount,
          status: "PENDING",
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          subOrderId: id,
          orderId,
          fromStatus: "READY_FOR_OTP_VERIFICATION",
          toStatus: "COMPLETED",
        },
      }),
    ]);
  },

  async createMissingSubOrderWebhookLog(razorpayPaymentId: string) {
    await prisma.webhookLog.create({
      data: {
        razorpayPaymentId,
        eventType: "suborder missing",
      },
    });
  },

  async createAdvancePayment(
    razorpayPaymentId: string,
    subOrderId: string,
    amount: number,
    razorpayOrderId: string,
    deliveryOtp: string,
  ) {
    await prisma.$transaction([
      // Record Payment
      prisma.payment.create({
        data: {
          subOrderId,
          type: "ADVANCE",
          status: "PAID",
          amount, // paise -> rupees (in service layer)
          razorpayOrderId,
          razorpayPaymentId,
        },
      }),

      // Transition: PENDING -> CONFIRMED
      prisma.subOrder.update({
        where: { id: subOrderId },
        data: { status: "CONFIRMED", deliveryOtp },
      }),

      // History log for status change
      prisma.orderStatusHistory.create({
        data: {
          subOrderId,
          fromStatus: "PENDING",
          toStatus: "CONFIRMED",
          note: "Advance payment captured",
        },
      }),
    ]);
  },

  async findSubOrderByPaymentLinkId(paymentLinkId: string) {
    return await prisma.subOrder.findFirst({
      where: { paymentLinkId },
    });
  },

  async createRemainingPayment(
    paymentId: string | null,
    paymentLinkId: string,
    subOrderId: string,
    amount: number,
  ) {
    await prisma.$transaction([
      prisma.webhookLog.create({
        data: {
          razorpayPaymentId: paymentId ?? `pl_${paymentLinkId}`,
          eventType: "payment_link.paid",
          subOrderId,
        },
      }),

      prisma.payment.create({
        data: {
          subOrderId,
          type: "REMAINING",
          status: "PAID",
          amount,
          razorpayOrderId: paymentLinkId,
          razorpayPaymentId: paymentId ?? `pl_${paymentLinkId}`,
        },
      }),

      prisma.subOrder.update({
        where: { id: subOrderId },
        data: { status: "READY_FOR_OTP_VERIFICATION" },
      }),

      prisma.orderStatusHistory.create({
        data: {
          subOrderId,
          fromStatus: "AWAITING_PAYMENT",
          toStatus: "READY_FOR_OTP_VERIFICATION",
          note: "Remaining payment received",
        },
      }),
    ]);
  },

  async createPaymentFailed(
    subOrderId: string,
    amount: number,
    razorpayOrderId: string,
    razorpayPaymentId: string,
  ) {
    await prisma.payment.create({
      data: {
        subOrderId,
        type: "ADVANCE",
        status: "FAILED",
        amount,
        razorpayOrderId,
        razorpayPaymentId,
      },
    });
  },

  async findSubOrderWithPendingPayment(paymentLinkId: string) {
    return await prisma.subOrder.findFirst({
      where: { paymentLinkId, status: "AWAITING_PAYMENT" },
    });
  },

  async updateRefundsToProcessed(razorpayRefundId: string) {
    await prisma.refund.updateMany({
      where: { razorpayRefundId },
      data: { status: "PROCESSED" },
    });
  },

  async updateRefundsToFailed(razorpayRefundId: string) {
    await prisma.refund.updateMany({
      where: { razorpayRefundId },
      data: { status: "FAILED" },
    });
  },
};
