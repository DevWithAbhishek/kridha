import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

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