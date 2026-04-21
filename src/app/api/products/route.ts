import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { GetProductsSchema, AddProductSchema } from "@/schemas";
import { productService } from "@/services/product.service";
import { getUser } from "@/lib/get-user";

export async function GET(req: NextRequest) {
  try {
    const q = GetProductsSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    // Exclude own products from feed if caller is a seller (INV-14)
    const user = await getUser(req);
    const result = await productService.listNearBy(q, user.userId)
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleError(err);
  }
}