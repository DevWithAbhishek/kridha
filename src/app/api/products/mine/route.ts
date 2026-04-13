import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { GetSellerProductsSchema } from "@/schemas";
import { productService } from "@/services/product.service";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";


// GET /api/products/mine — seller dashboard product list
export async function GET(req: NextRequest) {
    try {
        const user = requireRole(req, Role.SELLER);
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