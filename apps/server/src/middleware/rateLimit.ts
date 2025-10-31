/**
 * Token bucket rate limiting (lightweight, no external deps)
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

// In-memory stores (per IP and per session)
const ipBuckets = new Map<string, TokenBucket>();
const sessionBuckets = new Map<string, TokenBucket>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Clean IP buckets
  for (const [ip, bucket] of ipBuckets.entries()) {
    if (now - bucket.lastRefill > fiveMinutes) {
      ipBuckets.delete(ip);
    }
  }

  // Clean session buckets
  for (const [sessionId, bucket] of sessionBuckets.entries()) {
    if (now - bucket.lastRefill > fiveMinutes) {
      sessionBuckets.delete(sessionId);
    }
  }
}, 60 * 1000); // Run every minute

/**
 * Token bucket rate limiter
 */
function checkRateLimit(
  key: string,
  maxTokens: number,
  refillRate: number, // tokens per second
  store: Map<string, TokenBucket>
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  let bucket = store.get(key);

  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now };
    store.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000; // seconds
  bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * refillRate);
  bucket.lastRefill = now;

  // Try to consume one token
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfter: 0 };
  }

  // Rate limited - calculate retry time
  const tokensNeeded = 1 - bucket.tokens;
  const retryAfter = Math.ceil(tokensNeeded / refillRate);

  return { allowed: false, retryAfter };
}

/**
 * Per-IP rate limit middleware
 */
export async function rateLimitByIP(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ip = request.ip || 'unknown';
  const maxTokens = env.maxReqsPerMinute;
  const refillRate = maxTokens / 60; // tokens per second

  const { allowed, retryAfter } = checkRateLimit(
    ip,
    maxTokens,
    refillRate,
    ipBuckets
  );

  if (!allowed) {
    reply.header('Retry-After', retryAfter.toString());
    return reply.status(429).send({
      error: 'Rate limit exceeded',
      message: `Too many requests from this IP. Retry after ${retryAfter} seconds.`,
      retryAfterSeconds: retryAfter,
    });
  }
}

/**
 * Per-session rate limit for jobs
 */
export function rateLimitBySession(sessionId: string): {
  allowed: boolean;
  retryAfter: number;
} {
  const maxTokens = env.maxJobsPerMinute;
  const refillRate = maxTokens / 60; // tokens per second

  return checkRateLimit(sessionId, maxTokens, refillRate, sessionBuckets);
}








