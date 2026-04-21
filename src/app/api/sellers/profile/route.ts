// accountNumber masked to last 4 digits in all GET responses (INV-17).
// PATCH checks storeName+street uniqueness before updating.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { requireRole } from "@/lib/get-user";
import { EditSellerProfileSchema } from "@/schemas";
import { ERR } from "@/lib/errors";
import { Role } from "@prisma/client";
import { sellerService } from "@/services/seller.service";

function maskAccount(n: string | null | undefined): string | null {
  if (!n) return null;
  return "****" + n.slice(-4);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole(req, Role.SELLER);
    const profile = await sellerService.getSellerProfile(user.userId);
    if (!profile) throw ERR.NOT_FOUND("SellerProfile");

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        accountNumber: maskAccount(profile.accountNumber),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole(req, Role.SELLER);
    const body = EditSellerProfileSchema.parse(await req.json());
    const profile = await sellerService.findSeller(user.userId);
    if (!profile) throw ERR.NOT_FOUND("SellerProfile");

    if (body.storeName || body.street) {
      const newName = body.storeName ?? profile.storeName;
      const newStreet = body.street ?? profile.street;
      const conflict = await sellerService.checkConflict(
        user.userId,
        newName,
        newStreet,
      );
      if (conflict) throw ERR.STORE_EXISTS;
    }

    if (body.businessType || body.gstNo || body.panNo || body.accountHolderName || body.accountNumber || body.bankName || body.ifscCode) {
      const valid = await sellerService.checkValidChange(user.userId);
      if (valid) {
        const updated = await sellerService.updateSellerCriticalDetails(user.userId, body);
      }
    }

    const updated = await sellerService.updateSellerProfile(user.userId, body);

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        accountNumber: maskAccount(updated.accountNumber),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
