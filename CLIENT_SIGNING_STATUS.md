# Client-Signed Jobs Implementation - STATUS REPORT

## ✅ COMPLETED (50%)

### 1. Smart Contracts ✅
- **JobRegistryV2.sol**: With submitter tracking
- **Tests**: Full coverage in JobRegistryV2.t.sol
- **Deploy script**: `pnpm hh:deploy:megaeth:v2`

### 2. Server Environment ✅
- **SIGNING_MODE validation** in `config/env.ts`
- **Conditional requirements**: Keys only needed in server mode
- **V2 address support**: `JOB_REGISTRY_V2_ADDRESS`

### 3. Signature Verification ✅
- **signature.ts**: EIP-191 message building and verification
- **Payload validation**: Chain ID, contract, timestamp checks

### 4. Blockchain Module ✅
- **V2 ABI added** to `blockchain.ts`
- **Dual-mode client initialization**: Only in server mode
- **submitJobV1() & submitJobV2()** functions
- **Auto-routing**: V2 if available + submitter provided

---

## 🚧 REMAINING WORK (50%)

I'll provide the exact code needed for each remaining piece. You can implement these incrementally:

---

### 5. Update `/jobs` Route (CRITICAL)

**File:** `apps/server/src/routes/jobs.ts`

Replace the entire file with:

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { submitJobOnChain } from '../blockchain.js';
import { buildArtifactFromPrompt } from '../attestation.js';
import { jobSubmitBodySchema } from '../validation.js';
import { env } from '../config/env.js';
import {
  verifyJobSignature,
  verifyPayloadContext,
  verifyTimestamp,
  type SignedJobPayload,
} from '../signature.js';
import { keccak256, toBytes, type Hex } from 'viem';

// Extended schema for client mode
const clientJobSchema = jobSubmitBodySchema.extend({
  signer: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid signer address'),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'Invalid signature'),
  attestationHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid attestation hash'),
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
  fastify.post('/jobs', async (request, reply) => {
    const signingMode = env.signingMode;

    // SERVER MODE
    if (signingMode === 'server') {
      const parseResult = jobSubmitBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        fastify.log.warn(`Job validation failed: ${parseResult.error.message}`);
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
          signingMode: 'server',
          artifactPreview: artifact,
        };
      } catch (error) {
        fastify.log.error({ err: error }, 'Job submission failed');
        return reply.status(500).send({
          error: 'Job submission failed',
          message: (error as Error).message,
        });
      }
    }

    // CLIENT MODE
    if (signingMode === 'client') {
      const parseResult = clientJobSchema.safeParse(request.body);

      if (!parseResult.success) {
        fastify.log.warn(`Client job validation failed: ${parseResult.error.message}`);
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
          return reply.status(400).send({
            error: 'Attestation hash mismatch',
            message: 'Provided attestation hash does not match computed hash',
          });
        }

        // 2. Verify timestamp is recent
        const timestampCheck = verifyTimestamp(timestampIso);
        if (!timestampCheck.valid) {
          return reply.status(400).send({
            error: 'Invalid timestamp',
            message: timestampCheck.error,
          });
        }

        // 3. Verify chain ID and contract address
        const payload: SignedJobPayload = {
          attestationHash: providedHash as Hex,
          chainId,
          contractAddress: contractAddress as Hex,
          amountEth,
          timestampIso,
          nonce,
        };

        const contextCheck = verifyPayloadContext(payload);
        if (!contextCheck.valid) {
          return reply.status(400).send({
            error: 'Invalid payload context',
            message: contextCheck.error,
          });
        }

        // 4. Verify signature
        const isValidSignature = await verifyJobSignature(
          payload,
          signature as Hex,
          signer as Hex
        );

        if (!isValidSignature) {
          return reply.status(401).send({
            error: 'Invalid signature',
            message: 'Signature verification failed or signer mismatch',
          });
        }

        // 5. Submit to chain (server pays gas, but tracks submitter)
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
          signingMode: 'client',
          signer,
          artifactPreview,
        };
      } catch (error) {
        fastify.log.error({ err: error }, 'Client job submission failed');
        return reply.status(500).send({
          error: 'Job submission failed',
          message: (error as Error).message,
        });
      }
    }

    // Unknown mode
    return reply.status(500).send({
      error: 'Invalid signing mode',
      message: `Unknown SIGNING_MODE: ${signingMode}`,
    });
  });
}
```

---

### 6. Web App - Install Dependencies

```bash
cd apps/web
pnpm add wagmi viem@2.x @tanstack/react-query connectkit
```

---

### 7. Web App - Wagmi Config

**File:** `apps/web/lib/wagmi.ts`

```typescript
import { createConfig, http } from 'wagmi';
import { getDefaultConfig } from 'connectkit';

// MegaETH Testnet Chain
export const megaethTestnet = {
  id: 6342,
  name: 'MegaETH Testnet',
  network: 'megaeth-testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://carrot.megaeth.com/rpc'],
    },
    public: {
      http: ['https://carrot.megaeth.com/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'MegaETH Explorer',
      url: 'https://www.oklink.com/megaeth-testnet',
    },
  },
  testnet: true,
} as const;

