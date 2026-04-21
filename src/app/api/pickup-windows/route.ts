import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
import { hasTimeOverlap, toMinutes } from "@/lib/window-validator";
import { AddPickupWindowSchema } from "@/schemas";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const DAY_MAP: Record<string, number> = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 7,
};
const REVERSE_DAY_MAP = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;
const MAX_PICKUP_WINDOWS = 7;

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole(req, Role.SELLER);
    const windows = await prisma.pickupWindow.findMany({
      where: { sellerId: user.userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const pickupWindows = windows.map((w) => ({
      ...w,
      daysActive: w.daysActive.map((d) => REVERSE_DAY_MAP[d - 1]),
    }));

    return NextResponse.json({
      success: true,
      data: pickupWindows,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(req, Role.SELLER);
    const body = AddPickupWindowSchema.parse(await req.json());

    const newDays = body.daysActive.map((d) => DAY_MAP[d]);
    const newStart = toMinutes(body.startTime);
    const newEnd = toMinutes(body.endTime);

    if (newStart >= newEnd) {
      throw ERR.INVALID_TIME_RANGE;
    }

    const window = await prisma.$transaction(async (tx) => {
      const count = await tx.pickupWindow.count({
        where: { sellerId: user.userId, deletedAt: null },
      });

      if (count >= MAX_PICKUP_WINDOWS) {
        throw ERR.PICKUP_WINDOW_LIMIT;
      }

      const existing = await tx.pickupWindow.findMany({
        where: {
          sellerId: user.userId,
          deletedAt: null,
          daysActive: { hasSome: newDays },
        },
        select: {
          startTime: true,
          endTime: true,
        },
      });

      for (const w of existing) {
        const s = toMinutes(w.startTime);
        const e = toMinutes(w.endTime);

        if (hasTimeOverlap(newStart, newEnd, s, e)) {
          throw ERR.PICKUP_WINDOW_OVERLAP;
        }
      }

      return tx.pickupWindow.create({
        data: {
          sellerId: user.userId,
          labelEn: body.labelEn,
          labelHi: body.labelHi,
          startTime: body.startTime,
          endTime: body.endTime,
          daysActive: newDays,
        },
      });
    });

    return NextResponse.json(
      { success: true, data: { pickupWindow: window } },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}