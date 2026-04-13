import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { requireRole } from "@/lib/get-user";
import { handleError } from "@/lib/handleError";
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
    const user = requireRole(req, Role.SELLER);
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
    const user = requireRole(req, Role.SELLER);
    const body = AddPickupWindowSchema.parse(await req.json());

    const count = await prisma.pickupWindow.count({
      where: { sellerId: user.userId, deletedAt: null },
    });
    if (count >= MAX_PICKUP_WINDOWS) throw ERR.PICKUP_WINDOW_LIMIT;

    const window = await prisma.pickupWindow.create({
      data: {
        sellerId: user.userId,
        labelEn: body.labelEn,
        labelHi: body.labelHi,
        startTime: body.startTime,
        endTime: body.endTime,
        daysActive: body.daysActive.map((d) => DAY_MAP[d]),
      },
    });
    return NextResponse.json(
      {
        success: true,
        data: { pickupWindow: window },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
