import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { calcUnitPrice } from "@/lib/pricing";
import type { AddItemToCartInput, UpdateCartItemInput } from "@/schemas";

export const cartService = {
  // Get or create active CartSession for user
  // One active session per user — enforced here, one-to-many in DB
  async getOrCreate(userId: string) {
    let cart = await prisma.cartSession.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
      include: {
        cartItems: {
          include: {
            product: {
              include: {
                priceTiers: true,
                deals: {
                  where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
                  take: 1,
                },
                seller: {
                  select: {
                    storeName: true,
                    city: true,
                  },
                },
              },
            },
            pickupWindow: true,
          },
        },
      },
    });
    if (!cart) {
      cart = await prisma.cartSession.create({
        data: { userId, expiresAt: new Date(Date.now() + 30 * 60_000) },
        include: {
          cartItems: {
            include: {
              product: {
                include: {
                  priceTiers: true,
                  deals: {
                    where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
                    take: 1,
                  },
                  seller: {
                    select: {
                      storeName: true,
                      city: true,
                    },
                  },
                },
              },
              pickupWindow: true,
            },
          },
        },
      });
    }

    return cart;
  },

  async addItem(userId: string, input: AddItemToCartInput) {
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
    const dayOfWeek = pickupDate.getDay() === 0 ? 7 : pickupDate.getDay(); //Sun = 7
    if (!window.daysActive.includes(dayOfWeek)) throw ERR.INVALID_PICKUP_DATE;
    if (pickupDate < new Date()) throw ERR.INVALID_PICKUP_DATE;

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

    const cart = await this.getOrCreate(userId);
    // Extend cart expiry on activity
    await prisma.cartSession.update({
      where: { id: cart.id },
      data: { expiresAt: new Date(Date.now() + 30 * 60_000) },
    });

    // Add or update cart item
    return prisma.cartItem.create({
      data: {
        cartSessionId: cart.id,
        productId: input.productId,
        quantity: input.quantity,
        unitPrice,
        subTotal: parseFloat((unitPrice * input.quantity).toFixed(2)),
        pickupWindowId: input.pickupWindowId,
        pickupDate,
      },
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

  async removeItem(userId: string, itemId: string) {
    // Combines primary key lookup with a relation-based ownership check to enforce row-level security directly in the query.
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartSession: { userId } },
    });
    if (!item) throw ERR.CART_ITEM_NOT_FOUND;
    return prisma.cartItem.deleteMany({
      where: {
        id: itemId,
        cartSession: { userId },
      },
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
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const sellerIds = new Set(items.map((item) => item.product.sellerId));
    const sellerCount = sellerIds.size;
    return {
      totalItems: items.length,
      totalAmount: parseFloat(totalItems.toFixed(2)),
      sellerCount,
    };
  },
};
