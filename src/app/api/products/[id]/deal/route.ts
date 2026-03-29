import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { AddDealToProductSchema, EditDealToProductSchema } from "@/schemas";
import { dealService } from "@/services/deal.service";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// POST /api/products/:id/deal — add a deal to a product
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(req, Role.SELLER);
    const { id } = await params;
    const body = AddDealToProductSchema.parse(await req.json());
    const deal = await dealService.add(id, user.userId, body);
    return NextResponse.json(
      {
        success: true,
        data: { deal },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}

// PATCH /api/products/:id/deal — update active deal
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(req, Role.SELLER);
    const { id } = await params;
    const body = EditDealToProductSchema.parse(await req.json());
    const deal = await dealService.edit(id, user.userId, body);
    return NextResponse.json({ success: true, data: { deal } });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/products/:id/deal — expire active deal
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(req, Role.SELLER);
    const { id } = await params;
    await dealService.remove(id, user.userId);
    return NextResponse.json({ success: true, message: "Deal removed." });
  } catch (err) {
    return handleError(err);
  }
}
