import { NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";
import { redis } from "@/lib/redis";

export async function GET() {
  const results = {
    db: "down",
    redis: "down",
  };

  try {
    await withRetry(() => prisma.$queryRaw`SELECT 1`);
    results.db = "ok";
  } catch {}

  try {
    await redis.ping();
    results.redis = "ok";
  } catch {}

  const overall =
    results.db === "ok" && results.redis === "ok"
      ? "ok"
      : results.db === "ok" || results.redis === "ok"
        ? "degraded"
        : "down";

  return NextResponse.json({
    status: overall,
    ...results,
    timestamp: new Date().toISOString(),
  });
}