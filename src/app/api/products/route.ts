import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { requireRole } from "@/lib/get-user";
import { GetProductsSchema, AddProductSchema } from "@/schemas";
import { productService } from "@/services/product.service";
import { Role } from "@prisma/client";

// GET /api/products — public, auth optional
// middleware.ts sets x-user-id if a valid cookie is present
export async function GET(req: NextRequest) {
  try {
    const q = GetProductsSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    // Exclude own products from feed if caller is a seller (INV-14)
    const userId = req.headers.get("x-user-id") ?? undefined;
    const result = await productService.listNearBy(q, userId)
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/products — seller only
export async function POST(req: NextRequest) {
  try {
    const user = requireRole(req, Role.SELLER);
    const body = AddProductSchema.parse(await req.json());
    const product = await productService.create(user.userId, body);
    return NextResponse.json({
      success: true,
      data: {product}
    }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}