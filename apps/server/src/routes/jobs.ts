import { FastifyInstance } from 'fastify';
import { submitJobOnChain } from '../blockchain.js';
import { buildArtifactFromPrompt } from '../attestation.js';
import { env, isAllowedChainId, isAllowedContract } from '../config/env.js';

const SKIP_ONCHAIN = true; // TEMP: force dev mode, should NEVER touch blockchain

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
import { verifyQuote, generatePlaceholderAttestation } from '../attestation/verify.js';
import { anchorReceipt } from '../receipt/anchor.js';
import { createPrivateInferenceEngine } from '../llm/engineFactory.js';
import type { Hex } from 'viem';
import { keccak256, toBytes } from 'viem';

const inferenceEngine = createPrivateInferenceEngine();

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
    const rateLimitResult = await rateLimitBySession(sessionId);
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

    // 8. Generate TEE attestation (placeholder)
    const placeholderQuote = generatePlaceholderAttestation(input);
    const quoteVerification = await verifyQuote(placeholderQuote);

    // 9. Create receipt and anchor it
    const receipt = {
      model,
      modelVersion: '1.0.0',
      inputHash: attestationHash,
      timestampIso: new Date().toISOString(),
      codeVersion: process.env.GIT_COMMIT || 'dev',
      enclaveDigest: quoteVerification.digest,
    };
    const receiptHash = keccak256(toBytes(JSON.stringify(receipt)));
    const anchor = await anchorReceipt(receiptHash);

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
      enclaveDigest: quoteVerification.digest,
      anchorTx: anchor.txHash,
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
      chainId: 6343,
    };
  });

  // DEV-ONLY: Inference without any blockchain interaction
  console.log('[ROUTE-REG] Registering POST /jobs/dev-test');
  fastify.post('/jobs/dev-test', async (request, reply) => {
    try {
      const body = request.body as { prompt?: string; model?: string };

      if (!body || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
        return reply.status(400).send({
          error: 'Validation failed',
          message: 'Field "prompt" is required and must be a non-empty string',
        });
      }

      const prompt = body.prompt.trim();
      const model = body.model ?? 'llama-3-8b-instruct';

      // Log so we can see in the backend that this dev route is being used
      fastify.log.warn(
        `[DEV-JOBS] /jobs/dev-test invoked. This route never touches the blockchain. Model=${model}`
      );

      // Run inference via the PrivateInferenceEngine abstraction
      const { answer, jobHash, attestation, model: resolvedModel, usedStub } =
        await inferenceEngine.infer(prompt, {
          model,
        });

      const response = {
        devMode: true,
        skipOnChain: true,
        signingMode: 'server' as const,

        // Fake on-chain-style fields so the frontend can reuse types if needed
        jobId: '0',
        txHash: null as string | null,
        receiptHash: null as string | null,
        attestationHash: jobHash,

        modelOutput: {
          text: answer,
          model: resolvedModel ?? model,
          usedStub: usedStub ?? false,
        },

        jobHash,
        attestation,
      };

      return reply.status(200).send(response);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`[DEV-JOBS] /jobs/dev-test failed: ${errMsg}`);

      return reply.status(500).send({
        error: 'Dev job failed',
        message: errMsg,
      });
    }
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
        // 3. Always build artifact / attestation hash (even in dev mode, so hash is deterministic)
        const { artifact, attestationHash } = buildArtifactFromPrompt(prompt);

        // 4. If SKIP_ONCHAIN is NOT set, run the original full on-chain path
        if (!SKIP_ONCHAIN) {
          const result = await submitJobOnChain(attestationHash as Hex, amountEth);

          // Generate TEE attestation (placeholder)
          const placeholderQuote = generatePlaceholderAttestation(prompt);
          const quoteVerification = await verifyQuote(placeholderQuote);

          // Create receipt and anchor it
          const receipt = {
            model: 'llama-3-8b-instruct',
            modelVersion: '1.0.0',
            inputHash: attestationHash,
            timestampIso: new Date().toISOString(),
            codeVersion: process.env.GIT_COMMIT || 'dev',
            enclaveDigest: quoteVerification.digest,
          };
          const receiptHash = keccak256(toBytes(JSON.stringify(receipt)));
          const anchor = await anchorReceipt(receiptHash);

          // Run model inference
          const { answer, jobHash, attestation, model, usedStub } =
            await inferenceEngine.infer(prompt, {
              model: 'llama-3-8b-instruct',
            });

          const response = {
            jobId: result.jobId.toString(),
            attestationHash: result.attestationHash,
            txHash: result.txHash,
            receiptHash: result.receiptHash || null,
            signingMode: 'server' as const,
            artifactPreview: artifact,
            enclaveDigest: quoteVerification.digest,
            anchorTx: anchor.txHash,
            modelOutput: {
              text: answer,
              model: model ?? 'llama-3-8b-instruct',
              usedStub: usedStub ?? false,
            },
            jobHash,
            attestation,
            devMode: false,
            skipOnChain: false,
          };

          if (idempotencyKey) {
            await setIdempotentResult(idempotencyKey, response);
          }

          audit(
            createAuditEvent({
              request,
              route: 'POST /jobs',
              mode: 'server',
              status: 200,
              result: 'ok',
              attestationHash: result.attestationHash,
              metadata: { devMode: false, skipOnChain: false },
            })
          );

          return response;
        }

        // 5. DEV MODE: SKIP_ONCHAIN is true -> do NOT touch the blockchain at all
        fastify.log.warn(
          '[SERVER] SKIP_ONCHAIN=1 -> skipping submitJobOnChain, anchorReceipt, verifyQuote'
        );

        const { answer, jobHash, attestation, model, usedStub } =
          await inferenceEngine.infer(prompt, {
            model: 'llama-3-8b-instruct',
          });

        const devResponse = {
          jobId: '0',
          attestationHash, // deterministic from prompt
          txHash: '0x' + '0'.repeat(64),
          receiptHash: null,
          signingMode: 'server' as const,
          artifactPreview: artifact,
          enclaveDigest: null as string | null,
          anchorTx: null as string | null,
          modelOutput: {
            text: answer,
            model: model ?? 'llama-3-8b-instruct',
            usedStub: usedStub ?? false,
          },
          jobHash,
          attestation,
          devMode: true,
          skipOnChain: true,
        };

        if (idempotencyKey) {
          await setIdempotentResult(idempotencyKey, devResponse);
        }

        audit(
          createAuditEvent({
            request,
            route: 'POST /jobs',
            mode: 'server',
            status: 200,
            result: 'ok',
            attestationHash,
            metadata: { devMode: true, skipOnChain: true },
          })
        );

        return devResponse;
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

        // 9. Generate TEE attestation (placeholder)
        const placeholderQuote = generatePlaceholderAttestation(clientRequest.payload.input);
        const quoteVerification = await verifyQuote(placeholderQuote);

        // 10. Create receipt and anchor it
        const receipt = {
          model: clientRequest.payload.model,
          modelVersion: '1.0.0',
          inputHash: attestationHash,
          timestampIso: new Date().toISOString(),
          codeVersion: process.env.GIT_COMMIT || 'dev',
          enclaveDigest: quoteVerification.digest,
        };
        const receiptHash = keccak256(toBytes(JSON.stringify(receipt)));
        const anchor = await anchorReceipt(receiptHash);

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
          enclaveDigest: quoteVerification.digest,
          anchorTx: anchor.txHash,
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
