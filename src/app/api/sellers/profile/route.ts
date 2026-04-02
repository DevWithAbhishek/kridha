// accountNumber masked to last 4 digits in all GET responses (INV-17).
// PATCH checks storeName+street uniqueness before updating.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { requireRole } from "@/lib/get-user";
import { EditSellerProfileSchema } from "@/schemas";
import { prisma } from "@/lib/db";
import { ERR } from "@/lib/errors";
import { Role } from "@prisma/client";

function maskAccount(n: string | null | undefined): string | null {
  if (!n) return null;
  return "****" + n.slice(-4);
}

export async function GET(req: NextRequest) {
  try {
    const user = requireRole(req, Role.SELLER);
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: user.userId },
      include: {
        pickupWindows: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!profile) throw ERR.NOT_FOUND("SellerProfile");

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          ...profile,
          accountNumber: maskAccount(profile.accountNumber),
        },
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = requireRole(req, Role.SELLER);
    const body = EditSellerProfileSchema.parse(await req.json());
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: user.userId },
    });
    if (!profile) throw ERR.NOT_FOUND("SellerProfile");

    if (body.storeName || body.street) {
      const newName = body.storeName ?? profile.storeName;
      const newStreet = body.street ?? profile.street;
      const conflict = await prisma.sellerProfile.findFirst({
        where: {
          storeName: newName,
          street: newStreet,
          NOT: { userId: user.userId },
        },
      });
      if (conflict) throw ERR.STORE_EXISTS;
    }

    const updated = await prisma.sellerProfile.update({
      where: { userId: user.userId },
      data: body,
    });

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          ...updated,
          accountNumber: maskAccount(updated.accountNumber),
        },
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
