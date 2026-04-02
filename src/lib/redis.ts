import { Redis } from "@upstash/redis";

// Upstash Redis singleton — HTTP-based, works in Vercel serverless.
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache-aside helpers used by productRepo.findNearby
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch {
    return null; // cache miss on error — always fall through to DB
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    /* non-fatal — DB is source of truth */
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length) await redis.del(...keys);
  } catch {
    /* non-fatal */
  }
}
