import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { EditPickupWindowSchema } from "@/schemas";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const DAY_MAP2: Record<string, number> = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 7,
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(req, Role.SELLER);
    const { id } = await params;
    const body = EditPickupWindowSchema.parse(await req.json());

    const window = await prisma.pickupWindow.findFirst({
      where: {
        id,
        sellerId: user.userId,
        deletedAt: null,
      },
    });
    if (!window) throw ERR.PICKUP_WINDOW_NOT_FOUND;

    const updated = await prisma.pickupWindow.update({
      where: { id },
      data: {
        ...(body.labelEn !== undefined ? { labelEn: body.labelEn } : {}),
        ...(body.labelHi !== undefined ? { labelHi: body.labelHi } : {}),
        ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
        ...(body.endTime !== undefined ? { endTime: body.endTime } : {}),
        ...(body.daysActive !== undefined
          ? { daysActive: body.daysActive.map((d) => DAY_MAP2[d]) }
          : {}),
      },
    });
    return NextResponse.json({
      success: true,
      data: { pickupWindow: updated },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(req, Role.SELLER);
    const { id } = await params;

    const window = await prisma.pickupWindow.findFirst({
      where: {
        id,
        sellerId: user.userId,
        deletedAt: null,
      },
    });
    if (!window) throw ERR.PICKUP_WINDOW_NOT_FOUND;

    // Cannot deleted the active window
    const activeCount = await prisma.pickupWindow.count({
      where: {
        sellerId: user.userId,
        deletedAt: null,
      },
    });
    if (activeCount <= 1) throw ERR.LAST_PICKUP_WINDOW;

    await prisma.pickupWindow.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
    return NextResponse.json({
      success: true,
      message: "Pickup window removed.",
    });
  } catch (err) {
    return handleError(err);
  }
}
