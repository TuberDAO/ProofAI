import { useSignMessage, useAccount } from 'wagmi';
import { buildArtifactFromPrompt } from '../lib/attestation';
import type { Hex } from 'viem';

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '6342');

export function useClientSigning() {
  const { signMessageAsync } = useSignMessage();
  const { address, isConnected } = useAccount();

  const signJob = async (prompt: string, amountEth: string) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const contractAddress =
      (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex) || '';

    // Build attestation artifact
    const { artifact, attestationHash } = buildArtifactFromPrompt(prompt);

    // Build signing payload
    const payload = {
      attestationHash,
      chainId: CHAIN_ID,
      contractAddress,
      amountEth,
      timestampIso: artifact.timestampIso,
      nonce: artifact.nonce,
    };

    // Build canonical message (must match server's createSigningMessage exactly)
    // Server expects JSON.stringify of the payload
    const message = JSON.stringify(payload);

    // Sign the message with wallet
    const signature = await signMessageAsync({ message });

    // Return full signed payload for server
    return {
      prompt,
      amountEth,
      attestationHash,
      signer: address,
      signature,
      timestampIso: payload.timestampIso,
      nonce: payload.nonce,
      chainId: payload.chainId,
      contractAddress: payload.contractAddress,
      artifactPreview: artifact,
    };
  };

  return {
    signJob,
    address,
    isConnected,
  };
}

