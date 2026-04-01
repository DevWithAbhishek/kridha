import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getUser } from "@/lib/get-user";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const user = getUser(req);
    const result = await prisma.notification.updateMany({
      where: { userId: user.userId, read: false, deletedAt: null },
      data: { read: true },
    });
    return NextResponse.json({
      success: true,
      data: { updated: result.count },
    });
  } catch (err) {
    return handleError(err);
  }
}
