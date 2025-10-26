import { describe, it, expect } from 'vitest';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { keccak256, toBytes } from 'viem';
import { buildPvaMessage, verifyClientSignature } from '../src/signature.js';
import type { ClientJobRequest } from '../src/signature.js';

describe('PVA::JOB Signature Verification', () => {
  const testPrivateKey = generatePrivateKey();
  const testAccount = privateKeyToAccount(testPrivateKey);
  const testAddress = testAccount.address;
  const testContractAddress = '0x9E4fA3B7f61b4eb19cD501e5f05514dfc024fA1E' as `0x${string}`;

  it('should verify a valid PVA::JOB signature', async () => {
    const payload = { model: 'llama3-instruct', input: 'hello world' };
    const payloadHash = keccak256(toBytes(JSON.stringify(payload)));
    const timestamp = Math.floor(Date.now() / 1000);

    // Build the PVA::JOB message
    const message = buildPvaMessage({
      chainId: 6342,
      contract: testContractAddress,
      submitter: testAddress,
      payloadHash,
      timestamp,
    });

    // Sign with test account
    const signature = await testAccount.signMessage({ message });

    // Build request
    const request: ClientJobRequest = {
      mode: 'client',
      submitter: testAddress,
      chainId: 6342,
      contract: testContractAddress,
      payload,
      payloadHash,
      timestamp,
      signature,
      domain: 'PVA::JOB',
    };

    // Verify signature
    const result = await verifyClientSignature(request);
    expect(result.ok).toBe(true);
    expect(result.submitter.toLowerCase()).toBe(testAddress.toLowerCase());
  });

  it('should reject signature with wrong submitter address', async () => {
    const payload = { model: 'llama3-instruct', input: 'hello world' };
    const payloadHash = keccak256(toBytes(JSON.stringify(payload)));
    const timestamp = Math.floor(Date.now() / 1000);

    // Sign with test account
    const message = buildPvaMessage({
      chainId: 6342,
      contract: testContractAddress,
      submitter: testAddress,
      payloadHash,
      timestamp,
    });
    const signature = await testAccount.signMessage({ message });

    // But claim it's from a different address
    const wrongAddress = '0x0000000000000000000000000000000000000001';
    const request: ClientJobRequest = {
      mode: 'client',
      submitter: wrongAddress,
      chainId: 6342,
      contract: testContractAddress,
      payload,
      payloadHash,
      timestamp,
      signature,
      domain: 'PVA::JOB',
    };

    await expect(verifyClientSignature(request)).rejects.toThrow(
      /Signature verification failed/
    );
  });

  it('should reject signature with stale timestamp', async () => {
    const payload = { model: 'llama3-instruct', input: 'hello world' };
    const payloadHash = keccak256(toBytes(JSON.stringify(payload)));
    const staleTimestamp = Math.floor(Date.now() / 1000) - 10 * 60; // 10 minutes ago

    const message = buildPvaMessage({
      chainId: 6342,
      contract: testContractAddress,
      submitter: testAddress,
      payloadHash,
      timestamp: staleTimestamp,
    });
    const signature = await testAccount.signMessage({ message });

    const request: ClientJobRequest = {
      mode: 'client',
      submitter: testAddress,
      chainId: 6342,
      contract: testContractAddress,
      payload,
      payloadHash,
      timestamp: staleTimestamp,
      signature,
      domain: 'PVA::JOB',
    };

    await expect(verifyClientSignature(request)).rejects.toThrow(
      /Timestamp too old or in future/
    );
  });

  it('should reject signature with wrong contract address', async () => {
    const payload = { model: 'llama3-instruct', input: 'hello world' };
    const payloadHash = keccak256(toBytes(JSON.stringify(payload)));
    const timestamp = Math.floor(Date.now() / 1000);
    const wrongContract = '0x0000000000000000000000000000000000000002';

    const message = buildPvaMessage({
      chainId: 6342,
      contract: wrongContract,
      submitter: testAddress,
      payloadHash,
      timestamp,
    });
    const signature = await testAccount.signMessage({ message });

    const request: ClientJobRequest = {
      mode: 'client',
      submitter: testAddress,
      chainId: 6342,
      contract: wrongContract,
      payload,
      payloadHash,
      timestamp,
      signature,
      domain: 'PVA::JOB',
    };

    await expect(verifyClientSignature(request)).rejects.toThrow(
      /Invalid contract/
    );
  });

  it('should reject signature with wrong chainId', async () => {
    const payload = { model: 'llama3-instruct', input: 'hello world' };
    const payloadHash = keccak256(toBytes(JSON.stringify(payload)));
    const timestamp = Math.floor(Date.now() / 1000);
    const wrongChainId = 1; // Ethereum mainnet

    const message = buildPvaMessage({
      chainId: wrongChainId,
      contract: testContractAddress,
      submitter: testAddress,
      payloadHash,
      timestamp,
    });
    const signature = await testAccount.signMessage({ message });

    const request: ClientJobRequest = {
      mode: 'client',
      submitter: testAddress,
      chainId: wrongChainId,
      contract: testContractAddress,
      payload,
      payloadHash,
      timestamp,
      signature,
      domain: 'PVA::JOB',
    };

    await expect(verifyClientSignature(request)).rejects.toThrow(
      /Invalid chainId/
    );
  });

  it('should reject signature with wrong payloadHash', async () => {
    const payload = { model: 'llama3-instruct', input: 'hello world' };
    const correctPayloadHash = keccak256(toBytes(JSON.stringify(payload)));
    const wrongPayloadHash = keccak256(toBytes('wrong payload'));
    const timestamp = Math.floor(Date.now() / 1000);

    // Sign with correct hash
    const message = buildPvaMessage({
      chainId: 6342,
      contract: testContractAddress,
      submitter: testAddress,
      payloadHash: correctPayloadHash,
      timestamp,
    });
    const signature = await testAccount.signMessage({ message });

    // But submit with wrong hash
    const request: ClientJobRequest = {
      mode: 'client',
      submitter: testAddress,
      chainId: 6342,
      contract: testContractAddress,
      payload,
      payloadHash: wrongPayloadHash,
      timestamp,
      signature,
      domain: 'PVA::JOB',
    };

    await expect(verifyClientSignature(request)).rejects.toThrow(
      /Payload hash mismatch/
    );
  });

  it('should create deterministic PVA::JOB messages', () => {
    const params = {
      chainId: 6342,
      contract: testContractAddress,
      submitter: testAddress,
      payloadHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      timestamp: 1730000000,
    };

    const message1 = buildPvaMessage(params);
    const message2 = buildPvaMessage(params);

    expect(message1).toBe(message2);
    expect(message1).toContain('PVA::JOB');
    expect(message1).toContain('chainId:6342');
    expect(message1).toContain(`contract:${testContractAddress}`);
    expect(message1).toContain(`submitter:${testAddress}`);
    expect(message1).toContain('timestamp:1730000000');
  });

  it('should reject signature with invalid domain', async () => {
    const payload = { model: 'llama3-instruct', input: 'hello world' };
    const payloadHash = keccak256(toBytes(JSON.stringify(payload)));
    const timestamp = Math.floor(Date.now() / 1000);

    const message = buildPvaMessage({
      chainId: 6342,
      contract: testContractAddress,
      submitter: testAddress,
      payloadHash,
      timestamp,
    });
    const signature = await testAccount.signMessage({ message });

    const request: ClientJobRequest = {
      mode: 'client',
      submitter: testAddress,
      chainId: 6342,
      contract: testContractAddress,
      payload,
      payloadHash,
      timestamp,
      signature,
      domain: 'WRONG::DOMAIN' as any,
    };

    await expect(verifyClientSignature(request)).rejects.toThrow(
      /Invalid domain/
    );
  });
});
