
// src/app/api/admin/admins/route.ts
// GET  — list all admin users (SUPER_ADMIN only)
// POST — create a new admin user (SUPER_ADMIN only)

import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/handleError";
import { requireSuperAdmin } from "@/lib/getAdmin";
import { adminService } from "@/services/admin.service";
import { AdminCreateSchema } from "@/schemas/admin.schemas";

export async function GET(req: NextRequest) {
  try {
    requireSuperAdmin(req);
    const admins = await adminService.listAdmins();
    return NextResponse.json({ success: true, data: { admins } });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const creator = requireSuperAdmin(req);
    const body    = AdminCreateSchema.parse(await req.json());
    const admin   = await adminService.createAdmin(creator.adminId, body);
    return NextResponse.json({ success: true, data: { admin } }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
