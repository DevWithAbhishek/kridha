import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { releaseExpiredHoldsForProduct } from "@/lib/expiry";
import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { orderService } from "@/services/order.service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);

    const cart = await prisma.cartSession.findFirst({
      where: { userId: user.userId, expiresAt: { gt: new Date() } },
      include: { cartItems: true },
    });
    if (!cart) throw ERR.CART_EMPTY;

    // Release any expired holds on products in this cart
    // before attempting to lock stock for the new order
    const productIds = cart.cartItems.map((ci) => ci.productId);
    await Promise.all(
      productIds.map((id) => releaseExpiredHoldsForProduct(id)),
    );

    const result = await orderService.createFromCart(user.userId, cart.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: result.order.id,
          subOrders: result.subOrders.map(
            (s: {
              id: string;
              shortId: string;
              sellerId: string;
              totalAmount: number;
              advanceAmount: number;
              remainingAmount: number;
              status: string;
            }) => ({
              id: s.id,
              shortId: s.shortId,
              sellerId: s.sellerId,
              totalAmount: s.totalAmount,
              advanceAmount: s.advanceAmount,
              remainingAmount: s.remainingAmount,
              status: s.status,
            }),
          ),
          advance: {
            razorpayOrderId: result.razorpayOrderId,
            amount: result.totalAdvance,
            currency: "INR",
          },
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
