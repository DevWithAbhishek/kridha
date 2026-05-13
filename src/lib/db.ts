import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const isNeon = process.env.DATABASE_URL?.includes('neon.tech') ?? false;

async function buildPrismaClient() {
  if (isNeon) {
    // Production: Neon needs WebSocket adapter
    const { PrismaNeon } = await import("@prisma/adapter-neon");
    const { neonConfig } = await import("@neondatabase/serverless");
    const { WebSocket } = await import("ws");
    neonConfig.webSocketConstructor = WebSocket;
    const adapter = new PrismaNeon({
      connectionString: process.env.DATABASE_URL!,
    });
    return new PrismaClient({ adapter });
  }
  // Development: plain Prisma, standard TCP to Docker PostgreSQL
  return new PrismaClient();
}

// Singleton — prevents new connections on every hot reload in dev
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? await buildPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Retry wrapper for Neon cold-start P1001 errors
// Neon wakes in 1-4s — 4 retries with backoff covers it
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 4,
  delayMs = 1500,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isNeonColdStart =
        err instanceof Error &&
        (err.message.includes("P1001") ||
          err.message.includes("Can't reach database") ||
          err.message.includes("connection") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("network error") ||
          err.message.includes("non-101") ||
          err.message.includes("WebSocket"));

      if (!isNeonColdStart || attempt === retries) throw err

      // Wait and retry — Neon is waking up
      await new Promise(r => setTimeout(r, delayMs * attempt))
    }
  }
  throw new Error('unreachable')
}