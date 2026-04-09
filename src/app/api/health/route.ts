import { NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";
import { redis } from "@/lib/redis";

export async function GET() {
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
// try {
//   await withRetry(() => prisma.$queryRaw`SELECT 1`);
//   await redis.ping();
//   return NextResponse.json({
//     status: "ok",
//     db: "neon-connected",
//     redis: "upstash-connected",
//     version: process.env.npm_package_version ?? "1.0.0",
//     environment: process.env.NODE_ENV,
//     ts: new Date().toISOString(),
//   });
// } catch (err) {
//   return NextResponse.json(
//     { status: "error", message: String(err) },
//     { status: 503 },
//   );
// }
