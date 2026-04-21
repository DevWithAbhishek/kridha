// src/app/api/products/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { requireRole } from "@/lib/get-user";
import { UpdateProductSchema } from "@/schemas";
import { productService } from "@/services/product.service";
import { Role } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// GET /api/products/mine/:id — public
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const product = await productService.getById(id);
    return NextResponse.json({ success: true, data: product });
  } catch (err) {
    return handleError(err);
  }
}

// PATCH /api/products/mine/:id — seller only, must own the product
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(req, Role.SELLER);
    const { id } = await params;
    const body = UpdateProductSchema.parse(await req.json());
    const product = await productService.update(id, user.userId, body);
    return NextResponse.json({ success: true, data: { product } });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/products/:id — soft delete, seller only, active order guard in service
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(req, Role.SELLER);
    const { id } = await params;
    await productService.softDelete(id, user.userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
