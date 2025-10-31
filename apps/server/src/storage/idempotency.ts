/**
 * Idempotency key storage for job deduplication
 */
import { env } from '../config/env.js';

interface CachedResult {
  result: any;
  expiry: number; // ms epoch
}

// In-memory store
const cache = new Map<string, CachedResult>();

// Optional Redis client
let redisClient: any = null;

async function initRedis() {
  if (!env.redisUrl) return;

  try {
    // @ts-ignore - redis is optional
    const redis = await import('redis').catch(() => null);
    if (!redis) return;

    redisClient = redis.createClient({ url: env.redisUrl });
    await redisClient.connect();
    console.log('✅ Redis connected for idempotency cache');
  } catch (error) {
    console.warn('⚠️  Redis unavailable for idempotency, using in-memory');
    redisClient = null;
  }
}

// Initialize Redis if available
if (env.redisUrl) {
  initRedis().catch(console.error);
}

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, cached] of cache.entries()) {
    if (now >= cached.expiry) {
      cache.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Get cached result for idempotency key (10 min TTL)
 */
export async function getIdempotentResult(key: string): Promise<any | null> {
  if (redisClient) {
    try {
      const data = await redisClient.get(`idempotency:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[Idempotency] Redis error:', error);
      return null;
    }
  } else {
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.result;
    }
    return null;
  }
}

/**
 * Store result for idempotency key (10 min TTL)
 */
export async function setIdempotentResult(
  key: string,
  result: any
): Promise<void> {
  const ttlSeconds = 10 * 60; // 10 minutes
  const expiry = Date.now() + ttlSeconds * 1000;

  if (redisClient) {
    try {
      await redisClient.setEx(
        `idempotency:${key}`,
        ttlSeconds,
        JSON.stringify(result)
      );
    } catch (error) {
      console.error('[Idempotency] Redis error:', error);
    }
  } else {
    cache.set(key, { result, expiry });
  }
}








