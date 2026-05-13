import { Redis } from "@upstash/redis";
import { createClient, RedisClientType } from "redis";

const isUpstash = !!process.env.UPSTASH_REDIS_REST_URL;
const isLocal = !!process.env.REDIS_URL;

// Upstash client (production)
const upstash: Redis | null = isUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Local Redis client (development Docker)
let localRedis: RedisClientType | null = null;

if (isLocal && !isUpstash) {
  localRedis = createClient({ url: process.env.REDIS_URL }) as RedisClientType;
  localRedis
    .connect()
    .catch((err) =>
      console.warn("Local Redis unavailable — cache disabled:", err.message),
    );
}
// Cache-aside helpers used by productRepo.findNearby
// ── Unified helpers — null-safe, work with both clients ────────────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    if (upstash) return await upstash.get<T>(key);
    if (localRedis) return JSON.parse((await localRedis.get(key)) ?? "null");
    return null; // no redis configured — always cache miss
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    if (upstash) {
      await upstash.set(key, value, { ex: ttlSeconds });
      return;
    }
    if (localRedis) {
      await localRedis.setEx(key, ttlSeconds, JSON.stringify(value));
      return;
    }
    // no redis — skip silently
  } catch {
    /* non-fatal */
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    if (upstash) {
      await upstash.del(...keys);
      return;
    }
    if (localRedis) {
      await localRedis.del(keys);
      return;
    }
  } catch {
    /* non-fatal */
  }
}
