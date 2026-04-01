// Reads x-user-* headers set by middleware. Used in every protected route.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { ERR } from "./errors";

interface RequestUser {
  userId: string;
  roles: Role[];
}

export function getUser(req: NextRequest): RequestUser {
  const userId = req.headers.get("x-user-id");
  const roles = JSON.parse(req.headers.get("x-user-roles") ?? "[]") as Role[];
  if (!userId) throw ERR.UNAUTHENTICATED;
  return { userId, roles };
}

export function requireRole(req: NextRequest, role: Role): RequestUser {
  const user = getUser(req);
  if (!user.roles.includes(role) && !user.roles.includes(Role.ADMIN)) {
    throw ERR.FORBIDDEN;
  }
  return user;
}
