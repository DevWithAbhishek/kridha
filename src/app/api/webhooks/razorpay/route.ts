import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { withLogger } from "@/lib/withLogger";
import { handleError } from "@/lib/handleError";
import { paymentService } from "@/services/payment.service";

// Razorpay sends raw body - must not parse as JSON before verifying
// Four rules: always 200, HMAC verify first, idempotency check, atomic transaction
export const POST = withLogger(async (req: NextRequest) => {
  try {
    const rawBody = await req.text(); // raw text, not req.json()
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    // Step 1: Verify HMAC signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );

    if (!isValid) {
      logger.warn(
        {
          event: "webhook.signature_invalid",
        },
        "invalid Razorpay signature",
      );
      return NextResponse.json({ received: true }); // still return 200 to avoid retries
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event as string;

    logger.info(
      {
        event: "webhook.received",
        razorpayEvent: event,
      },
      "webhook received",
    );

    // Step 2: Idempotency Check - @unique constraint (Extract paymentId from whichever event type)
    const paymentId =
      payload.payload?.payment?.entity?.id ??
      payload.payload?.payment_link?.entity?.payments?.[0]?.payment?.entity
        ?.id ??
      null;

    if (!paymentId) {
      return NextResponse.json({ received: true }); // unstructured event — ignore
    }

    if (paymentId) {
      const existing = await prisma.webhookLog.findUnique({
        where: { razorpayPaymentId: paymentId },
      });

      if (existing) {
        logger.info(
          {
            event: "webhook_duplicates",
            paymentId,
          },
          "duplicate webhook - already processed",
        );
        return NextResponse.json({ received: true }); // already processed
      }
    }

    await prisma.webhookLog.create({
      data: {
        razorpayPaymentId: paymentId!,
        eventType: event,
      },
    });

    // Step 3: Route Handler
    try {
      switch (event) {
        case "payment.captured":
          await paymentService.handlePaymentCaptured(payload, paymentId);
          break;

        case "payment.failed":
          await paymentService.handlePaymentFailed(payload);
          break;

        case "payment_link.paid":
          await paymentService.handlePaymentLinkPaid(payload, paymentId);
          break;

        case "payment_link.expired":
          await paymentService.handlePaymentLinkExpired(payload);
          break;

        case "refund.processed":
          await paymentService.handleRefundProcessed(payload);
          break;

        case "refund.failed":
          await paymentService.handleRefundFailed(payload);
          break;

        case "payment.dispute.created":
          await paymentService.handleDisputeCreated(payload);
          break;

        case "payment.dispute.won":
        case "payment.dispute.lost":
          await paymentService.handleDisputeResolved(payload, event);
          break;

        default:
          logger.info(
            {
              event: "webhook.unhandled",
              RazorpayEvent: event,
            },
            "unhandled event",
          );
      }
    } catch (err) {
      // Log and alert but still return 200
      // Returning 500 causes Razorpay to retry - creates duplicate processing risk
      logger.error({ err, event, paymentId }, "webhook hanlder error");
      Sentry.captureException(err);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return handleError(err);
  }
}, "webhook.razorpay");
