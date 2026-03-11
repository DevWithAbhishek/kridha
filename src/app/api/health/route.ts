import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    return Response.json({
      status: "ok",
      db: "neon-connected",
      redis: "upstash-connected",
      version: process.env.npm_package_version ?? "1.0.0",
      environment: process.env.NODE_ENV,
    });
  } catch (err) {
    return Response.json(
      { status: "error", message: String(err) },
      { status: 503 },
    );
  }
}
