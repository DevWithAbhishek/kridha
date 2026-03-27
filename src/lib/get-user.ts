import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { ERR } from "./errors";

export interface RequestUser {
  userId: string;
  roles: Role[];
}

// Use in any route, as middleware has already verified the token
export function getUser(req: NextRequest): RequestUser {
  const userId = req.headers.get("x-user-id");
  const roles = JSON.parse(req.headers.get("x-user-roles") ?? "[]") as Role[];
  if (!userId) throw ERR.UNAUTHENTICATED;
  return { userId, roles };
}

// Use when a specific role is required (seller routes, etc)
export function requireRole(req: NextRequest, role: Role): RequestUser {
  const user = getUser(req);
  if (!user.roles.includes(role) && !user.roles.includes(Role.ADMIN)) throw ERR.FORBIDDEN;
  return user;
}
