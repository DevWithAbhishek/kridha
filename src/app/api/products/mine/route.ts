import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { AddProductSchema, GetSellerProductsSchema } from "@/schemas";
import { productService } from "@/services/product.service";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";


// GET /api/products/mine — seller dashboard product list
export async function GET(req: NextRequest) {
    try {
        const user = await requireRole(req, Role.SELLER);
        const q = GetSellerProductsSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
        const unmappedProducts = await productService.getSellerProducts(user.userId, q);
         
        // Map _count.orderItems -> totalOrders (computed, never stored)
        const products = unmappedProducts.map((p) => ({
          ...p,
          totalOrders: p._count.orderItems,
          _count: undefined,
        }));
        return NextResponse.json({ success: true, data: products });
    } catch (err) {
        return handleError(err);
    }
}

// POST /api/products — seller only
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(req, Role.SELLER);
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