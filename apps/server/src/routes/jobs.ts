import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { submitJobOnChain } from '../blockchain.js';
import { buildArtifactFromPrompt } from '../attestation.js';
import { env } from '../config/env.js';
import {
  verifyJobSignature,
  verifyPayloadContext,
  verifyTimestamp,
  type SignedJobPayload,
} from '../signature.js';
import type { Hex } from 'viem';

// Base schema for both modes
const baseJobSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'Prompt cannot be empty')
    .max(8000, 'Prompt too long (maximum 8,000 characters)'),
  amountEth: z.string().default('0.0001'),
});

// Extended schema for client mode
const clientJobSchema = baseJobSchema.extend({
  signer: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid signer address'),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'Invalid signature'),
  attestationHash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid attestation hash'),
  timestampIso: z.string(),
  nonce: z.string(),
  chainId: z.number(),
  contractAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  artifactPreview: z.object({
    model: z.string(),
    modelVersion: z.string(),
    inputHash: z.string(),
    timestampIso: z.string(),
    codeVersion: z.string(),
    nonce: z.string(),
  }),
});

export async function jobRoutes(fastify: FastifyInstance) {
  // GET /jobs/mode - Return current signing mode
  fastify.get('/jobs/mode', async () => {
    return {
      signingMode: env.signingMode,
      contractV1: env.jobRegistryAddress,
      contractV2: env.jobRegistryV2Address || null,
      chainId: 6342,
    };
  });

  // POST /jobs - Submit job (dual-mode)
  fastify.post('/jobs', async (request, reply) => {
    const signingMode = env.signingMode;

    // ========== SERVER MODE ==========
    if (signingMode === 'server') {
      const parseResult = baseJobSchema.safeParse(request.body);

      if (!parseResult.success) {
        fastify.log.warn(
          `[SERVER] Validation failed: ${parseResult.error.message}`
        );
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.errors.map((e) => e.message).join(', '),
        });
      }

      const { prompt, amountEth } = parseResult.data;

      try {
        const { artifact, attestationHash } = buildArtifactFromPrompt(prompt);

        fastify.log.info(
          `[SERVER] Submitting job: <prompt:${prompt.length}chars>, hash: ${attestationHash}, amount: ${amountEth} ETH`
        );

        const result = await submitJobOnChain(attestationHash, amountEth);

        fastify.log.info(
          `[SERVER] Job submitted: jobId=${result.jobId}, txHash=${result.txHash}`
        );

        return {
          jobId: result.jobId.toString(),
          attestationHash: result.attestationHash,
          txHash: result.txHash,
          signingMode: 'server' as const,
          artifactPreview: artifact,
        };
      } catch (error) {
        fastify.log.error({ err: error }, '[SERVER] Job submission failed');
        return reply.status(500).send({
          error: 'Job submission failed',
          message: (error as Error).message,
        });
      }
    }

    // ========== CLIENT MODE ==========
    if (signingMode === 'client') {
      const parseResult = clientJobSchema.safeParse(request.body);

      if (!parseResult.success) {
        fastify.log.warn(
          `[CLIENT] Validation failed: ${parseResult.error.message}`
        );
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.errors.map((e) => e.message).join(', '),
        });
      }

      const {
        prompt,
        amountEth,
        signer,
        signature,
        attestationHash: providedHash,
        timestampIso,
        nonce,
        chainId,
        contractAddress,
        artifactPreview,
      } = parseResult.data;

      try {
        // 1. Rebuild attestation from prompt and verify it matches
        const { attestationHash: rebuiltHash } = buildArtifactFromPrompt(prompt);
        
        if (rebuiltHash.toLowerCase() !== providedHash.toLowerCase()) {
          fastify.log.warn(
            `[CLIENT] Attestation hash mismatch: expected ${rebuiltHash}, got ${providedHash}`
          );
          return reply.status(400).send({
            error: 'Attestation hash mismatch',
            message: 'Provided attestation hash does not match computed hash',
          });
        }

        // 2. Verify timestamp is recent (within 5 minutes)
        const timestampCheck = verifyTimestamp(timestampIso);
        if (!timestampCheck.valid) {
          fastify.log.warn(
            `[CLIENT] Invalid timestamp: ${timestampCheck.error}`
          );
          return reply.status(400).send({
            error: 'Invalid timestamp',
            message: timestampCheck.error,
          });
        }

        // 3. Build signed payload for verification
        const payload: SignedJobPayload = {
          attestationHash: providedHash as Hex,
          chainId,
          contractAddress: contractAddress as Hex,
          amountEth,
          timestampIso,
          nonce,
        };

        // 4. Verify chain ID and contract address match server config
        const contextCheck = verifyPayloadContext(payload);
        if (!contextCheck.valid) {
          fastify.log.warn(
            `[CLIENT] Invalid context: ${contextCheck.error}`
          );
          return reply.status(400).send({
            error: 'Invalid payload context',
            message: contextCheck.error,
          });
        }

        // 5. Verify EIP-191 signature
        const isValidSignature = await verifyJobSignature(
          payload,
          signature as Hex,
          signer as Hex
        );

        if (!isValidSignature) {
          fastify.log.warn(
            `[CLIENT] Signature verification failed for signer: ${signer}`
          );
          return reply.status(401).send({
            error: 'Invalid signature',
            message: 'Signature verification failed or signer mismatch',
          });
        }

        // 6. Submit to chain (server pays gas, but tracks submitter)
        fastify.log.info(
          `[CLIENT] Submitting job: signer=${signer}, hash=${providedHash}, amount=${amountEth} ETH`
        );

        const result = await submitJobOnChain(
          providedHash as Hex,
          amountEth,
          signer as `0x${string}`
        );

        fastify.log.info(
          `[CLIENT] Job submitted: jobId=${result.jobId}, signer=${signer}, txHash=${result.txHash}`
        );

        return {
          jobId: result.jobId.toString(),
          attestationHash: result.attestationHash,
          txHash: result.txHash,
          signingMode: 'client' as const,
          signer,
          artifactPreview,
        };
      } catch (error) {
        fastify.log.error(
          { err: error },
          '[CLIENT] Job submission failed'
        );
        return reply.status(500).send({
          error: 'Job submission failed',
          message: (error as Error).message,
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
