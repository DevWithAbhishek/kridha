import { PrismaClient } from "@prisma/client";

// Singleton — prevents new connections on every hot reload in dev
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 500,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isTransient =
        err instanceof Error &&
        (err.message.includes("Can't reach database") ||
          err.message.includes("connection") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("timeout"));

      if (!isTransient || attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * attempt))
    }
  }
  throw new Error('unreachable')
}