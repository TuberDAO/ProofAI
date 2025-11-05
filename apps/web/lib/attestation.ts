import { keccak256, toBytes } from 'viem';
import git from 'git-rev-sync';

export interface AttestationArtifact {
  model: string;
  modelVersion: string;
  inputHash: string;
  timestampIso: string;
  codeVersion: string;
  nonce: string;
}

/**
 * Get git commit hash or fallback version
 */
function getCodeVersion(): string {
  try {
    return git.short();
  } catch {
    return 'dev';
  }
}

/**
 * Generate a random nonce
 */
function generateNonce(): string {
  const bytes = new Uint8Array(8);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    // Fallback for server-side or older browsers
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build attestation artifact from prompt (client-side version)
 */
export function buildArtifactFromPrompt(prompt: string): {
  artifact: AttestationArtifact;
  attestationHash: `0x${string}`;
} {
  const inputHash = keccak256(toBytes(prompt));
  const timestampIso = new Date().toISOString();
  const codeVersion = getCodeVersion();
  const nonce = generateNonce();

  const artifact: AttestationArtifact = {
    model: 'llama-3-8b-instruct',
    modelVersion: 'v0',
    inputHash,
    timestampIso,
    codeVersion,
    nonce,
  };

  // Deterministic serialization (sorted keys)
  const serializedArtifact = JSON.stringify(
    artifact,
    Object.keys(artifact).sort()
  );
  const attestationHash = keccak256(toBytes(serializedArtifact));

  return { artifact, attestationHash };
}













