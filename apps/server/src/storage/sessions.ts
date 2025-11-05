/**
 * Session storage backed by Redis
 */
import {
  getSession as redisGetSession,
  setSession as redisSetSession,
  delSession as redisDelSession,
  incrementSessionPrompts as redisIncrementPrompts,
  type SessionRecord,
} from './redis.js';

export type { SessionRecord };

/**
 * Check if a session record is expired
 */
export function isExpired(rec: SessionRecord): boolean {
  return Date.now() >= rec.expiry;
}

/**
 * Create a new session
 */
export async function createSession(id: string, rec: SessionRecord): Promise<void> {
  const ttlMs = rec.expiry - Date.now();

  if (ttlMs <= 0) {
    throw new Error('Cannot create session with expiry in the past');
  }

  const ttlSeconds = Math.ceil(ttlMs / 1000);
  await redisSetSession(id, rec, ttlSeconds);
}

/**
 * Get a session by ID
 */
export async function getSession(id: string): Promise<SessionRecord | null> {
  return redisGetSession(id);
}

/**
 * Increment prompts used for a session
 * Returns the new prompt count
 */
export async function incrementPrompts(id: string): Promise<number> {
  return redisIncrementPrompts(id);
}

/**
 * Invalidate a session (delete it)
 */
export async function invalidateSession(id: string): Promise<void> {
  await redisDelSession(id);
}

/**
 * Cleanup on shutdown
 */
export async function cleanup(): Promise<void> {
  // Redis cleanup handled by redis.ts on process exit
}

