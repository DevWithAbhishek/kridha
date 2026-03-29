import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { productService } from "@/services/product.service";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";


// GET /api/products/mine/:id — full detail of own product (seller)
export async function GET(
    req: NextRequest,
    { params } : {params: Promise <{id: string}>}
) {
    try {
        const user = requireRole(req, Role.SELLER);
        const { id } = await params;
        const product = await productService.getSellerProductById(id, user.userId);
        const response = {
          ...product,
          totalOrders: product?._count?.orderItems ?? 0,
          _count: undefined,
        };
        return NextResponse.json({ success: true, data: { product: response } });
    } catch (err) {
        return handleError(err);
    }
}