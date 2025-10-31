import { FastifyInstance } from 'fastify';
import { submitJobOnChain } from '../blockchain.js';
import { buildArtifactFromPrompt } from '../attestation.js';
import { env, isAllowedChainId, isAllowedContract } from '../config/env.js';
import { verifyClientSignature } from '../signature.js';
import { getSession, incrementPrompts, isExpired } from '../storage/sessions.js';
import {
  JobClientSchema, 
  JobServerSchema, 
  JobSessionSchema,
  type JobClientRequest,
  type JobServerRequest,
  type JobSessionRequest,
} from '../validation/schemas.js';
import { rateLimitByIP, rateLimitBySession } from '../middleware/rateLimit.js';
import { audit, createAuditEvent } from '../log/audit.js';
import { getIdempotentResult, setIdempotentResult } from '../storage/idempotency.js';
import { createJobKey, isReplay, markAsSeen } from '../storage/replay.js';
import type { Hex } from 'viem';

/**
 * Handle job submission with session authorization
 */
async function handleSessionJob(
  fastify: FastifyInstance,
  request: any,
  reply: any,
  sessionId: string
) {
  // 1. Validate request schema
  const parseResult = JobSessionSchema.safeParse(request.body);

  if (!parseResult.success) {
    const errMsg = parseResult.error.errors.map((e) => e.message).join('; ');
    
    audit(
      createAuditEvent({
        request,
        route: 'POST /jobs',
        mode: 'session',
        status: 400,
        result: 'error',
        sessionId,
        errCode: 'VALIDATION_ERROR',
        errMsg,
      })
    );

    return reply.status(400).send({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e: any) => e.message),
    });
  }

  const { model, input } = parseResult.data;

  // 2. Check idempotency
  const idempotencyKey = request.headers['x-idempotency-key'] as string | undefined;
  if (idempotencyKey) {
    const cached = await getIdempotentResult(idempotencyKey);
    if (cached) {
      fastify.log.info(`[SESSION] Idempotency hit: key=${idempotencyKey}`);
      return cached;
    }
  }

  try {
    // 3. Lookup session
    const session = await getSession(sessionId);

    if (!session) {
      audit(
        createAuditEvent({
          request,
          route: 'POST /jobs',
          mode: 'session',
          status: 401,
          result: 'error',
          sessionId,
          errCode: 'SESSION_NOT_FOUND',
          errMsg: 'Session not found or expired',
        })
      );

      return reply.status(401).send({
        error: 'Invalid session',
        message: 'Session not found or expired',
      });
    }

    if (isExpired(session)) {
      audit(
        createAuditEvent({
          request,
          route: 'POST /jobs',
          mode: 'session',
          status: 401,
          result: 'error',
          sessionId,
          submitter: session.submitter,
          errCode: 'SESSION_EXPIRED',
          errMsg: 'Session has expired',
        })
      );

      return reply.status(401).send({
        error: 'Session expired',
        message: 'Session has expired',
      });
    }

    // 4. Rate limit by session
    const rateLimitResult = rateLimitBySession(sessionId);
    if (!rateLimitResult.allowed) {
      audit(
        createAuditEvent({
          request,
          route: 'POST /jobs',
          mode: 'session',
          status: 429,
          result: 'error',
          sessionId,
          submitter: session.submitter,
          errCode: 'RATE_LIMIT_EXCEEDED',
          errMsg: `Rate limit exceeded for session`,
        })
      );

      return reply.status(429)
        .header('Retry-After', rateLimitResult.retryAfter.toString())
        .send({
          error: 'Rate limit exceeded',
          message: `Too many requests. Retry after ${rateLimitResult.retryAfter} seconds.`,
          retryAfterSeconds: rateLimitResult.retryAfter,
        });
    }

    // 5. Enforce policy
    if (session.policy) {
      // Check maxPrompts
      if (
        session.policy.maxPrompts !== undefined &&
        session.promptsUsed >= session.policy.maxPrompts
      ) {
        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'session',
            status: 429,
            result: 'error',
            sessionId,
            submitter: session.submitter,
            errCode: 'MAX_PROMPTS_EXCEEDED',
            errMsg: `Max prompts (${session.policy.maxPrompts}) reached`,
          })
        );

        return reply.status(429).send({
          error: 'Rate limit exceeded',
          message: `Maximum prompts (${session.policy.maxPrompts}) reached for this session`,
        });
      }

      // Check allowedModels
      if (
        session.policy.allowedModels &&
        session.policy.allowedModels.length > 0 &&
        !session.policy.allowedModels.includes(model)
      ) {
        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'session',
            status: 403,
            result: 'error',
            sessionId,
            submitter: session.submitter,
            errCode: 'MODEL_NOT_ALLOWED',
            errMsg: `Model "${model}" not in allowed list`,
            metadata: { model, allowedModels: session.policy.allowedModels },
          })
        );

        return reply.status(403).send({
          error: 'Model not allowed',
          message: `Model "${model}" not in allowed list: ${session.policy.allowedModels.join(', ')}`,
        });
      }
    }

    // 6. Increment prompts used
    const newCount = await incrementPrompts(sessionId);

    // 7. Build attestation and submit on-chain
    const { artifact, attestationHash } = buildArtifactFromPrompt(input);
    const amountEth = '0.0001'; // Default amount for session jobs

    const result = await submitJobOnChain(
      attestationHash as Hex,
      amountEth,
      session.submitter
    );

    const response = {
      jobId: result.jobId.toString(),
      attestationHash: result.attestationHash,
      txHash: result.txHash,
      receiptHash: result.receiptHash || null,
      signingMode: 'session' as const,
      submitter: session.submitter,
      sessionId,
      promptsUsed: newCount,
      artifactPreview: artifact,
    };

    // 8. Store idempotent result
    if (idempotencyKey) {
      await setIdempotentResult(idempotencyKey, response);
    }

    // 9. Audit success
    audit(
      createAuditEvent({
        request,
        route: 'POST /jobs',
        mode: 'session',
        status: 200,
        result: 'ok',
        sessionId,
        submitter: session.submitter,
        attestationHash: result.attestationHash,
        metadata: { model, promptsUsed: newCount },
      })
    );

    return response;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';

    audit(
      createAuditEvent({
        request,
        route: 'POST /jobs',
        mode: 'session',
        status: 500,
        result: 'error',
        sessionId,
        errCode: 'SUBMISSION_FAILED',
        errMsg,
      })
    );

    return reply.status(500).send({
      error: 'Job submission failed',
      message: errMsg,
    });
  }
}

