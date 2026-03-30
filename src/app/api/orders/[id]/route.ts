import { ERR } from "@/lib/errors";
import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { orderRepo } from "@/repo/order.repo";
import { NextRequest, NextResponse } from "next/server";


export async function GET(
    req: NextRequest,
    {params} : {params: Promise<{id: string}>}
) {
    try {
        const user = getUser(req);
        const { id } = await params;
        const sub = await orderRepo.findSubOrderById(id);
        if (!sub) throw ERR.SUBORDER_NOT_FOUND;

        // Ownership check: buyer OR seller OR admin (INV-05)
        const roles = JSON.parse(req.headers.get('x-user-roles') ?? '[]') as string[];
        if (sub.order.buyerId !== user.userId && sub.sellerId !== user.userId && !roles.includes('ADMIN')) throw ERR.FORBIDDEN;

        return NextResponse.json({ success: true, data: { subOrder: sub } });
    } catch (err) {
        return handleError(err);
    }
}