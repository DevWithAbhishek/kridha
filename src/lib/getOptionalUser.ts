import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import jwt, { JwtPayload } from "jsonwebtoken";

interface RequestUser {
  userId: string;
  roles: Role[];
}

/**
 * Optional auth:
 * - Returns user if valid token exists
 * - Returns null if:
 *   - no token
 *   - invalid token
 *   - expired token
 * - NEVER throws
 *
 * Use this ONLY in public routes
 */
export async function getOptionalUser(
  req: NextRequest,
): Promise<RequestUser | null> {
  try {
    const token = req.cookies.get("kridha_access")?.value;

    if (!token) return null;

    const payload = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
    }) as JwtPayload;

    if (!payload || typeof payload !== "object" || !payload.userId) {
      return null;
    }

    return {
      userId: payload.userId,
      roles: payload.roles ?? [],
    };
  } catch {
    // 🔥 CRITICAL: swallow ALL errors
    return null;
  }
}
