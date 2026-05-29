import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
};

const isProd = process.env.NODE_ENV === "production";

// ── Connection pool — created once, shared across all requests ─────────────
const pool =
  globalForPrisma.pgPool ??
  new pg.Pool({
    connectionString: isProd
      ? process.env.DATABASE_URL!
      : (process.env.DIRECT_URL ?? process.env.DATABASE_URL!),

    // ── Pool sizing ────────────────────────────────────────────────────────
    // Docker local:    no connection limit → set high
    // Supabase free:   max 60 direct / 200 pooled → use 15 to leave headroom
    max: isProd ? 15 : 50,

    // Kill idle connections after 30s to avoid holding Supabase slots
    idleTimeoutMillis: 30_000,

    // Fail fast if pool is exhausted — don't queue forever
    connectionTimeoutMillis: 5_000,

    // SSL required for Supabase, not needed for local Docker
    ssl: isProd ? { rejectUnauthorized: false } : false,
  });

if (!isProd) {
  globalForPrisma.pgPool = pool;
}

// ── Adapter — pass the pool, not a connection string ─────────────────────
const adapter = new PrismaPg(pool);

// ── Prisma client singleton ────────────────────────────────────────────────
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,

    log: !isProd ? ["warn", "error"] : ["error"],
  });

if (!isProd) {
  globalForPrisma.prisma = prisma;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 500,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isTransient =
        err instanceof Error &&
        (err.message.includes("Can't reach database") ||
          err.message.includes("connection") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("timeout"));

      if (!isTransient || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error("unreachable");
}
