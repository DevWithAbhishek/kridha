import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { UpdateProductSchema } from "@/schemas";
import { productService } from "@/services/product.service";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// to fetch a single product by ID. PUBLIC route.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const product = await productService.getById(id);
    return NextResponse.json({ success: true, data: { product } });
  } catch (err) {
    return handleError(err);
  }
}

// to update a product by an authorized seller, seller only, must own product.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(req, Role.SELLER);
    const { id } = await params;
    const body = UpdateProductSchema.parse(await req.json());
    const product = await productService.update(id, user.userId, body);
    return NextResponse.json({ success: true, data: { product } });
  } catch (err) {
    return handleError(err);
  }
}

// to soft-delete a product for an authorized seller, seller only, must own product.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(req, Role.SELLER);
    const { id } = await params;
    await productService.softDelete(id, user.userId);
    return NextResponse.json({ success: true, message: "Product deleted." });
  } catch (err) {
    return handleError(err);
  }
}
