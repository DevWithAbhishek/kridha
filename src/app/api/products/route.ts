import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { requireRole } from "@/lib/get-user";
import { GetProductsSchema, AddProductSchema } from "@/schemas";
import { productService } from "@/services/product.service";
import { Role } from "@prisma/client";

// GET - public (middleware attaches user if logged in, optional)
export async function GET(req: NextRequest) {
  try {
    const q = GetProductsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    // Optional auth - exclude own products if seller
    const userId = req.headers.get("x-user-id") ?? undefined;
    const result = await productService.listNearby(q, userId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleError(err);
  }
}

// POST - sellers only (middleware already verified token; we check role)
export async function POST(req: NextRequest) {
  try {
    const user = requireRole(req, Role.SELLER);
    const body = AddProductSchema.parse(await req.json());
    const product = await productService.create(user.userId, body);
    return NextResponse.json(
      { success: true, data: { product } },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
