// CRITICAL: prevents connection exhaustion on Vercel serverless
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Without this: every Vercel function invocation opens a new DB connection.
// Neon free tier has a connection limit. This singleton reuses the connection.
