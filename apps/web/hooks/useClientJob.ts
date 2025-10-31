'use client';

import { useSignMessage, useAccount } from 'wagmi';
import { keccak256, toBytes, type Hex } from 'viem';

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '6342');
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export interface JobPayload {
  model: string;
  input: string;
}

/**
 * Build the strict PVA::JOB message format
 */
function buildPvaJobMessage(params: {
  chainId: number;
  contract: string;
  submitter: string;
  payloadHash: string;
  timestamp: number;
}): string {
  return `PVA::JOB
chainId:${params.chainId}
contract:${params.contract}
submitter:${params.submitter}
payloadHash:${params.payloadHash}
timestamp:${params.timestamp}`;
}

/**
 * Hook for submitting client-signed jobs
 */
export function useClientJob() {
  const { signMessageAsync } = useSignMessage();
  const { address, isConnected } = useAccount();

  const submitClientJob = async (payload: JobPayload) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const contractAddress =
      (process.env.NEXT_PUBLIC_JOB_REGISTRY_V2_ADDRESS as Hex) || '';

    if (!contractAddress) {
      throw new Error('Contract address not configured');
    }

    // Compute payloadHash = keccak256(JSON.stringify(payload))
    const payloadJson = JSON.stringify(payload);
    const payloadHash = keccak256(toBytes(payloadJson));

    // Unix timestamp in seconds
    const timestamp = Math.floor(Date.now() / 1000);

    // Build the strict 6-line message
    const message = buildPvaJobMessage({
      chainId: CHAIN_ID,
      contract: contractAddress,
      submitter: address,
      payloadHash,
      timestamp,
    });

    // Sign with wallet
    const signature = await signMessageAsync({ message });

    // POST to server
    const response = await fetch(`${API_BASE_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'client',
        submitter: address,
        chainId: CHAIN_ID,
        contract: contractAddress,
        payload,
        payloadHash,
        timestamp,
        signature,
        domain: 'PVA::JOB',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details || data.error || 'Failed to submit job');
    }

    return data;
  };

  return {
    submitClientJob,
    address,
    isConnected,
  };
}