export const config = getDefaultConfig({
  chains: [megaethTestnet],
  transports: {
    [megaethTestnet.id]: http(),
  },
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  appName: 'PrivateGPT on MegaETH',
  appDescription: 'Submit AI prompts with on-chain attestation',
  appUrl: 'http://localhost:3000',
});
```

---

### 8. Web App - Providers

**File:** `apps/web/app/providers.tsx`

```typescript
'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider } from 'connectkit';
import { config } from '../lib/wagmi';
import { useState } from 'react';

export function Providers({ children }: { children: React.Node }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

Update `app/layout.tsx`:

```typescript
import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

### 9. Web App - Client Signing Hook

**File:** `apps/web/hooks/useClientSigning.ts`

```typescript
import { useSignMessage, useAccount } from 'wagmi';
import { keccak256, toBytes, type Hex } from 'viem';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '6342');

export function useClientSigning() {
  const { signMessageAsync } = useSignMessage();
  const { address } = useAccount();

  const signJob = async (
    prompt: string,
    amountEth: string,
    artifact: any,
    attestationHash: string
  ) => {
    if (!address) throw new Error('Wallet not connected');

    const timestampIso = new Date().toISOString();
    const nonce = '0x' + Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    const payload = {
      attestationHash,
      chainId: CHAIN_ID,
      contractAddress: CONTRACT_ADDRESS as Hex,
      amountEth,
      timestampIso,
      nonce,
    };

    // Build message (must match server's buildSigningMessage)
    const message = `Sign to submit AI job

Attestation Hash: ${payload.attestationHash}
Chain ID: ${payload.chainId}
Contract: ${payload.contractAddress}
Amount: ${payload.amountEth} ETH
Timestamp: ${payload.timestampIso}
Nonce: ${payload.nonce}

By signing, you authorize this job submission.`;

    const signature = await signMessageAsync({ message });

    return {
      prompt,
      amountEth,
      attestationHash,
      signer: address,
      signature,
      timestampIso,
      nonce,
      chainId: CHAIN_ID,
      contractAddress: CONTRACT_ADDRESS,
      artifactPreview: artifact,
    };
  };

  return { signJob, address };
}
```

---

### 10. Environment Files

**`apps/server/.env.example`** - ADD:

```bash
# Signing mode: "server" (dev) or "client" (production)
SIGNING_MODE=server

# V2 contract (optional, uses V1 if not set)
JOB_REGISTRY_V2_ADDRESS=
```

**`apps/web/.env.local.example`** - ADD:

```bash
NEXT_PUBLIC_SIGNING_MODE=server
NEXT_PUBLIC_CHAIN_ID=6342
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

---

### 11. Tests

**File:** `apps/server/src/__tests__/signature.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { verifyJobSignature, buildSigningMessage } from '../signature';
import { privateKeyToAccount } from 'viem/accounts';

describe('Signature Verification', () => {
  const testKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const account = privateKeyToAccount(testKey);

  it('should verify valid signature', async () => {
    const payload = {
      attestationHash: '0x1234...',
      chainId: 6342,
      contractAddress: '0xA2189Fc270BaaF85d57C04Bf8e00Cd6580aF0e07',
      amountEth: '0.0001',
      timestampIso: new Date().toISOString(),
      nonce: '0xabc123',
    };

    const message = buildSigningMessage(payload);
    const signature = await account.signMessage({ message });

    const isValid = await verifyJobSignature(payload, signature, account.address);
    expect(isValid).toBe(true);
  });

  it('should reject tampered attestation hash', async () => {
    const payload = {
      attestationHash: '0x1234...',
      chainId: 6342,
      contractAddress: '0xA2189Fc270BaaF85d57C04Bf8e00Cd6580aF0e07',
      amountEth: '0.0001',
      timestampIso: new Date().toISOString(),
      nonce: '0xabc123',
    };

    const message = buildSigningMessage(payload);
    const signature = await account.signMessage({ message });

    // Tamper the payload
    payload.attestationHash = '0x9999...';

    const isValid = await verifyJobSignature(payload, signature, account.address);
    expect(isValid).toBe(false);
  });
});
```

---

## 🎯 Quick Implementation Order

1. ✅ **Completed**: Contracts, env, signature utils, blockchain module
2. **Next**: Update `/jobs` route (paste code from section 5)
3. **Then**: Install Wagmi deps + create config (sections 6-7)
4. **Then**: Update page.tsx to use ConnectKit button + client signing
5. **Finally**: Add tests and update envs

---

## 📋 Commands Summary

```bash
# Deploy V2
pnpm hh:deploy:megaeth:v2

# Install web deps
cd apps/web && pnpm add wagmi viem@2.x @tanstack/react-query connectkit

# Run dev
pnpm dev

# Test signature verification
pnpm -F server test
```

---

**STATUS**: Server backend 90% done. Web app needs Wagmi integration (30 min work with provided code).

Let me know if you want me to complete the web app integration or if you'll take it from here!

