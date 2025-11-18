/**
 * Security headers and CORS middleware
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';

/**
 * Apply security headers to all responses
 */
export async function securityHeaders(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Prevent MIME sniffing
  reply.header('X-Content-Type-Options', 'nosniff');

  // Referrer policy
  reply.header('Referrer-Policy', 'no-referrer');

  // Cross-Origin policies
  reply.header('Cross-Origin-Opener-Policy', 'same-origin');
  reply.header('Cross-Origin-Resource-Policy', 'same-origin');

  // Content Security Policy (basic)
  reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

  // X-Frame-Options
  reply.header('X-Frame-Options', 'DENY');

  // Note: HSTS is omitted for local dev; add in production behind TLS:
  // reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

/**
 * Validate origin against allowlist
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  return env.originAllowlist.some(
    (allowed) => origin === allowed || origin.startsWith(allowed)
  );
}














