/**
 * Strict request validation schemas for production
 */
import { z } from 'zod';
import { env } from '../config/env.js';

// Helper: hex address validator
const hexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid hex address');

// Helper: hex hash validator
const hexHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid hex hash');

// Helper: hex signature validator
const hexSignature = z.string().regex(/^0x[0-9a-fA-F]+$/, 'Invalid signature format');

// Helper: nonce validator (min 16 bytes)
const hexNonce = z.string().regex(/^0x[0-9a-fA-F]{32,}$/, 'Invalid nonce (min 16 bytes)');

/**
 * Schema for POST /sessions
 */
export const SessionCreateSchema = z.object({
  submitter: hexAddress,
  signature: hexSignature,
  message: z.string().min(1).max(500),
  chainId: z.number().int().positive(),
  contract: hexAddress,
  expiry: z.number().int().positive(),
  nonce: hexNonce,
  policy: z
    .object({
      maxPrompts: z.number().int().positive().max(10000).optional(),
      allowedModels: z.array(z.string()).optional(),
      maxGasWei: z.string().optional(),
    })
    .optional(),
});

/**
 * Schema for POST /jobs (session mode)
 */
export const JobSessionSchema = z.object({
  model: z.enum(env.allowedModels as [string, ...string[]]),
  input: z
    .string()
    .trim()
    .min(1, 'Input cannot be empty')
    .max(env.maxPromptChars, `Input too long (max ${env.maxPromptChars} chars)`),
});

/**
 * Schema for POST /jobs (client-signed PVA::JOB mode)
 */
export const JobClientSchema = z.object({
  mode: z.literal('client'),
  submitter: hexAddress,
  chainId: z.number().int().positive(),
  contract: hexAddress,
  payload: z.object({
    model: z.enum(env.allowedModels as [string, ...string[]]),
    input: z
      .string()
      .trim()
      .min(1, 'Input cannot be empty')
      .max(env.maxPromptChars, `Input too long (max ${env.maxPromptChars} chars)`),
  }),
  payloadHash: hexHash,
  timestamp: z.number().int().positive(),
  signature: hexSignature,
  domain: z.literal('PVA::JOB'),
});

/**
 * Schema for POST /jobs (server mode)
 */
export const JobServerSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'Prompt cannot be empty')
    .max(env.maxPromptChars, `Prompt too long (max ${env.maxPromptChars} chars)`),
  amountEth: z.string().default('0.0001'),
});

export type SessionCreateRequest = z.infer<typeof SessionCreateSchema>;
export type JobSessionRequest = z.infer<typeof JobSessionSchema>;
export type JobClientRequest = z.infer<typeof JobClientSchema>;
export type JobServerRequest = z.infer<typeof JobServerSchema>;














