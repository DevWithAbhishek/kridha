import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { notificationService } from "@/services/notification.service";
import { validateTransition } from "@/lib/state-machine";
import { logger } from "@/lib/logger";

// ALWAYS returns 200 — Razorpay retries on any non-200 (causes double-processing)
// Four rules: always 200, HMAC verify first, idempotency check, atomic transaction
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text(); // must read as text BEFORE parsing for HMAC
    const sign = req.headers.get("x-razorpay-signature") ?? "";

    // Rule 2:  HMAC signature verification
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(sign), Buffer.from(expected))) {
      console.error("[WEBHOOK] Bad signature - ignoring");
      return NextResponse.json({ received: true }); // Rule 1: still 200
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event as string;
    const paymentId = payload.payload?.payment?.entity?.id as
      | string
      | undefined;
    if (!paymentId) {
      return NextResponse.json({ received: true }); // unstructured event — ignore
    }

    // Rule 3: IDEMPOTENCY check (INV - 03)
    const seen = await prisma.webhookLog.findUnique({
      where: {
        razorpayPaymentId: paymentId,
      },
    });
    if (seen) {
      return NextResponse.json({ received: true }); // already processed
    }

    if (event === "payment.captured") {
      const rzOrderId = payload.payload.payment.entity.order_id as string;
      const sub = await prisma.subOrder.findFirst({
        where: { razorpayAdvanceId: rzOrderId },
      });

      if (sub) {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // Rule 4: atomic - log + status change in one transaction
        await prisma.$transaction([
          prisma.webhookLog.create({
            data: {
              razorpayPaymentId: paymentId,
              eventType: event,
              subOrderId: sub?.id,
            },
          }),
          prisma.subOrder.update({
            where: { id: sub.id },
            data: {
              status: "CONFIRMED",
              deliveryOtp: otp,
            },
          }),
          prisma.orderStatusHistory.create({
            data: {
              subOrderId: sub.deliveryOtp,
              orderId: sub.orderId,
              fromStatus: "PENDING",
              toStatus: "CONFIRMED",
            },
          }),
          prisma.payment.updateMany({
            where: { subOrderId: sub.id },
            data: {
              status: "PAID",
              razorpayPaymentId: paymentId,
            },
          }),
        ]);
        // Notifications outside transaction — fire and forget
        notificationService.orderConfirmed(sub.id, otp).catch(console.error);
      } else {
        // Log even if SubOrder not found — for debugging
        await prisma.webhookLog.create({
          data: {
            razorpayPaymentId: paymentId,
            eventType: event,
          },
        });
      }
    } else if (event === "payment_link.paid") {
      const linkId = payload.payload?.payment_link?.entity?.id as string;
      const sub = await prisma.subOrder.findFirst({
        where: {
          paymentLinkId: linkId,
        },
      });

      if (sub) {
        validateTransition(sub.status, "READY_FOR_OTP_VERIFICATION");
        await prisma.$transaction([
          prisma.webhookLog.create({
            data: {
              razorpayPaymentId: paymentId,
              eventType: event,
              subOrderId: sub.id,
            },
          }),
          prisma.subOrder.update({
            where: { id: sub.id },
            data: {
              status: "READY_FOR_OTP_VERIFICATION",
            },
          }),
          prisma.orderStatusHistory.create({
            data: {
              subOrderId: sub.id,
              orderId: sub.orderId,
              fromStatus: "AWAITING_PAYMENT",
              toStatus: "READY_FOR_OTP_VERIFICATION",
            },
          }),
          prisma.payment.create({
            data: {
              subOrderId: sub.id,
              type: "REMAINING",
              status: "PAID",
              amount: sub.remainingAmount,
              razorpayPaymentId: paymentId,
            },
          }),
        ]);
        notificationService.readyForOtp(sub.id).catch(console.error);
      } else {
        // Log even if SubOrder not found — for debugging
        await prisma.webhookLog.create({
          data: {
            razorpayPaymentId: paymentId,
            eventType: event,
          },
        });
      }
    } else {
      // Log unhandled events — return 200 (do not error)
      await prisma.webhookLog.create({
        data: {
          razorpayPaymentId: paymentId,
          eventType: event,
        },
      });
    }
  } catch (err) {
    logger.error(
      { err, action: "webhook.razorpay" },
      "Webhook processing error",
    );
  }
  return NextResponse.json({ received: true }); // Rule 1: always 200
}
