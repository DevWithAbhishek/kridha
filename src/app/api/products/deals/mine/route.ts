import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { GetSellerDealsSchema } from "@/schemas";
import { dealService } from "@/services/deal.service";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";


// GET /api/products/deals/mine — seller's own deal history (active + expired)
export async function GET(req: NextRequest) {
    try {
        const user = await requireRole(req, Role.SELLER);
        const q = GetSellerDealsSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
        const deals = await dealService.listMine(user.userId, q);
        return NextResponse.json({ success: true, data: deals });
    } catch (err) {
        return handleError(err);
    }
}