export async function jobRoutes(fastify: FastifyInstance) {
  // Apply rate limiting to all job routes
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip rate limit for GET /jobs/mode
    if (request.method === 'GET' && request.url === '/jobs/mode') {
      return;
    }
    await rateLimitByIP(request, reply);
  });

  // GET /jobs/mode - Return current signing mode (unchanged)
  fastify.get('/jobs/mode', async () => {
    return {
      signingMode: env.signingMode,
      contractV1: env.jobRegistryAddress,
      contractV2: env.jobRegistryV2Address || null,
      chainId: 6342,
    };
  });

  // POST /jobs - Submit job (production-grade with all security features)
  fastify.post('/jobs', async (request, reply) => {
    // Check for session-based auth first
    const sessionId = 
      (request.headers['x-session-id'] as string) || 
      (request.body as any)?.sessionId;

    if (sessionId) {
      // ========== SESSION MODE ==========
      return handleSessionJob(fastify, request, reply, sessionId);
    }

    const signingMode = env.signingMode;

    // ========== SERVER MODE ==========
    if (signingMode === 'server') {
      // 1. Validate schema
      const parseResult = JobServerSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errMsg = parseResult.error.errors.map((e) => e.message).join('; ');
        
        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'server',
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

      const { prompt, amountEth } = parseResult.data;

      // 2. Check idempotency
      const idempotencyKey = request.headers['x-idempotency-key'] as string | undefined;
      if (idempotencyKey) {
        const cached = await getIdempotentResult(idempotencyKey);
        if (cached) {
          fastify.log.info(`[SERVER] Idempotency hit: key=${idempotencyKey}`);
          return cached;
        }
      }

      try {
        // 3. Build attestation and submit
        const { artifact, attestationHash } = buildArtifactFromPrompt(prompt);
        const result = await submitJobOnChain(attestationHash, amountEth);

        const response = {
          jobId: result.jobId.toString(),
          attestationHash: result.attestationHash,
          txHash: result.txHash,
          receiptHash: result.receiptHash || null,
          signingMode: 'server' as const,
          artifactPreview: artifact,
        };

        // 4. Store idempotent result
        if (idempotencyKey) {
          await setIdempotentResult(idempotencyKey, response);
        }

        // 5. Audit success
        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'server',
            status: 200,
            result: 'ok',
            attestationHash: result.attestationHash,
          })
        );

        return response;
      } catch (error) {
        const errMsg = (error as Error).message;

        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'server',
            status: 500,
            result: 'error',
            errCode: 'SUBMISSION_FAILED',
            errMsg,
          })
        );

        return reply.status(500).send({
          error: 'Job submission failed',
          message: errMsg,
        });
      }
    }

    // ========== CLIENT MODE ==========
    if (signingMode === 'client') {
      // 1. Validate schema
      const parseResult = JobClientSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errMsg = parseResult.error.errors.map((e) => e.message).join('; ');
        
        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'client',
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

      const clientRequest = parseResult.data;

      // 2. Enforce chain/contract allowlist
      if (!isAllowedChainId(clientRequest.chainId)) {
        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'client',
            status: 403,
            result: 'error',
            submitter: clientRequest.submitter,
            chainId: clientRequest.chainId,
            errCode: 'CHAIN_NOT_ALLOWED',
            errMsg: `Chain ID ${clientRequest.chainId} not in allowlist`,
          })
        );

        return reply.status(403).send({
          error: 'Chain not allowed',
          message: `Chain ID ${clientRequest.chainId} is not in the allowlist`,
        });
      }

      if (!isAllowedContract(clientRequest.contract)) {
        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'client',
            status: 403,
            result: 'error',
            submitter: clientRequest.submitter,
            contract: clientRequest.contract,
            errCode: 'CONTRACT_NOT_ALLOWED',
            errMsg: `Contract ${clientRequest.contract} not in allowlist`,
          })
        );

        return reply.status(403).send({
          error: 'Contract not allowed',
          message: `Contract ${clientRequest.contract} is not in the allowlist`,
        });
      }

      // 3. Check idempotency
      const idempotencyKey = request.headers['x-idempotency-key'] as string | undefined;
      if (idempotencyKey) {
        const cached = await getIdempotentResult(idempotencyKey);
        if (cached) {
          fastify.log.info(`[CLIENT] Idempotency hit: key=${idempotencyKey}`);
          return cached;
        }
      }

      try {
        // 4. Verify client signature using PVA::JOB format
        const verificationResult = await verifyClientSignature(clientRequest);

        // 5. Check for replay attack
        const jobKey = createJobKey({
          submitter: clientRequest.submitter,
          timestamp: clientRequest.timestamp,
          payloadHash: clientRequest.payloadHash,
        });

        if (await isReplay(jobKey)) {
          audit(
            createAuditEvent({
              request,
              route: 'POST /jobs',
              mode: 'client',
              status: 409,
              result: 'error',
              submitter: clientRequest.submitter,
              chainId: clientRequest.chainId,
              contract: clientRequest.contract,
              errCode: 'REPLAY_DETECTED',
              errMsg: 'Duplicate job submission detected',
            })
          );

          return reply.status(409).send({
            error: 'Replay detected',
            message: 'This job has already been submitted',
          });
        }

        // 6. Mark as seen (prevent replay)
        await markAsSeen(jobKey);

        // 7. Build attestation from the input for blockchain submission
        const { artifact, attestationHash } = buildArtifactFromPrompt(
          clientRequest.payload.input
        );

        // 8. Submit to chain (server pays gas, but tracks submitter)
        const amountEth = '0.0001'; // Default amount for client-signed jobs
        const result = await submitJobOnChain(
          attestationHash as Hex,
          amountEth,
          clientRequest.submitter as `0x${string}`
        );

        const response = {
          jobId: result.jobId.toString(),
          attestationHash: result.attestationHash,
          txHash: result.txHash,
          receiptHash: result.receiptHash || null,
          signingMode: 'client' as const,
          submitter: verificationResult.submitter,
          signer: verificationResult.submitter, // Alias for backward compatibility
          artifactPreview: artifact,
          payloadHash: clientRequest.payloadHash,
        };

        // 9. Store idempotent result
        if (idempotencyKey) {
          await setIdempotentResult(idempotencyKey, response);
        }

        // 10. Audit success
        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'client',
            status: 200,
            result: 'ok',
            submitter: clientRequest.submitter,
            chainId: clientRequest.chainId,
            contract: clientRequest.contract,
            attestationHash: result.attestationHash,
            metadata: { model: clientRequest.payload.model },
          })
        );

        return response;
      } catch (error) {
        const errMsg = (error as Error).message;

        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'client',
            status: 500,
            result: 'error',
            submitter: clientRequest.submitter,
            chainId: clientRequest.chainId,
            contract: clientRequest.contract,
            errCode: 'SUBMISSION_FAILED',
            errMsg,
          })
        );

        return reply.status(500).send({
          error: 'Job submission failed',
          message: errMsg,
        });
      }
    }

    // Unknown mode (should never happen due to env validation)
    return reply.status(500).send({
      error: 'Invalid signing mode',
      message: `Unknown SIGNING_MODE: ${signingMode}`,
    });
  });
}
