
// src/lib/getAdmin.ts
// Reads x-admin-id + x-admin-role headers injected by middleware.
// Only valid inside /api/admin/* route handlers.
// Same pattern as getUser / requireRole for user routes.

import { NextRequest } from "next/server";
import { AdminRole } from "@prisma/client";
import { ERR } from "./errors";

interface RequestAdmin {
  adminId: string;
  role:    AdminRole;
}

export function getAdmin(req: NextRequest): RequestAdmin {
  const adminId = req.headers.get("x-admin-id");
  const role    = req.headers.get("x-admin-role") as AdminRole | null;
  if (!adminId || !role) throw ERR.UNAUTHENTICATED;
  return { adminId, role };
}

export function requireSuperAdmin(req: NextRequest): RequestAdmin {
  const admin = getAdmin(req);
  if (admin.role !== AdminRole.SUPER_ADMIN) throw ERR.ADMIN_FORBIDDEN;
  return admin;
}
