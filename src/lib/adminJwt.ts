
// src/lib/adminJwt.ts
// Completely separate JWT secret from user tokens.
// Admin token: short-lived (2h), HttpOnly, path=/api/admin.
// Never reuses JWT_SECRET — compromise of one does not affect the other.

import jwt from "jsonwebtoken";
import { ERR } from "./errors";

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET!;
const EXPIRY = "2h";

interface AdminJwtPayload {
  adminId: string;
  role:    string;
  type:    "admin"; // type guard — prevents user tokens being accepted here
}

export function signAdminToken(adminId: string, role: string): string {
  return jwt.sign(
    { adminId, role, type: "admin" } satisfies AdminJwtPayload,
    ADMIN_JWT_SECRET,
    { expiresIn: EXPIRY },
  );
}

export function verifyAdminToken(token: string): AdminJwtPayload {
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET, {
      algorithms: ["HS256"],
    }) as AdminJwtPayload;
    if (payload.type !== "admin") throw new Error("wrong token type");
    return payload;
  } catch {
    throw ERR.UNAUTHENTICATED;
  }
}
