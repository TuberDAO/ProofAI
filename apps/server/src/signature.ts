import { recoverMessageAddress, keccak256, toBytes, type Hex } from 'viem';
import { env } from './config/env.js';

export interface PvaJobParams {
  chainId: number;
  contract: string;
  submitter: string;
  payloadHash: string;
  timestamp: number;
}

export interface ClientJobRequest {
  mode: 'client';
  submitter: string;
  chainId: number;
  contract: string;
  payload: { model: string; input: string };
  payloadHash: string;
  timestamp: number;
  signature: string;
  domain: string;
}

/**
 * Build the strict PVA::JOB message format (6 lines, exact format)
 */
export function buildPvaMessage(params: PvaJobParams): string {
  return `PVA::JOB
chainId:${params.chainId}
contract:${params.contract}
submitter:${params.submitter}
payloadHash:${params.payloadHash}
timestamp:${params.timestamp}`;
}

/**
 * Verify a client-signed job submission
 * @throws Error with precise validation failure message
 */
export async function verifyClientSignature(input: ClientJobRequest): Promise<{
  ok: true;
  submitter: string;
}> {
  // 1. Validate domain
  if (input.domain !== 'PVA::JOB') {
    throw new Error(`Invalid domain: expected "PVA::JOB", got "${input.domain}"`);
  }

  // 2. Recompute payloadHash
  const payloadJson = JSON.stringify(input.payload);
  const computedPayloadHash = keccak256(toBytes(payloadJson));

  if (computedPayloadHash.toLowerCase() !== input.payloadHash.toLowerCase()) {
    throw new Error(
      `Payload hash mismatch: expected ${computedPayloadHash}, got ${input.payloadHash}`
    );
  }

  // 3. Validate timestamp freshness (±5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(now - input.timestamp);
  const fiveMinutes = 5 * 60;

  if (timeDiff > fiveMinutes) {
    throw new Error(
      `Timestamp too old or in future: ${timeDiff}s diff (max ${fiveMinutes}s)`
    );
  }

  // 4. Validate chainId if env-bound
  const expectedChainId = env.chainId || 6342;
  if (input.chainId !== expectedChainId) {
    throw new Error(
      `Invalid chainId: expected ${expectedChainId}, got ${input.chainId}`
    );
  }

  // 5. Validate contract if env-bound
  const expectedContract = (
    env.jobRegistryV2Address || env.jobRegistryAddress
  ).toLowerCase();
  if (input.contract.toLowerCase() !== expectedContract) {
    throw new Error(
      `Invalid contract: expected ${expectedContract}, got ${input.contract}`
    );
  }

  // 6. Rebuild the exact message
  const message = buildPvaMessage({
    chainId: input.chainId,
    contract: input.contract,
    submitter: input.submitter,
    payloadHash: input.payloadHash,
    timestamp: input.timestamp,
  });

  // 7. Recover signer via EIP-191 personal_sign
  let recoveredSigner: string;
  try {
    recoveredSigner = await recoverMessageAddress({
      message,
      signature: input.signature as Hex,
    });
  } catch (error) {
    throw new Error(`Failed to recover signer: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  // 8. Verify signer matches submitter
  if (recoveredSigner.toLowerCase() !== input.submitter.toLowerCase()) {
    throw new Error(
      `Signature verification failed: signer ${recoveredSigner} does not match submitter ${input.submitter}`
    );
  }

  return {
    ok: true,
    submitter: recoveredSigner,
  };
}
