import { Prisma} from "@prisma/client";
import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { calcUnitPrice } from "@/lib/pricing";
import { getRazorPay } from "@/lib/razorpay";
import { isCancellable, validateTransition } from "@/lib/state-machine";
import { calcRefundAmount } from "@/lib/refund";

export interface CreateItem {
  productId: string;
  quantity: number;
  pickupWindowId: string;
  pickUpDate: Date;
}

export const orderService = {
  async create(buyerId: string, items: CreateItem[], cartSessionId?: string) {
    // 1. Load products and grouped by seller
    type EnrichedItem = CreateItem & {
      product: Prisma.ProductGetPayload<{
        include: { priceTiers: true };
      }>;
    };

    const enriched: EnrichedItem[] = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId, productStatus: "ACTIVE", deletedAt: null },
        include: { priceTiers: true },
      });
      if (!product) throw ERR.PRODUCT_NOT_FOUND;
    }

    const bySeller = new Map<string, typeof enriched>();
    for (const item of enriched) {
      const arr = bySeller.get(item.product.sellerId) ?? [];
      arr.push(item);
      bySeller.set(item.product.sellerId, arr);
    }

    const cfg = await prisma.platformConfig.findUniqueOrThrow({
      where: { id: "singleton" },
    });

    // 2. Atomic: lock rows, decrement stock, create Order + SubOrders
    const result = await prisma.$transaction(async (tx) => {
      let grandTotal = 0,
        grandFee = 0,
        totalAdvance = 0;
      const subOrderData: Array<{
        sellerId: string;
        sellerTotal: number;
        fee: number;
        adv: number;
        remaining: number;
        pickupWindowId: string;
        pickupDate: Date;
        pickupDeadline: Date;
        lines: Array<{
          productId: string;
          quantity: number;
          unitPrice: number;
          subTotal: number;
        }>;
      }> = [];

      for (const [sellerId, sellerItems] of bySeller) {
        let sellerTotal = 0;
        const lines: (typeof subOrderData)[0]["lines"] = [];
        for (const item of sellerItems) {
          // SELECT FOR UPDATE — prevents overselling (INV-01)
          const [locked] = await tx.$queryRaw<[{ available: number }]>(
            Prisma.sql`SELECT available FROM Product WHERE id = ${item.productId} FOR UPDATE`,
          );
          if (locked.available < item.quantity) {
            throw ERR.INSUFFICIENT_STOCK({
              productId: item.productId,
              productName: item.product.nameEn,
              requested: item.quantity,
              available: locked.available,
            });
          }
          // decrement stock
          await tx.product.update({
            where: { id: item.productId },
            data: { available: { decrement: item.quantity } },
          });

          const unitPrice = calcUnitPrice(
            item.quantity,
            item.product.priceTiers,
          );
          const lineTotal = parseFloat((unitPrice * item.quantity).toFixed(2));
          sellerTotal += lineTotal;
          lines.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice,
            subTotal: lineTotal,
          });
        }

        if (sellerTotal < cfg.minOrderAmountPerSeller) {
          throw ERR.BELOW_MINIMUM_ORDER({
            minimum: cfg.minOrderAmountPerSeller,
            current: sellerTotal,
          });
        }

        const fee = parseFloat(
          (sellerTotal * (cfg.platformFeePercent / 100)).toFixed(2),
        );
        const adv = parseFloat(
          Math.min(
            cfg.advanceCapAmount,
            Math.min(
              cfg.advanceMinAmount,
              sellerTotal * (cfg.advancePercent / 100),
            ),
          ).toFixed(2),
        );
        grandTotal += sellerTotal;
        grandFee += fee;
        totalAdvance += adv;

        // pickupDeadline = pickupDate + endTime of window (stored for cron index INV-13)
        const window = await tx.pickupWindow.findUnique({
          where: { id: sellerItems[0].pickupWindowId },
        });
        const [endH, endM] = (window?.endTime ?? "23:59")
          .split(":")
          .map(Number);
        const pickupDeadline = new Date(sellerItems[0].pickUpDate);
        pickupDeadline.setHours(endH, endM, 0, 0);

        subOrderData.push({
          sellerId,
          sellerTotal,
          fee,
          adv,
          remaining: sellerTotal - adv,
          pickupWindowId: sellerItems[0].pickupWindowId,
          pickupDate: sellerItems[0].pickUpDate,
          pickupDeadline,
          lines,
        });
      }

      const order = await tx.order.create({
        data: {
          buyerId,
          cartSessionId,
          totalAmount: parseFloat(grandTotal.toFixed(2)),
          subTotal: parseFloat(grandTotal.toFixed(2)),
          platformFee: parseFloat(grandFee.toFixed(2)),
          advanceAmount: parseFloat(totalAdvance.toFixed(2)),
        },
      });

      const subOrders = [];
      for (const sd of subOrderData) {
        const shortId = "KR-" + Date.now().toString(36).toUpperCase().slice(-6);
        const sub = await tx.subOrder.create({
          data: {
            orderId: order.id,
            shortId,
            sellerId: sd.sellerId,
            totalAmount: sd.sellerTotal,
            platformFee: sd.fee,
            advanceAmount: sd.adv,
            remainingAmount: sd.remaining,
            pickupWindowId: sd.pickupWindowId,
            pickupDate: sd.pickupDate,
            pickupDeadline: sd.pickupDeadline,
            orderItems: { create: sd.lines },
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            subOrderId: sub.id,
            orderId: order.id,
            fromStatus: null,
            toStatus: "PENDING",
          },
        });
        subOrders.push(sub);
      }
      return { order, subOrders, totalAdvance };
    });

    // 3. Create combined Razorpay advance order
    const rz = getRazorPay();
    const rzOrder = await rz.orders
      .create({
        amount: Math.round(result.totalAdvance * 100),
        currency: "INR",
        receipt: result.order.id,
      })
      .catch(() => {
        throw ERR.RAZORPAY_ERROR;
      });

    // Store razorpayAdvanceId on each SubOrder
    await Promise.all(
      result.subOrders.map((sub) =>
        prisma.subOrder.update({
          where: { id: sub.id },
          data: { razorpayAdvanceId: rzOrder.id },
        }),
      ),
    );

    // Create Payment records
    await Promise.all(
      result.subOrders.map((sub) =>
        prisma.payment.create({
          data: {
            subOrderId: sub.id,
            type: "ADVANCE",
            status: "CREATED",
            amount: sub.advanceAmount,
            razorpayOrderId: rzOrder.id,
          },
        }),
      ),
    );

    return { ...result, razorpayOrderId: rzOrder.id };
  },

  async cancel(subOrderId: string, userId: string, reason?: string) {
    const sub = await prisma.subOrder.findUnique({
      where: { id: subOrderId },
      include: { order: { select: { buyerId: true } } },
    });
    if (!sub) throw ERR.SUBORDER_NOT_FOUND;

    const isBuyer = sub.order.buyerId === userId;
    const isSeller = sub.sellerId === userId;
    if (!isBuyer && !isSeller) throw ERR.FORBIDDEN;
    if (!isCancellable(sub.status))
      throw ERR.INVALID_TRANSITION({
        currentStatus: sub.status,
        cancellableStatuses: ["PENDING", "CONFIRMED"],
      });

    validateTransition(sub.status, "CANCELLED");

    const cancelledBy = isSeller ? "SELLER" : "BUYER";
    const refundAmount = calcRefundAmount(
      sub.advanceAmount,
      sub.pickupDeadline,
      cancelledBy,
    );

    // If seller cancels — decrement reliabilityScore (INV from README)
    const updates: Prisma.PrismaPromise<unknown>[] = [
      prisma.subOrder.update({
        where: { id: subOrderId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledBy: userId,
          cancellationReason: reason ?? null,
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          subOrderId,
          orderId: sub.orderId,
          fromStatus: sub.status,
          toStatus: "CANCELLED",
          changedById: userId,
          note: reason,
        },
      }),
    ];

    if (isSeller) {
      updates.push(
        prisma.sellerProfile.update({
          where: { userId },
          data: { reliabilityScore: { decrement: 15 } },
        }),
      );
    }

    if (refundAmount > 0) {
      updates.push(
        prisma.refund.create({
          data: {
            subOrderId,
            amount: refundAmount,
            reason: `Cancellation by ${cancelledBy.toLowerCase()}`,
            status: "INITIATED",
          },
        }),
      );
    }

    await prisma.$transaction(updates);
    return {
      refundAmount,
      refundStatus: refundAmount > 0 ? "INITIATED" : "NOT_APPLICABLE",
    };
  },

  // Used by checkout — converts CartSession to Order + SubOrders
  async createFromCart(buyerId: string, cartSessionId: string) {
    const cart = await prisma.cartSession.findFirst({
      where: {
        id: cartSessionId,
        userId: buyerId,
        expiresAt: { gt: new Date() },
      },
      include: {
        cartItems: { include: { product: { include: { priceTiers: true } } } },
      },
    });
    if (!cart || !cart.cartItems.length) throw ERR.CART_EMPTY;

    const items: CreateItem[] = cart.cartItems.map((ci) => ({
      productId: ci.productId,
      quantity: ci.quantity,
      pickupWindowId: ci.pickupWindowId,
      pickUpDate: ci.pickupDate,
    }));

    const result = await orderService.create(buyerId, items, cartSessionId);

    // Clear cart after successful checkout (INV-19)
    await prisma.cartItem.deleteMany({ where: { cartSessionId: cart.id } });
    return result;
  },
};
