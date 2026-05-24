import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { CreateOrderSchema, GetOrdersSchema } from "@/schemas";
import { CreateItem, orderService } from "@/services/order.service";

// GET /api/orders — BUYER sees placed, SELLER sees received (same endpoint)
export async function GET(req: NextRequest) {
    try {
        const user = await getUser(req);
        const q = GetOrdersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
        const result = await orderService.getSubOrders(user.userId, q);
        return NextResponse.json({ success: true, data: result.subOrders, meta: result.meta });
    } catch (err) {
        return handleError(err);
    }
}

// POST /api/orders — direct order (not via cart); buyer only
export async function POST(req: NextRequest) {
    try {
        const user = await getUser(req);
        const body = CreateOrderSchema.parse(await req.json());
        const items: CreateItem[] = body.items.map(i => ({
            productId: i.productId,
            pickupWindowId: i.pickupWindowId,
            quantity: i.quantity,
            pickupDate: new Date(i.pickupDate),
        }));

        const result = await orderService.create(user.userId, items, body.cartSessionId);
        return NextResponse.json({
            success: true, data: {
                order: {
                    id: result.order.id,
                    totalAmount: result.order.totalAmount,
                    advanceAmount: result.totalAdvance,
                platformFee: result.order.platformFee,
                },
                subOrders: result.subOrders,
                advance: {
                    razorpayOrderId: result.razorpayOrderId,
                    amount: result.totalAdvance,
                    currency: 'INR'
                },
            }
        }, { status: 201 });
    } catch (err) {
        return handleError(err);
    }
}