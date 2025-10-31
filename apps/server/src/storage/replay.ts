/**
 * Replay protection for PVA::JOB nonces (15 min cache)
 */
import { env } from '../config/env.js';
import { keccak256, toBytes } from 'viem';

interface NonceRecord {
  timestamp: number;
  expiry: number; // ms epoch
}

// In-memory store
const usedNonces = new Map<string, NonceRecord>();

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
    console.log('✅ Redis connected for replay protection');
  } catch (error) {
    console.warn('⚠️  Redis unavailable for replay, using in-memory');
    redisClient = null;
  }
}

// Initialize Redis if available
if (env.redisUrl) {
  initRedis().catch(console.error);
}

// Cleanup expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of usedNonces.entries()) {
    if (now >= record.expiry) {
      usedNonces.delete(key);
    }
  }
}, 2 * 60 * 1000);

/**
 * Create a unique key from job parameters (for replay detection)
 */
export function createJobKey(params: {
  attestationHash?: string;
  submitter: string;
  timestamp: number;
  payloadHash?: string;
}): string {
  const data = `${params.attestationHash || ''}${params.submitter}${params.timestamp}${params.payloadHash || ''}`;
  return keccak256(toBytes(data));
}

/**
 * Check if a job has been seen before (replay attack detection)
 */
export async function isReplay(jobKey: string): Promise<boolean> {
  if (redisClient) {
    try {
      const exists = await redisClient.exists(`replay:${jobKey}`);
      return exists === 1;
    } catch (error) {
      console.error('[Replay] Redis error:', error);
      return false;
    }
  } else {
    const record = usedNonces.get(jobKey);
    return record !== undefined && Date.now() < record.expiry;
  }
}

/**
 * Mark a job as seen (15 min TTL for replay window)
 */
export async function markAsSeen(jobKey: string): Promise<void> {
  const ttlSeconds = 15 * 60; // 15 minutes
  const expiry = Date.now() + ttlSeconds * 1000;
  const timestamp = Date.now();

  if (redisClient) {
    try {
      await redisClient.setEx(`replay:${jobKey}`, ttlSeconds, timestamp.toString());
    } catch (error) {
      console.error('[Replay] Redis error:', error);
    }
  } else {
    usedNonces.set(jobKey, { timestamp, expiry });
  }
}








