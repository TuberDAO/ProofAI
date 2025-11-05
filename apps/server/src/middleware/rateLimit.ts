/**
 * Token bucket rate limiting (Redis-backed)
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { tokenBucket } from '../storage/redis.js';

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

  const result = await tokenBucket(`ratelimit:ip:${ip}`, maxTokens, refillRate);

  if (!result.allowed) {
    reply.header('Retry-After', result.resetSec.toString());
    return reply.status(429).send({
      error: 'Rate limit exceeded',
      message: `Too many requests from this IP. Retry after ${result.resetSec} seconds.`,
      retryAfterSeconds: result.resetSec,
    });
  }
}

/**
 * Per-session rate limit for jobs
 */
export async function rateLimitBySession(sessionId: string): Promise<{
  allowed: boolean;
  retryAfter: number;
}> {
  const maxTokens = env.maxJobsPerMinute;
  const refillRate = maxTokens / 60; // tokens per second

  const result = await tokenBucket(`ratelimit:session:${sessionId}`, maxTokens, refillRate);

  return {
    allowed: result.allowed,
    retryAfter: result.resetSec,
  };
}












