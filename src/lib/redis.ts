// src/lib/redis.ts — FINAL VERSION
// Dual-mode: Upstash (production Vercel) / local Redis (Docker dev)
// All helpers are null-safe and fail-open — Redis down = cache miss = DB query

import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger";

// ── Connection ─────────────────────────────────────────────────────────────

const isUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_URL.length > 0;

const isLocal = !!process.env.REDIS_URL && process.env.REDIS_URL.length > 0;

// Production: Upstash HTTP Redis (works in Vercel serverless)
export const upstash: UpstashRedis | null = isUpstash
  ? new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Development: local Docker Redis
let _localRedis: RedisClientType | null = null;

if (isLocal && !isUpstash) {
  _localRedis = createClient({
    url: process.env.REDIS_URL,
  }) as RedisClientType;

  _localRedis.connect().catch((err) => {
    logger.warn({ err }, "Local Redis unavailable — cache disabled in dev");
  });
}

// Unified ping for health endpoint
export async function redisPing(): Promise<string> {
  if (upstash) {
    await upstash.ping();
    return "PONG";
  }
  if (_localRedis) {
    return _localRedis.ping();
  }
  throw new Error("No Redis configured");
}

// ── TTL constants (seconds) ────────────────────────────────────────────────
// Shorter TTL = fresher data but more DB hits
// Longer TTL = stale data risk but huge DB relief

export const TTL = {
  PRODUCT_LIST: 60, // 1 min — product feed per location
  PRODUCT_DETAIL: 300, // 5 min — single product detail
  DEALS_LIST: 120, // 2 min — active deals feed
  DEAL_DETAIL: 300, // 5 min — single deal
  SELLER_PROFILE: 600, // 10 min — seller public profile
  NOTIFICATIONS: 30, // 30 sec — notifications list (user-specific)
  PLATFORM_CONFIG: 3600, // 1 hour — platform fee, config values
  PICKUP_WINDOWS: 3600, // 1 hour — pickup windows rarely change
  CART_SUMMARY: 60, // 1 min — cart item count for badge
} as const;

// ── Key builders — deterministic, consistent ──────────────────────────────

export const CK = {
  // Product list: per lat/lng/radius/page/filters
  // Round lat/lng to 3 decimal places (~111m precision) — nearby users share cache
  productList: (
    lat: number,
    lng: number,
    radius: number,
    page: number,
    filters: Record<string, string | number | boolean | undefined>,
  ): string => {
    const rLat = lat.toFixed(3);
    const rLng = lng.toFixed(3);
    const f = Object.entries(filters)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(":");
    return `kridha:products:${rLat}:${rLng}:${radius}:p${page}${f ? ":" + f : ""}`;
  },

  productDetail: (id: string): string => `kridha:product:${id}`,

  dealsList: (lat: number, lng: number, radius: number): string =>
    `kridha:deals:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`,

  sellerProfile: (userId: string): string => `kridha:seller:${userId}`,

  sellerProducts: (sellerId: string, page: number, status: string): string =>
    `kridha:seller-products:${sellerId}:${status}:p${page}`,

  notifications: (userId: string, page: number): string =>
    `kridha:notifs:${userId}:p${page}`,

  platformConfig: (): string => `kridha:platform-config`,

  pickupWindows: (sellerId: string): string =>
    `kridha:pickup-windows:${sellerId}`,

  cartSummary: (userId: string): string => `kridha:cart-summary:${userId}`,
};

// ── Core helpers — null-safe, fail-open ───────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    if (upstash) return await upstash.get<T>(key);
    if (_localRedis) {
      const raw = await _localRedis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    }
    return null;
  } catch (err) {
    logger.warn({ err, key }, "cache get failed — falling through to DB");
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
    if (_localRedis) {
      await _localRedis.setEx(key, ttlSeconds, JSON.stringify(value));
      return;
    }
  } catch (err) {
    logger.warn({ err, key }, "cache set failed — DB is source of truth");
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    if (upstash) {
      await upstash.del(...keys);
      return;
    }
    if (_localRedis) {
      await _localRedis.del(keys);
      return;
    }
  } catch (err) {
    logger.warn({ err, keys }, "cache del failed");
  }
}

// ── Pattern delete — invalidate groups of keys ────────────────────────────
// Used to invalidate all product lists when a product is updated/created

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    if (upstash) {
      // Upstash scan — paginate through matching keys
      let cursor = 0;
      do {
        const [nextCursor, keys] = await upstash.scan(cursor, {
          match: pattern,
          count: 100,
        });
        cursor = Number(nextCursor);
        if (keys.length > 0) await upstash.del(...(keys as string[]));
      } while (cursor !== 0);
      return;
    }
    if (_localRedis) {
      const keys = await _localRedis.keys(pattern);
      if (keys.length > 0) await _localRedis.del(keys);
      return;
    }
  } catch (err) {
    logger.warn({ err, pattern }, "cache pattern del failed");
  }
}

// ── Cache-aside helper — the standard pattern ──────────────────────────────
// Checks cache first, falls through to DB fn on miss, writes result to cache

export async function withCache<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>,
  options: { logHit?: boolean } = {},
): Promise<T> {
  const cached = await cacheGet<T>(key);

  if (cached !== null) {
    if (options.logHit) {
      logger.debug({ key }, "cache hit");
    }
    return cached;
  }

  // Cache miss — fetch from DB
  const result = await fetchFn();

  // Write to cache — fire and forget, never block the response
  cacheSet(key, result, ttl).catch(() => {});

  return result;
}

// ── Invalidation helpers — call after writes ──────────────────────────────

export const cacheInvalidate = {
  // After product created/updated/deleted
  async product(productId: string, sellerId: string): Promise<void> {
    await Promise.all([
      cacheDel(CK.productDetail(productId)),
      cacheDel(CK.sellerProducts(sellerId, 1, "ACTIVE")),
      cacheDelPattern("kridha:products:*"), // all product list pages
      cacheDelPattern("kridha:deals:*"), // deals may include this product
    ]);
  },

  // After seller profile updated
  async seller(sellerId: string): Promise<void> {
    await cacheDel(CK.sellerProfile(sellerId));
    cacheDelPattern(`kridha:seller-products:${sellerId}:*`).catch(() => {});
  },

  // After new notification created for user
  async notifications(userId: string): Promise<void> {
    cacheDelPattern(`kridha:notifs:${userId}:*`).catch(() => {});
  },

  // After pickup window updated
  async pickupWindows(sellerId: string): Promise<void> {
    await cacheDel(CK.pickupWindows(sellerId));
    cacheDelPattern("kridha:products:*").catch(() => {}); // products include windows
  },

  // After cart changes (for badge count)
  async cart(userId: string): Promise<void> {
    await cacheDel(CK.cartSummary(userId));
  },

  // After deal created/expired
  async deals(): Promise<void> {
    cacheDelPattern("kridha:deals:*").catch(() => {});
    cacheDelPattern("kridha:products:*").catch(() => {}); // products show deal prices
  },
};

// Export unified redis object for health check
export const redis = {
  ping: redisPing,
  get: cacheGet,
  set: cacheSet,
  del: cacheDel,
};
