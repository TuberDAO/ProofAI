import { FastifyInstance } from 'fastify';
import { verifySessionSignature } from '../signature.js';
import {
  createSession,
  getSession,
  isExpired,
  type SessionRecord,
} from '../storage/sessions.js';
import { env, isAllowedChainId, isAllowedContract } from '../config/env.js';
import { SessionCreateSchema } from '../validation/schemas.js';
import { rateLimitByIP } from '../middleware/rateLimit.js';
import { audit, createAuditEvent } from '../log/audit.js';

export async function sessionRoutes(fastify: FastifyInstance) {
  // Apply rate limiting to all session routes
  fastify.addHook('preHandler', rateLimitByIP);
  // POST /sessions - Create a new session
  fastify.post('/sessions', async (request, reply) => {
    // 1. Validate request schema
    const parseResult = SessionCreateSchema.safeParse(request.body);

    if (!parseResult.success) {
      const errMsg = parseResult.error.errors.map((e) => e.message).join('; ');
      
      audit(
        createAuditEvent({
          request,
          route: 'POST /sessions',
          mode: 'session',
          status: 400,
          result: 'error',
          errCode: 'VALIDATION_ERROR',
          errMsg,
        })
      );

      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const data = parseResult.data;

    // 2. Enforce chain/contract allowlist
    if (!isAllowedChainId(data.chainId)) {
      audit(
        createAuditEvent({
          request,
          route: 'POST /sessions',
          mode: 'session',
          status: 403,
          result: 'error',
          chainId: data.chainId,
          errCode: 'CHAIN_NOT_ALLOWED',
          errMsg: `Chain ID ${data.chainId} not in allowlist`,
        })
      );

      return reply.status(403).send({
        error: 'Chain not allowed',
        message: `Chain ID ${data.chainId} is not in the allowlist`,
      });
    }

    if (!isAllowedContract(data.contract)) {
      audit(
        createAuditEvent({
          request,
          route: 'POST /sessions',
          mode: 'session',
          status: 403,
          result: 'error',
          contract: data.contract,
          errCode: 'CONTRACT_NOT_ALLOWED',
          errMsg: `Contract ${data.contract} not in allowlist`,
        })
      );

      return reply.status(403).send({
        error: 'Contract not allowed',
        message: `Contract ${data.contract} is not in the allowlist`,
      });
    }

    try {
      // 3. Verify the signature and get sessionId
      const verification = await verifySessionSignature(data);

      // 4. Create session record
      const now = Date.now();
      const expiryMs = data.expiry * 1000; // Convert to ms

      const sessionRecord: SessionRecord = {
        submitter: data.submitter as `0x${string}`,
        createdAt: now,
        expiry: expiryMs,
        nonce: data.nonce as `0x${string}`,
        policy: data.policy || { maxPrompts: 100 }, // Default policy
        promptsUsed: 0,
      };

      // 5. Store session with TTL
      await createSession(verification.sessionId, sessionRecord);

      // 6. Audit success
      audit(
        createAuditEvent({
          request,
          route: 'POST /sessions',
          mode: 'session',
          status: 200,
          result: 'ok',
          sessionId: verification.sessionId,
          submitter: verification.submitter,
          chainId: data.chainId,
          contract: data.contract,
        })
      );

      return {
        sessionId: verification.sessionId,
        expiry: data.expiry,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';

      audit(
        createAuditEvent({
          request,
          route: 'POST /sessions',
          mode: 'session',
          status: 400,
          result: 'error',
          submitter: data.submitter,
          chainId: data.chainId,
          contract: data.contract,
          errCode: 'VERIFICATION_FAILED',
          errMsg,
        })
      );

      return reply.status(400).send({
        error: 'Session creation failed',
        message: errMsg,
      });
    }
  });

  // GET /sessions/:id - Get session info
  fastify.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const session = await getSession(id);

      if (!session) {
        return { valid: false };
      }

      if (isExpired(session)) {
        return { valid: false };
      }

      const remainingMs = session.expiry - Date.now();

      return {
        valid: true,
        submitter: session.submitter,
        expiry: Math.floor(session.expiry / 1000),
        expiryMs: session.expiry,
        remaining: Math.floor(remainingMs / 1000),
        remainingMs,
        promptsUsed: session.promptsUsed,
        policy: session.policy,
      };
    } catch (error) {
      fastify.log.error({ err: error }, '[SESSION] Session lookup failed');
      return { valid: false };
    }
  });
}
