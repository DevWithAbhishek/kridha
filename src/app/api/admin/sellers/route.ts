
// src/app/api/admin/sellers/route.ts
// GET  — list sellers with optional status filter + pagination
// Middleware has already verified kridha_admin and injected x-admin-id + x-admin-role.

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { getAdmin } from "@/lib/getAdmin";
import { adminService } from "@/services/admin.service";

export async function GET(req: NextRequest) {
  try {
    getAdmin(req); // verifies headers set by middleware — throws 401 if missing

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const page   = parseInt(searchParams.get("page") ?? "1", 10);

    const result = await adminService.listSellers(status, page);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleError(err);
  }
}
