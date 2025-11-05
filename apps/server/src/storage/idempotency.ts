/**
 * Idempotency key storage for job deduplication (Redis-backed)
 */
import { getIdem, setIdem } from './redis.js';

/**
 * Get cached result for idempotency key (10 min TTL)
 */
export async function getIdempotentResult(key: string): Promise<any | null> {
  return getIdem(key);
}

/**
 * Store result for idempotency key (10 min TTL)
 */
export async function setIdempotentResult(key: string, result: any): Promise<void> {
  await setIdem(key, result, 600);
}












