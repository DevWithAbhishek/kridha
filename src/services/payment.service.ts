import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { getRazorPay } from "@/lib/razorpay";
import { validateTransition } from "@/lib/state-machine";
import { notificationService } from "./notification.service";

type RzOrder = {
  id: string;
  status: string;
  amount: number;
};

export const paymentService = {
  async createAdvance(subOrderId: string, buyerId: string) {
    const sub = await prisma.subOrder.findUnique({
      where: { id: subOrderId },
      include: { order: true },
    });
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
      await prisma.subOrder.update({
        where: { id: subOrderId },
        data: { razorpayAdvanceId: rzOrder.id },
      });
        }
        return {razorpayOrderId: rzOrder.id, amount: sub.advanceAmount, currency: 'INR'}
    },
    
    async requestPaymentLink(subOrderId: string, sellerId: string) {
        const sub = await prisma.subOrder.findUnique({
            where: { id: subOrderId },
            include: { order: true },
        })
        if (!sub) throw ERR.SUBORDER_NOT_FOUND;
        if (sub.sellerId !== sellerId) throw ERR.FORBIDDEN;
        validateTransition(sub.status, 'AWAITING_PAYMENT');

        const rz = getRazorPay();
        const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes
        const buyer = await prisma.user.findUnique({ where: { id: sub.order.buyerId } })
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
        
        await prisma.$transaction([
            prisma.subOrder.update({
                where: { id: subOrderId }, data: {
                    status: 'AWAITING_PAYMENT', paymentLinkId: link.id, paymentLinkUrl: link.short_url, paymentLinkExpiresAt: new Date(expiresAt * 1000),
                }
            }),
            prisma.orderStatusHistory.create({
                data: {
                    subOrderId,
                    orderId: sub.orderId,
                    fromStatus: 'CONFIRMED',
                    toStatus: 'AWAITING_PAYMENT'
                }
            })
        ]);

        return { paymentLinkUrl: link.short_url, paymentLinkId: link.id, expiresAt: new Date(expiresAt * 1000), remainingPayment: sub.remainingAmount };
    },

    async verifyOtp(subOrderId: string, sellerId: string, otp: string) {
        const sub = await prisma.subOrder.findUnique({
            where: { id: subOrderId },
            include: { order: true },
        });
        if (!sub) throw ERR.SUBORDER_NOT_FOUND;
        if (sub.sellerId !== sellerId) throw ERR.FORBIDDEN;
        validateTransition(sub.status, 'COMPLETED');

        if (sub.otpAttempts >= 3) throw ERR.OTP_ATTEMPTS;
        if (!sub.deliveryOtp || sub.deliveryOtp !== otp) {
            const newAttempts = sub.otpAttempts + 1;
            if (newAttempts >= 3) {
                // DISPUTED after 3 wrong attempts
                await prisma.$transaction([
                    prisma.subOrder.update({
                        where: { id: subOrderId },
                        data: {
                            otpAttempts: newAttempts,
                            status: 'DISPUTED'
                        }
                    }),
                    prisma.orderStatusHistory.create({ data: { subOrderId, orderId: sub.orderId, fromStatus: sub.status, toStatus: 'DISPUTED', note: 'Max OTP attempts exceeded' } })
                ]);
            } else {
                await prisma.subOrder.update({ where: { id: subOrderId }, data: { otpAttempts: newAttempts } });
            }
            throw ERR.INVALID_OTP;
        }

        const payoutAmount = parseFloat((sub.totalAmount - sub.platformFee).toFixed(2));

        const [updatedSub, payout, _] = await prisma.$transaction([
          prisma.subOrder.update({
            where: { id: subOrderId },
            data: {
              status: "COMPLETED",
              deliveryOtp: null, // INV-06: cleared immediately
              otpVerifiedAt: new Date(),
            },
          }),
            prisma.payout.create({
                data: {
                    subOrderId,
                    sellerId,
                    amount: payoutAmount,
                    status: 'PENDING',
                }
            }),
            prisma.orderStatusHistory.create({
                data: {
                    subOrderId,
                    orderId: sub.orderId,
                    fromStatus: 'READY_FOR_OTP_VERIFICATION',
                    toStatus: 'COMPLETED'
                }
            })
        ]);

        // Fire and Forget notifications
        notificationService.orderCompleted(subOrderId).catch(console.error);
        return { subOrder: updatedSub, payoutId: payout.id };
    }
};
