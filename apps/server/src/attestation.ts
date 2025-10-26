import { keccak256, toHex, Hash } from 'viem';
import git from 'git-rev-sync';
import { randomBytes } from 'crypto';

export interface AttestationArtifact {
  model: string;
  modelVersion: string;
  inputHash: string;
  timestampIso: string;
  codeVersion: string;
  nonce: string;
}

export interface AttestationResult {
  artifact: AttestationArtifact;
  attestationHash: Hash;
}

/**
 * Compute deterministic hash of the input prompt
 */
export function computeInputHash(prompt: string): Hash {
  const data = toHex(prompt);
  return keccak256(data);
}

/**
 * Get current code version from git or package.json
 */
export function getCodeVersion(): string {
  try {
    // Try to get git short SHA
    return git.short();
  } catch {
    // Fallback to package version or 'dev'
    return 'v1.0.0-dev';
  }
}

/**
 * Generate a random 8-byte nonce
 */
export function generateNonce(): string {
  return '0x' + randomBytes(8).toString('hex');
}

/**
 * Serialize artifact with deterministic key order
 * Keys are sorted alphabetically to ensure consistent serialization
 */
export function serializeArtifact(artifact: AttestationArtifact): string {
  const ordered = {
    codeVersion: artifact.codeVersion,
    inputHash: artifact.inputHash,
    model: artifact.model,
    modelVersion: artifact.modelVersion,
    nonce: artifact.nonce,
    timestampIso: artifact.timestampIso,
  };
  return JSON.stringify(ordered);
}

/**
 * Compute attestation hash from artifact
 */
export function computeAttestationHash(artifact: AttestationArtifact): Hash {
  const serialized = serializeArtifact(artifact);
  const data = toHex(serialized);
  return keccak256(data);
}

/**
 * Build attestation artifact from prompt
 * This is the main export that combines all steps
 */
export function buildArtifactFromPrompt(prompt: string): AttestationResult {
  const artifact: AttestationArtifact = {
    model: 'llama-3-8b-instruct',
    modelVersion: 'v0',
    inputHash: computeInputHash(prompt),
    timestampIso: new Date().toISOString(),
    codeVersion: getCodeVersion(),
    nonce: generateNonce(),
  };

  const attestationHash = computeAttestationHash(artifact);

  return {
    artifact,
    attestationHash,
  };
}

