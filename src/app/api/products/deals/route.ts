import { handleError } from "@/lib/handleError";
import { productRepo } from "@/repo/product.repo";
import { GetProductsWithActiveDealSchema } from "@/schemas";
import { NextRequest, NextResponse } from "next/server";

// GET /api/products/deals — public, all products with an active deal
export async function GET(req:NextRequest) {
    try {
      const q = GetProductsWithActiveDealSchema.parse(
        Object.fromEntries(req.nextUrl.searchParams),
      );

      //Reuse findNearBy with dealActive: true - no seller execution on this feed
      const result = await productRepo.findNearBy({
        ...q,
          dealActive: true,
      }, undefined);

      return NextResponse.json({ success: true, data: result });
    } catch (err) {
        return handleError(err);
    }
}