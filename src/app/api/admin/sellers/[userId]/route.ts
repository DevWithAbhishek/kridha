
// src/app/api/admin/sellers/[userId]/route.ts
// GET   — seller detail with UNMASKED bank details (admin only)
// PATCH — verify, reject, or suspend a seller

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/handleError";
import { getAdmin, requireSuperAdmin } from "@/lib/getAdmin";
import { adminService } from "@/services/admin.service";
import { AdminVerifySellerSchema, AdminSuspendSchema } from "@/schemas/admin.schemas";

type Params = { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    getAdmin(req);
    const { userId } = await params;
    const seller = await adminService.getSellerDetail(userId);
    return NextResponse.json({ success: true, data: { seller } });
  } catch (err) {
    return handleError(err);
  }
}

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("VERIFY"),  note: z.string().max(500).optional() }),
  z.object({ action: z.literal("REJECT"),  note: z.string().max(500).optional() }),
  z.object({ action: z.literal("SUSPEND"), note: z.string().min(10).max(500) }),
]);

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await params;
    const body  = PatchSchema.parse(await req.json());

    if (body.action === "VERIFY") {
      const admin = getAdmin(req);
      const result = await adminService.verifySeller(admin.adminId, userId, { note: body.note });
      return NextResponse.json({ success: true, data: result });
    }

    if (body.action === "REJECT") {
      const admin = getAdmin(req);
      const result = await adminService.rejectSeller(admin.adminId, userId, { note: body.note });
      return NextResponse.json({ success: true, data: result });
    }

    if (body.action === "SUSPEND") {
      // Suspension requires SUPER_ADMIN
      const admin = requireSuperAdmin(req);
      const result = await adminService.suspendSeller(admin.adminId, userId, body.note);
      return NextResponse.json({ success: true, data: result });
    }

  } catch (err) {
    return handleError(err);
  }
}
