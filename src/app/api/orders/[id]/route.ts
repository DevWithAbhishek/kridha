import { ERR } from "@/lib/errors";
import { getUser} from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { orderRepo } from "@/repo/order.repo";
import { NextRequest, NextResponse } from "next/server";


export async function GET(
    req: NextRequest,
    {params} : {params: Promise<{id: string}>}
) {
    try {
        const user = await getUser(req);
        const { id } = await params;
        const subOrder = await orderRepo.findSubOrderById(id);
        if (!subOrder) throw ERR.SUBORDER_NOT_FOUND;

        // Ownership check: buyer OR seller OR admin (INV-05)
        if (
          subOrder.order.buyerId !== user.userId &&
          subOrder.sellerId !== user.userId &&
          !user.roles.includes("ADMIN")
        )
          throw ERR.FORBIDDEN;

        return NextResponse.json({ success: true, data: subOrder });
    } catch (err) {
        return handleError(err);
    }
}