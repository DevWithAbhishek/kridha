// Reads x-user-* headers set by middleware. Used in every protected route.
// ONLY call from inside /api/* route handlers.
// Middleware sets x-user-id ONLY for /api/:path* routes.
// Page Server Components must read cookies() directly.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { ERR } from "./errors";
import jwt, { JwtPayload } from "jsonwebtoken";
import { logger } from "./logger";

interface RequestUser {
  userId: string;
  roles: Role[];
}

export async function getUser(req: NextRequest): Promise<RequestUser> {
  try {
    const token = req.cookies.get("kridha_access")?.value;
    if (!token) throw ERR.UNAUTHENTICATED;
    const payload = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
    }) as JwtPayload;
    if (!payload || typeof payload !== "object" || !payload.userId) {
      throw ERR.UNAUTHENTICATED;
    }
    return { userId: payload.userId, roles: payload.roles };
  } catch (err) {
    logger.warn(
      {
        event: "auth.get_user_failed",
        path: req.nextUrl.pathname,
      },
      "unauthenticated request",
    );
    throw ERR.UNAUTHENTICATED;
  }
}

export async function requireRole(
  req: NextRequest,
  role: Role,
): Promise<RequestUser> {
  try {
    const user = await getUser(req);
    if (!user.roles.includes(role) && !user.roles.includes(Role.ADMIN)) {
      logger.warn(
        {
          event: "auth.forbidden",
          userId: user.userId,
          path: req.nextUrl.pathname,
        },
        "forbidden - insufficient role",
      );
      throw ERR.FORBIDDEN;
    }
    return user;
  } catch (err) {
    throw ERR.FORBIDDEN;
  }
}
