/**
 * Redis client factory and helpers using ioredis
 */
import Redis from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.redisUrl || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

// ========== SESSION HELPERS ==========

export interface SessionRecord {
  submitter: `0x${string}`;
  createdAt: number;
  expiry: number;
  nonce: `0x${string}`;
  policy?: {
    maxPrompts?: number;
    allowedModels?: string[];
    maxGasWei?: string;
  };
  promptsUsed: number;
}

export async function getSession(id: string): Promise<SessionRecord | null> {
  const data = await redis.get(`session:${id}`);
  if (!data) return null;

  const rec = JSON.parse(data) as SessionRecord;

  // Double-check expiry
  if (Date.now() >= rec.expiry) {
    await redis.del(`session:${id}`);
    return null;
  }

  return rec;
}

export async function setSession(id: string, rec: SessionRecord, ttlSec: number): Promise<void> {
  await redis.setex(`session:${id}`, ttlSec, JSON.stringify(rec));
}

export async function delSession(id: string): Promise<void> {
  await redis.del(`session:${id}`);
}

export async function incrementSessionPrompts(id: string): Promise<number> {
  const data = await redis.get(`session:${id}`);
  if (!data) {
    throw new Error('Session not found');
  }

  const rec = JSON.parse(data) as SessionRecord;
  rec.promptsUsed += 1;

  const ttlSeconds = await redis.ttl(`session:${id}`);
  if (ttlSeconds > 0) {
    await redis.setex(`session:${id}`, ttlSeconds, JSON.stringify(rec));
  }

  return rec.promptsUsed;
}

// ========== IDEMPOTENCY HELPERS ==========

export async function getIdem(key: string): Promise<any | null> {
  const data = await redis.get(`idempotency:${key}`);
  return data ? JSON.parse(data) : null;
}

export async function setIdem(key: string, value: any, ttlSec: number = 600): Promise<void> {
  await redis.setex(`idempotency:${key}`, ttlSec, JSON.stringify(value));
}

// ========== REPLAY HELPERS ==========

export async function isReplay(key: string, ttlSec: number = 900): Promise<boolean> {
  const result = await redis.set(`replay:${key}`, '1', 'EX', ttlSec, 'NX');
  return result === null; // If SET NX returns null, key already existed
}

// ========== RATE LIMIT HELPERS ==========

export interface TokenBucketResult {
  allowed: boolean;
  remaining: number;
  resetSec: number;
}

/**
 * Token bucket rate limiter using Redis
 * Uses a Lua script for atomic operations
 */
const tokenBucketScript = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillPerSec = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(bucket[1]) or capacity
local lastRefill = tonumber(bucket[2]) or now

-- Refill tokens based on elapsed time
local elapsed = now - lastRefill
tokens = math.min(capacity, tokens + (elapsed * refillPerSec))

-- Try to consume
if tokens >= cost then
  tokens = tokens - cost
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
  redis.call('EXPIRE', key, 300)
  return {1, math.floor(tokens), 0}
else
  -- Rate limited - calculate retry time
  local tokensNeeded = cost - tokens
  local retryAfter = math.ceil(tokensNeeded / refillPerSec)
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
  redis.call('EXPIRE', key, 300)
  return {0, 0, retryAfter}
end
`;

export async function tokenBucket(
  key: string,
  capacity: number,
  refillPerSec: number,
  cost: number = 1
): Promise<TokenBucketResult> {
  const now = Date.now() / 1000;

  const result = await redis.eval(
    tokenBucketScript,
    1,
    key,
    capacity.toString(),
    refillPerSec.toString(),
    cost.toString(),
    now.toString()
  ) as number[];

  return {
    allowed: result[0] === 1,
    remaining: result[1],
    resetSec: result[2],
  };
}


