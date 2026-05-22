import { Ratelimit } from "@upstash/ratelimit";
import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient } from "redis";
import { logger } from "./logger";

const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL?.length;

// Upstash-based limiter (production)
function makeUpstashLimiters() {
  const redis = new UpstashRedis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return {
    generalLimiter: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
    }),
    authLimiter: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
    }),
    adminAuthLimiter: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 m"),
    }),
    accountLimiter: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "15 m"), //per account
    }),
    globalAuthLimiter: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3000, "1 m"), //platform-wide
    }),
    refreshLimiter: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
    }),
  };
}

//Local Redis sliding window implementation
class LocalRateLimit {
  private client: ReturnType<typeof createClient>;
  private limit: number;
  private window: number; //ttlSeconds

  constructor(
    client: ReturnType<typeof createClient>,
    limit: number,
    windowSeconds: number,
  ) {
    this.client = client;
    this.limit = limit;
    this.window = windowSeconds;
  }

  async check(key: string): Promise<{ success: boolean; remaining: number }> {
    try {
      const now = Date.now();
      const windowMs = this.window * 1000;
      const redisKey = `rl:${key}`;

      // Sliding window using sorted set
      // Score = timestamp, member = unique request id
      await this.client.zRemRangeByScore(redisKey, 0, now - windowMs);
      const count = await this.client.zCard(redisKey);

      if (count >= this.limit) {
        return { success: false, remaining: 0 };
      }

      await this.client.zAdd(redisKey, {
        score: now,
        value: `${crypto.randomUUID()}`,
      });
      await this.client.expire(redisKey, this.window);

      return { success: true, remaining: this.limit - count - 1 };
    } catch (err) {
      return { success: true, remaining: this.limit }; // fail-open
    }
  }
}

async function makeLocalLimiters() {
  const client = createClient({
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  });
  await client
    .connect()
    .catch(() =>
      logger.warn({}, "Local Redis unavailable - rate limiting disabled"),
  );
  
  
  const make = (limit: number, windowSec: number) =>
    new LocalRateLimit(client, limit, windowSec);

  const generalLimiter = make(60, 60);
  const authLimiter = make(5, 60);
  const adminAuthLimiter = make(3, 60);
  const accountLimiter = make(10, 900);
  const globalAuthLimiter = make(3000, 60);
  const refreshLimiter = make(30, 60);

  return {
    generalLimiter: {
      limit: (k: string) => generalLimiter.check(k),
    },
    authLimiter: {
      limit: (k: string) => authLimiter.check(k),
    },
    adminAuthLimiter: {
      limit: (k: string) => adminAuthLimiter.check(k),
    },
    accountLimiter: {
      limit: (k: string) => accountLimiter.check(k),
    },
    globalAuthLimiter: {
      limit: (k: string) => globalAuthLimiter.check(k),
    },
    refreshLimiter: {
      limit: (k: string) => refreshLimiter.check(k),
    }
  };
}

// Export - resolved at module load
export const limiters = hasUpstash
  ? makeUpstashLimiters()
  : await makeLocalLimiters();
