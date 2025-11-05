/**
 * Replay protection for PVA::JOB nonces (15 min cache, Redis-backed)
 */
import { keccak256, toBytes } from 'viem';
import { isReplay as redisIsReplay } from './redis.js';

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
 * This atomically checks and marks as seen using Redis SET NX
 */
export async function isReplay(jobKey: string): Promise<boolean> {
  return redisIsReplay(jobKey, 900); // 15 min TTL
}

/**
 * Mark a job as seen (15 min TTL for replay window)
 * Note: isReplay already marks as seen atomically
 */
export async function markAsSeen(jobKey: string): Promise<void> {
  // Already handled by isReplay using SET NX
  // This function kept for backward compatibility
}












