import { describe, it, expect } from 'vitest';
import {
  computeInputHash,
  serializeArtifact,
  computeAttestationHash,
  buildArtifactFromPrompt,
  generateNonce,
  getCodeVersion,
  type AttestationArtifact,
} from '../attestation';

describe('Attestation Module', () => {
  describe('computeInputHash', () => {
    it('produces consistent hash for same prompt', () => {
      const prompt = 'What is AI?';
      const hash1 = computeInputHash(prompt);
      const hash2 = computeInputHash(prompt);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('produces different hashes for different prompts', () => {
      const hash1 = computeInputHash('Hello');
      const hash2 = computeInputHash('World');

      expect(hash1).not.toBe(hash2);
    });

    it('handles UTF-8 characters', () => {
      const prompt = 'こんにちは 世界 🌍';
      const hash = computeInputHash(prompt);

      expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe('serializeArtifact', () => {
    it('produces deterministic serialization with sorted keys', () => {
      const artifact: AttestationArtifact = {
        model: 'llama-3-8b-instruct',
        modelVersion: 'v0',
        inputHash: '0xabcd1234',
        timestampIso: '2024-01-01T00:00:00.000Z',
        codeVersion: 'v1.0.0',
        nonce: '0x1234567890abcdef',
      };

      const serialized = serializeArtifact(artifact);
      const parsed = JSON.parse(serialized);

      // Check keys are in alphabetical order
      const keys = Object.keys(parsed);
      expect(keys).toEqual([
        'codeVersion',
        'inputHash',
        'model',
        'modelVersion',
        'nonce',
        'timestampIso',
      ]);

      // Check multiple serializations are identical
      const serialized2 = serializeArtifact(artifact);
      expect(serialized).toBe(serialized2);
    });
  });

  describe('computeAttestationHash', () => {
    it('produces consistent hash for same artifact', () => {
      const artifact: AttestationArtifact = {
        model: 'llama-3-8b-instruct',
        modelVersion: 'v0',
        inputHash: '0xabcd1234',
        timestampIso: '2024-01-01T00:00:00.000Z',
        codeVersion: 'v1.0.0',
        nonce: '0x1234567890abcdef',
      };

      const hash1 = computeAttestationHash(artifact);
      const hash2 = computeAttestationHash(artifact);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('produces different hashes when nonce changes', () => {
      const artifact1: AttestationArtifact = {
        model: 'llama-3-8b-instruct',
        modelVersion: 'v0',
        inputHash: '0xabcd1234',
        timestampIso: '2024-01-01T00:00:00.000Z',
        codeVersion: 'v1.0.0',
        nonce: '0x1111111111111111',
      };

      const artifact2: AttestationArtifact = {
        ...artifact1,
        nonce: '0x2222222222222222',
      };

      const hash1 = computeAttestationHash(artifact1);
      const hash2 = computeAttestationHash(artifact2);

      expect(hash1).not.toBe(hash2);
    });

    it('produces different hashes when any field changes', () => {
      const baseArtifact: AttestationArtifact = {
        model: 'llama-3-8b-instruct',
        modelVersion: 'v0',
        inputHash: '0xabcd1234',
        timestampIso: '2024-01-01T00:00:00.000Z',
        codeVersion: 'v1.0.0',
        nonce: '0x1234567890abcdef',
      };

      const hash1 = computeAttestationHash(baseArtifact);
      const hash2 = computeAttestationHash({
        ...baseArtifact,
        inputHash: '0xdifferent',
      });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateNonce', () => {
    it('generates 8-byte hex string with 0x prefix', () => {
      const nonce = generateNonce();

      expect(nonce).toMatch(/^0x[0-9a-f]{16}$/);
    });

    it('generates different nonces each time', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      const nonce3 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
      expect(nonce2).not.toBe(nonce3);
      expect(nonce1).not.toBe(nonce3);
    });
  });

  describe('getCodeVersion', () => {
    it('returns a version string', () => {
      const version = getCodeVersion();

      expect(version).toBeTruthy();
      expect(typeof version).toBe('string');
      // Should be either git SHA or fallback version
      expect(
        version.match(/^[0-9a-f]{7}$/) || version.includes('v1.0.0')
      ).toBeTruthy();
    });
  });

  describe('buildArtifactFromPrompt', () => {
    it('builds complete artifact with all required fields', () => {
      const prompt = 'Test prompt for AI';
      const result = buildArtifactFromPrompt(prompt);

      expect(result.artifact).toBeDefined();
      expect(result.attestationHash).toBeDefined();

      // Check artifact structure
      expect(result.artifact.model).toBe('llama-3-8b-instruct');
      expect(result.artifact.modelVersion).toBe('v0');
      expect(result.artifact.inputHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result.artifact.timestampIso).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(result.artifact.codeVersion).toBeTruthy();
      expect(result.artifact.nonce).toMatch(/^0x[0-9a-f]{16}$/);

      // Check attestation hash format
      expect(result.attestationHash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('produces same inputHash for same prompt', () => {
      const prompt = 'Same prompt';
      const result1 = buildArtifactFromPrompt(prompt);
      const result2 = buildArtifactFromPrompt(prompt);

      expect(result1.artifact.inputHash).toBe(result2.artifact.inputHash);
    });

    it('produces different attestationHash due to nonce/timestamp', () => {
      const prompt = 'Same prompt';
      const result1 = buildArtifactFromPrompt(prompt);
      const result2 = buildArtifactFromPrompt(prompt);

      // Input hash should be same
      expect(result1.artifact.inputHash).toBe(result2.artifact.inputHash);

      // But attestation hash should differ (due to nonce and timestamp)
      expect(result1.attestationHash).not.toBe(result2.attestationHash);
    });

    it('handles long prompts', () => {
      const longPrompt = 'A'.repeat(7000);
      const result = buildArtifactFromPrompt(longPrompt);

      expect(result.artifact.inputHash).toBeTruthy();
      expect(result.attestationHash).toBeTruthy();
    });

    it('handles special characters', () => {
      const prompt = 'Special: !@#$%^&*()_+-={}[]|:";\'<>?,./';
      const result = buildArtifactFromPrompt(prompt);

      expect(result.artifact.inputHash).toBeTruthy();
      expect(result.attestationHash).toBeTruthy();
    });
  });
});

