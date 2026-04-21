import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { hasTimeOverlap, toMinutes } from "@/lib/window-validator";
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
    const user = await requireRole(req, Role.SELLER);
    const { id } = await params;
    const body = EditPickupWindowSchema.parse(await req.json());

    const updated = await prisma.$transaction(async (tx) => {
      const existingWindow = await tx.pickupWindow.findFirst({
        where: {
          id,
          sellerId: user.userId,
          deletedAt: null,
        },
      });

      if (!existingWindow) throw ERR.PICKUP_WINDOW_NOT_FOUND;

      const finalStart = body.startTime ?? existingWindow.startTime;
      const finalEnd = body.endTime ?? existingWindow.endTime;
      const finalDays = body.daysActive
        ? body.daysActive.map((d) => DAY_MAP2[d])
        : existingWindow.daysActive;

      const newStart = toMinutes(finalStart);
      const newEnd = toMinutes(finalEnd);

      if (newStart >= newEnd) {
        throw ERR.INVALID_TIME_RANGE;
      }

      const conflicts = await tx.pickupWindow.findMany({
        where: {
          sellerId: user.userId,
          deletedAt: null,
          id: { not: id }, //exclude self
          daysActive: { hasSome: finalDays },
        },
        select: {
          startTime: true,
          endTime: true,
        },
      });

      for (const w of conflicts) {
        const s = toMinutes(w.startTime);
        const e = toMinutes(w.endTime);

        if (hasTimeOverlap(newStart, newEnd, s, e)) {
          throw ERR.PICKUP_WINDOW_OVERLAP;
        }
      }

      return tx.pickupWindow.update({
        where: { id },
        data: {
          ...(body.labelEn !== undefined && { labelEn: body.labelEn }),
          ...(body.labelHi !== undefined && { labelHi: body.labelHi }),
          ...(body.startTime !== undefined && { startTime: body.startTime }),
          ...(body.endTime !== undefined && { endTime: body.endTime }),
          ...(body.daysActive !== undefined && {
            daysActive: finalDays,
          }),
        },
      });
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
    const user = await requireRole(req, Role.SELLER);
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
