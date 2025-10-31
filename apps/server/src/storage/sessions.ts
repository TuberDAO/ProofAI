/**
 * Session storage with in-memory Map and optional Redis backend
 */
import { env } from '../config/env.js';

export interface SessionRecord {
  submitter: `0x${string}`;
  createdAt: number; // ms epoch
  expiry: number; // ms epoch
  nonce: `0x${string}`;
  policy?: {
    maxPrompts?: number;
    allowedModels?: string[];
    maxGasWei?: string;
  };
  promptsUsed: number;
}

// In-memory storage
const sessions = new Map<string, SessionRecord>();
const timeouts = new Map<string, NodeJS.Timeout>();

// Optional Redis client (feature-detect)
let redisClient: any = null;

async function initRedis() {
  if (!env.redisUrl) return;

  try {
    // Dynamic import to avoid compile-time dependency
    // @ts-ignore - redis is optional, not a compile-time dependency
    const redis = await import('redis').catch(() => null);
    if (!redis) {
      console.warn('⚠️  redis package not installed, using in-memory storage');
      return;
    }

    redisClient = redis.createClient({ url: env.redisUrl });
    await redisClient.connect();
    console.log('✅ Redis connected for session storage');
  } catch (error) {
    console.warn('⚠️  Redis unavailable, using in-memory storage:', error);
    redisClient = null;
  }
}

// Initialize Redis on module load if REDIS_URL is set
if (env.redisUrl) {
  initRedis().catch(console.error);
}

/**
 * Check if a session record is expired
 */
export function isExpired(rec: SessionRecord): boolean {
  return Date.now() >= rec.expiry;
}

/**
 * Create a new session
 */
export async function createSession(
  id: string,
  rec: SessionRecord
): Promise<void> {
  const ttlMs = rec.expiry - Date.now();

  if (ttlMs <= 0) {
    throw new Error('Cannot create session with expiry in the past');
  }

  if (redisClient) {
    // Store in Redis with TTL
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    await redisClient.setEx(
      `session:${id}`,
      ttlSeconds,
      JSON.stringify(rec)
    );
  } else {
    // Store in memory
    sessions.set(id, rec);

    // Schedule eviction
    const timeout = setTimeout(() => {
      sessions.delete(id);
      timeouts.delete(id);
    }, ttlMs);

    timeouts.set(id, timeout);
  }
}

/**
 * Get a session by ID
 */
export async function getSession(
  id: string
): Promise<SessionRecord | null> {
  if (redisClient) {
    const data = await redisClient.get(`session:${id}`);
    if (!data) return null;

    const rec = JSON.parse(data) as SessionRecord;
    
    // Double-check expiry
    if (isExpired(rec)) {
      await redisClient.del(`session:${id}`);
      return null;
    }

    return rec;
  } else {
    const rec = sessions.get(id);
    if (!rec) return null;

    // Check expiry
    if (isExpired(rec)) {
      sessions.delete(id);
      const timeout = timeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        timeouts.delete(id);
      }
      return null;
    }

    return rec;
  }
}

/**
 * Increment prompts used for a session
 * Returns the new prompt count
 */
export async function incrementPrompts(id: string): Promise<number> {
  if (redisClient) {
    const data = await redisClient.get(`session:${id}`);
    if (!data) {
      throw new Error('Session not found');
    }

    const rec = JSON.parse(data) as SessionRecord;
    rec.promptsUsed += 1;

    // Update with remaining TTL
    const ttlSeconds = await redisClient.ttl(`session:${id}`);
    if (ttlSeconds > 0) {
      await redisClient.setEx(
        `session:${id}`,
        ttlSeconds,
        JSON.stringify(rec)
      );
    }

    return rec.promptsUsed;
  } else {
    const rec = sessions.get(id);
    if (!rec) {
      throw new Error('Session not found');
    }

    rec.promptsUsed += 1;
    return rec.promptsUsed;
  }
}

/**
 * Invalidate a session (delete it)
 */
export async function invalidateSession(id: string): Promise<void> {
  if (redisClient) {
    await redisClient.del(`session:${id}`);
  } else {
    sessions.delete(id);
    const timeout = timeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.delete(id);
    }
  }
}

/**
 * Cleanup on shutdown
 */
export async function cleanup(): Promise<void> {
  // Clear all timeouts
  for (const timeout of timeouts.values()) {
    clearTimeout(timeout);
  }
  timeouts.clear();
  sessions.clear();

  // Disconnect Redis if connected
  if (redisClient) {
    await redisClient.quit();
  }
}

