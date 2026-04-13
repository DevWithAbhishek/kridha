
// src/app/api/admin/audit/route.ts
// GET — audit log, filterable by targetId (seller userId) or adminId

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { requireSuperAdmin } from "@/lib/getAdmin";
import { adminService } from "@/services/admin.service";

export async function GET(req: NextRequest) {
  try {
    requireSuperAdmin(req);
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get("targetId") ?? undefined;
    const adminId  = searchParams.get("adminId")  ?? undefined;
    const log = await adminService.getAuditLog(targetId, adminId);
    return NextResponse.json({ success: true, data: { log } });
  } catch (err) {
    return handleError(err);
  }
}
