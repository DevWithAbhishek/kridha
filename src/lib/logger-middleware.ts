// Wraps Next.js App Router handlers to add structured request logging.
// Usage: export const GET = withLogger(handler, 'product.list');
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { logger } from "./logger";
import { getUser } from "./get-user";

type RouteHandler = (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>;

export function withLogger(
  handler: RouteHandler,
  action: string,
): RouteHandler {
  return async (req, ctx) => {
    const start = Date.now();
    const user = await getUser(req);
    const userId = user.userId ?? "anon";
    const method = req.method;
    const path = req.nextUrl.pathname;

    try {
      const res = await handler(req, ctx);
      logger.info(
        {
          userId,
          action,
          method,
          path,
          status: res.status,
          ms: Date.now() - start,
        },
        "request",
      );
      return res;
    } catch (err) {
      logger.error(
        { userId, action, method, path, err, ms: Date.now() - start },
        "request_failed",
      );
      throw err;
    }
  };
}
