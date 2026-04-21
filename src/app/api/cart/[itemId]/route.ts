import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { UpdateCartItemSchema } from "@/schemas";
import { cartService } from "@/services/cart.service";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const user = await getUser(req);
    const { itemId } = await params;
    const body = UpdateCartItemSchema.parse(await req.json());
    const cartItem = await cartService.updateItem(user.userId, itemId, body);
    return NextResponse.json({
      success: true,
      message: "Quantity updated.",
      data: { cartItem },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const user = await getUser(req);
    const { itemId } = await params;
    await cartService.removeItem(user.userId, itemId);
    return NextResponse.json({
      success: true,
      message: "Item removed from cart.",
    });
  } catch (err) {
    return handleError(err);
  }
}
