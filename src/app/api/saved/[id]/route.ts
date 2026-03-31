import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { getUser } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { NextRequest, NextResponse } from "next/server";


export async function DELETE(
    req: NextRequest,
    {params} : {params: Promise<{id: string}>}
) {
    try {
        const user = getUser(req);
        const { id } = await params;
        const saved = await prisma.savedProduct.findUnique({ where: { id } });
        if (!saved) throw ERR.SAVED_PRODUCT_NOT_FOUND;
        if (saved.userId !== user.userId) throw ERR.FORBIDDEN;
        await prisma.savedProduct.delete({ where: { id } });
        return NextResponse.json({success: true, message: 'Removed from saved.'})
    } catch (err) {
        return handleError(err);
    }
}