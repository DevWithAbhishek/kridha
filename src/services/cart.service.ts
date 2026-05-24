import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { calcUnitPrice } from "@/lib/pricing";
import type { AddItemToCartInput, UpdateCartItemInput } from "@/schemas";
import {
  istTimeToUTCDate,
  todayMidnightIST,
  isTodayInIST,
  istDayOfWeek,
} from "@/lib/time";
import { releaseExpiredHoldsForProduct } from "@/lib/expiry";

const CART_INCLUDE = {
  cartItems: {
    include: {
      product: {
        include: {
          priceTiers: true,
          deals: {
            where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
            take: 1,
          },
          seller: { select: { storeName: true, city: true } },
        },
      },
      pickupWindow: true,
    },
  },
} as const;

export const cartService = {
  // Get or create active CartSession for user
  // One active session per user — enforced here, one-to-many in DB
  async getOrCreate(userId: string) {
    let cart = await prisma.cartSession.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
      include: CART_INCLUDE,
    });
    if (!cart) {
      cart = await prisma.cartSession.create({
        data: { userId, expiresAt: new Date(Date.now() + 30 * 60_000) },
        include: CART_INCLUDE,
      });
    }
    return cart;
  },

  async addItem(userId: string, input: AddItemToCartInput) {
    await releaseExpiredHoldsForProduct(input.productId).catch(() => {});
    const product = await prisma.product.findUnique({
      where: {
        id: input.productId,
        productStatus: "ACTIVE",
        deletedAt: null,
      },
      include: { priceTiers: true },
    });
    if (!product) throw ERR.PRODUCT_NOT_FOUND;

    // Validate pickup window belongs to this product's seller
    const window = await prisma.pickupWindow.findFirst({
      where: {
        id: input.pickupWindowId,
        sellerId: product.sellerId,
        deletedAt: null,
      },
    });
    if (!window) throw ERR.WINDOW_UNAVAILABLE;

    // Validate pickup date is in future and in window's active days
    const pickupDate = new Date(input.pickupDate);
    if (pickupDate < todayMidnightIST()) throw ERR.INVALID_PICKUP_DATE;

    if (!window.daysActive.includes(istDayOfWeek(pickupDate))) {
      throw ERR.INVALID_PICKUP_DATE;
    }

    if (isTodayInIST(pickupDate)) {
      const windowEnd = istTimeToUTCDate(window.endTime);
      const windowStart = istTimeToUTCDate(window.startTime);

      // Window has already closed
      if (new Date() > windowEnd) {
        throw ERR.WINDOW_UNAVAILABLE;
      }

      if (Date.now() < windowStart.getTime()) throw ERR.WINDOW_UNAVAILABLE;
    }

    // Stock check (advisory — hard check at order creation with SELECT FOR UPDATE)
    if (product.available < input.quantity) {
      throw ERR.INSUFFICIENT_STOCK({
        productId: product.id,
        productName: product.nameEn,
        requested: input.quantity,
        available: product.available,
      });
    }

    const unitPrice = calcUnitPrice(input.quantity, product.priceTiers);

    return prisma.$transaction(async (tx) => {
      let cart = await tx.cartSession.findFirst({
        where: { userId, expiresAt: { gt: new Date() } },
        include: CART_INCLUDE,
      });

      if (!cart) {
        cart = await tx.cartSession.create({
          data: { userId, expiresAt: new Date(Date.now() + 30 * 60_000) },
          include: CART_INCLUDE,
        });
      } else {
        await tx.cartSession.update({
          where: { id: cart.id },
          data: { expiresAt: new Date(Date.now() + 30 * 60_000) },
        });
      }

      await tx.cartSession.update({
        where: { id: cart.id },
        data: { expiresAt: new Date(Date.now() + 30 * 60_000) },
      });

      const lineTotal = parseFloat((unitPrice * input.quantity).toFixed(2));
      return await tx.cartItem.upsert({
        where: {
          cartSessionId_productId_pickupWindowId_pickupDate: {
            cartSessionId: cart.id,
            productId: input.productId,
            pickupWindowId: input.pickupWindowId,
            pickupDate,
          },
        },
        update: {
          quantity: { increment: input.quantity },
          subTotal: { increment: lineTotal },
        },
        create: {
          cartSessionId: cart.id,
          productId: input.productId,
          quantity: input.quantity,
          unitPrice,
          subTotal: unitPrice * input.quantity,
          pickupWindowId: input.pickupWindowId,
          pickupDate,
        },
      });
    });
  },

  async updateItem(userId: string, itemId: string, input: UpdateCartItemInput) {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartSession: { userId } },
      include: {
        product: { include: { priceTiers: true } },
        cartSession: true,
      },
    });
    if (!item) throw ERR.CART_ITEM_NOT_FOUND;

    if (item.product.available < input.quantity) {
      throw ERR.INSUFFICIENT_STOCK({
        productId: item.productId,
        productName: item.product.nameEn,
        requested: input.quantity,
        available: item.product.available,
      });
    }

    const unitPrice = calcUnitPrice(input.quantity, item.product.priceTiers);
    return prisma.cartItem.update({
      where: { id: itemId, cartSession: { userId } },
      data: {
        quantity: input.quantity,
        unitPrice,
        subTotal: parseFloat((unitPrice * input.quantity).toFixed(2)),
      },
    });
  },

  // eliminate TOCTOU between ownership check and delete.
  // Previous pattern:
  //   1. findFirst  (ownership verified)         ← concurrent delete can land here
  //   2. deleteMany (returns { count: 0 }, no throw)  ← silent lie to caller
  // Fix: wrap both steps in one transaction.
  // findFirst still enforces row-level ownership (cartSession.userId).
  // delete by PK inside the same tx leaves no gap for a concurrent removal.
  // Prisma's delete throws P2025 if the row vanishes between steps,
  // which handleError maps to CART_ITEM_NOT_FOUND — no silent success.

  async removeItem(userId: string, itemId: string) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, cartSession: { userId } },
        select: { id: true },
      });

      if (!item) throw ERR.CART_ITEM_NOT_FOUND;

      await tx.cartItem.delete({ where: { id: item.id } });
      return { removed: 1 };
    });
  },

  async clearCart(userId: string) {
    const cart = await prisma.cartSession.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
    });
    if (!cart) return { removed: 0 };
    const { count } = await prisma.cartItem.deleteMany({
      where: { cartSessionId: cart.id },
    });
    return { removed: count };
  },

  // Summarize cart for GET response — totals computed not stored
  summarize(
    items: Array<{
      quantity: number;
      unitPrice: number;
      subTotal: number;
      product: { sellerId: string };
    }>,
  ) {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.subTotal, 0);
    const sellerIds = new Set(items.map((item) => item.product.sellerId));
    const sellerCount = sellerIds.size;

    return {
      totalItems: items.length,
      totalQuantity: totalQty,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      sellerCount,
    };
  },
};
