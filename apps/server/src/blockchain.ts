import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  parseEther,
  formatEther,
  parseEventLogs,
  Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from './config/env.js';

// MegaETH testnet v2 Chain ID
export const MEGAETH_TESTNET_CHAIN_ID = 6343;

// JobRegistry V1 ABI
const jobRegistryAbi = [
  {
    type: 'function',
    name: 'submitJob',
    stateMutability: 'payable',
    inputs: [
      { name: 'attestationHash', type: 'bytes32' },
      { name: 'provider', type: 'address' },
    ],
    outputs: [{ name: 'jobId', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'JobSubmitted',
    inputs: [
      { indexed: true, name: 'jobId', type: 'uint256' },
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'provider', type: 'address' },
      { indexed: false, name: 'attestationHash', type: 'bytes32' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
  },
] as const;

// JobRegistry V2 ABI (with submitter tracking)
const jobRegistryV2Abi = [
  {
    type: 'function',
    name: 'submitJob',
    stateMutability: 'payable',
    inputs: [
      { name: 'attestationHash', type: 'bytes32' },
      { name: 'provider', type: 'address' },
      { name: 'submitter', type: 'address' },
    ],
    outputs: [{ name: 'jobId', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'JobSubmitted',
    inputs: [
      { indexed: true, name: 'jobId', type: 'uint256' },
      { indexed: true, name: 'attestationHash', type: 'bytes32' },
      { indexed: true, name: 'submitter', type: 'address' },
      { indexed: false, name: 'payer', type: 'address' },
      { indexed: false, name: 'provider', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
  },
] as const;

// Create clients
let account: ReturnType<typeof privateKeyToAccount> | undefined;
let walletClient: ReturnType<typeof createWalletClient> | undefined;

// Initialize wallet client in both modes (server always pays gas)
// In client mode, user signs the job data but server still pays for the tx
if (env.serverWalletPrivateKey) {
  account = privateKeyToAccount(env.serverWalletPrivateKey);
  walletClient = createWalletClient({
    account,
    transport: http(env.megaethRpcUrl),
  });
} else if (env.signingMode === 'server') {
  // Only throw error if in server mode and missing key
  throw new Error('SERVER_WALLET_PRIVATE_KEY required in server signing mode');
}
// Note: In client mode, wallet is optional for dev/testing (will fail on actual submission)

const publicClient = createPublicClient({
  transport: http(env.megaethRpcUrl),
});

export async function getChainId(): Promise<number> {
  return await publicClient.getChainId();
}

export function computeAttestationHash(prompt: string): Hash {
  // Simple deterministic hash of the prompt
  // In production TEE, this would be a proper attestation
  const data = toHex(prompt);
  return keccak256(data);
}

export interface JobSubmissionResult {
  jobId: bigint;
  attestationHash: Hash;
  txHash: Hash;
  receiptHash?: Hash;
}

/**
 * Submit job to V1 contract (server mode only)
 */
async function submitJobV1(
  attestationHash: Hash,
  amountEth: string
): Promise<JobSubmissionResult> {
  if (!account || !walletClient) {
    throw new Error('Wallet client not initialized (server mode required)');
  }

  const value = parseEther(amountEth);

  const { request } = await publicClient.simulateContract({
    account,
    address: env.jobRegistryAddress,
    abi: jobRegistryAbi,
    functionName: 'submitJob',
    args: [attestationHash, env.providerAddress],
    value,
  });

  const txHash = await walletClient.writeContract(request);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  // Parse logs to get jobId
  let jobId: bigint = 0n;
  for (const log of receipt.logs) {
    try {
      const decoded = parseEventLogs({
        abi: jobRegistryAbi,
        logs: [log],
      });
      if (decoded.length > 0 && decoded[0].eventName === 'JobSubmitted') {
        jobId = decoded[0].args.jobId;
        break;
      }
    } catch {
      continue;
    }
  }

  return { jobId, attestationHash, txHash, receiptHash: receipt.blockHash };
}

/**
 * Submit job to V2 contract (supports client-signed mode)
 */
async function submitJobV2(
  attestationHash: Hash,
  submitter: `0x${string}`,
  amountEth: string
): Promise<JobSubmissionResult> {
  if (!account || !walletClient) {
    throw new Error('Wallet client not initialized');
  }

  const value = parseEther(amountEth);
  const provider = env.providerAddress || submitter; // Use submitter as provider if not set

  const { request } = await publicClient.simulateContract({
    account,
    address: env.jobRegistryV2Address as `0x${string}`,
    abi: jobRegistryV2Abi,
    functionName: 'submitJob',
    args: [attestationHash, provider, submitter],
    value,
  });

  const txHash = await walletClient.writeContract(request);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  // Parse logs to get jobId
  let jobId: bigint = 0n;
  for (const log of receipt.logs) {
    try {
      const decoded = parseEventLogs({
        abi: jobRegistryV2Abi,
        logs: [log],
      });
      if (decoded.length > 0 && decoded[0].eventName === 'JobSubmitted') {
        jobId = decoded[0].args.jobId;
        break;
      }
    } catch {
      continue;
    }
  }

  return { jobId, attestationHash, txHash, receiptHash: receipt.blockHash };
}

/**
 * Submit job on-chain (routes to V1 or V2 based on config)
 */
export async function submitJobOnChain(
  attestationHash: Hash,
  amountEth: string,
  submitter?: `0x${string}`
): Promise<JobSubmissionResult> {
  // If MOCK_ONCHAIN is enabled, return fake data without calling blockchain
  if (env.mockOnChain) {
    return Promise.resolve({
      jobId: BigInt(Math.floor(Date.now() / 1000)),
      attestationHash,
      txHash: ('0x' + 'deadbeef'.repeat(8)) as Hash,
      receiptHash: undefined,
    });
  }

  try {
    // Use V2 if available and we have a submitter
    if (env.jobRegistryV2Address && submitter) {
      return await submitJobV2(attestationHash, submitter, amountEth);
    }
    
    // Otherwise use V1
    return await submitJobV1(attestationHash, amountEth);
  } catch (error: unknown) {
    // Map common errors to user-friendly messages
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('insufficient funds') || message.includes('balance')) {
        throw new Error(
          'Insufficient funds in server wallet. Please contact administrator.'
        );
      }

      if (
        message.includes('rate limit') ||
        message.includes('too many requests')
      ) {
        throw new Error(
          'RPC rate limit exceeded. Please try again in a moment.'
        );
      }

      if (
        message.includes('connection') ||
        message.includes('network') ||
        message.includes('timeout')
      ) {
        throw new Error(
          'Unable to connect to MegaETH testnet. RPC may be unavailable.'
        );
      }
    }

    throw error;
  }
}

