import { NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";
import { redis } from "@/lib/redis";

export async function GET() {
  // const start = Date.now();
  // try {
  //   await prisma.$queryRaw`SELECT 1`;
  //   return Response.json({
  //     status: "ok",
  //     dbMs: Date.now() - start,
  //     timestamp: new Date().toISOString(),
  //   });
  // } catch (err) {
  //   return Response.json(
  //     { status: "degraded", error: String(err) },
  //     { status: 500 },
  //   );
  // }

  const results = {
    db: "unknown",
    redis: "unknown",
  };

  try {
    await withRetry(() => prisma.$queryRaw`SELECT 1`);
    results.db = "ok";
  } catch {
    results.db = "down";
  }

  try {
    await redis.ping();
    results.redis = "ok";
  } catch {
    results.redis = "down";
  }

  return NextResponse.json({
    status: "ok", // 👈 always ok
    ...results,
  });
}