// src/lib/withLogger.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { logger } from "./logger";

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
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const log = logger.child({ requestId });

    try {
      const res = await handler(req, ctx);
      log.info(
        {
          action,
          method: req.method,
          path: req.nextUrl.pathname,
          status: res.status,
          ms: Date.now() - start,
        },
        "request",
      );
      return res;
    } catch (err) {
      log.error(
        {
          action,
          method: req.method,
          path: req.nextUrl.pathname,
          ms: Date.now() - start,
          err,
        },
        "request_failed",
      );
      throw err;
    }
  };
}
