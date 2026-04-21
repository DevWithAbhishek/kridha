import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { AddItemToCartSchema } from "@/schemas";
import { cartService } from "@/services/cart.service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    const cart = await cartService.getOrCreate(user.userId);
    const summary = cartService.summarize(cart.cartItems);
    return NextResponse.json({
      success: true,
      data: {
        cart: {
          id: cart.id,
          expiresAt: cart.expiresAt,
          items: cart.cartItems,
          summary,
        },
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    const body = AddItemToCartSchema.parse(await req.json());
    const cartItem = await cartService.addItem(user.userId, body);
    return NextResponse.json(
      {
        success: true,
        message: "Item added to cart.",
        data: {
          cartItem,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    const result = await cartService.clearCart(user.userId);
    return NextResponse.json({
      success: true,
      message: "Cart cleared.",
      data: result,
    });
  } catch (err) {
    return handleError(err);
  }
}
