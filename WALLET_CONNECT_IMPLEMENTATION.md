# Wallet Connect + Client-Signed Jobs Implementation

## 🎯 Status: IN PROGRESS

This document tracks the implementation of production-ready client-side wallet signing with dual-mode support.

---

## ✅ Completed So Far

### 1. Smart Contracts ✅
- **JobRegistryV2.sol** created with:
  - `submitter` field to track who signed the job
  - `payer` field to track who paid gas (relayer/server)
  - `getJobsBySubmitter()` function
  - Comprehensive events with submitter tracking
  
- **Tests** (JobRegistryV2.t.sol):
  - Submit job with different payer/submitter
  - Query jobs by submitter
  - Validation tests

- **Deployment Script** (`deploy-v2.ts`):
  - Deploys to MegaETH testnet
  - Auto-updates `apps/server/.env` with V2 address
  - Script: `pnpm hh:deploy:megaeth:v2`

### 2. Server Environment ✅
- **Updated `apps/server/src/config/env.ts`:**
  - Added `SIGNING_MODE` validation (`server` | `client`)
  - Added `JOB_REGISTRY_V2_ADDRESS` support
  - Made `SERVER_WALLET_PRIVATE_KEY` and `PROVIDER_ADDRESS` optional in client mode
  - Environment logs show active signing mode

### 3. Signature Verification ✅
- **Created `apps/server/src/signature.ts`:**
  - `buildSigningMessage()` - Creates EIP-191 message to sign
  - `verifyJobSignature()` - Recovers signer and validates
  - `verifyPayloadContext()` - Validates chain ID and contract
  - `verifyTimestamp()` - Ensures timestamp is recent (within 5 min)

---

## 🚧 Remaining Implementation

### 4. Server Routes (TODO)
**File:** `apps/server/src/routes/jobs.ts`

Need to update `/jobs` endpoint:

```typescript
// In server mode (existing):
- Validate prompt/amount
- Build attestation artifact
- Submit to chain with server wallet
- Return { jobId, attestationHash, txHash, signingMode: "server" }

// In client mode (NEW):
- Validate prompt/amount
- Require: signer, signature, attestationHash, artifactPreview
- Rebuild attestation from prompt → verify hash matches
- Verify signature using signature.ts utilities
- Verify timestamp, chain ID, contract
- Submit to V2 (if available) or V1 with submitter address
- Return { jobId, attestationHash, txHash, signer, signingMode: "client" }
```

**Response Schema:**
```typescript
{
  jobId: string;
  attestationHash: string;
  txHash: string;
  signingMode: "server" | "client";
  signer?: string; // Only in client mode
  artifactPreview: ArtifactPreview;
}
```

### 5. Blockchain Module Updates (TODO)
**File:** `apps/server/src/blockchain.ts`

Add V2 support:

```typescript
// Add JobRegistryV2 ABI
const jobRegistryV2Abi = [...];

// Update submitJobOnChain to:
export async function submitJobOnChain(
  attestationHash: Hash,
  amountEth: string,
  submitter?: `0x${string}` // NEW: optional submitter for client mode
): Promise<JobSubmissionResult>

// Logic:
if (env.jobRegistryV2Address && submitter) {
  // Call V2: submitJob(attestationHash, provider, submitter)
} else {
  // Call V1: submitJob(attestationHash, provider)
}
```

### 6. Web App - Dependencies (TODO)
**File:** `apps/web/package.json`

```bash
pnpm add wagmi viem@2.x @tanstack/react-query @rainbow-me/rainbowkit
```

### 7. Web App - Wagmi Config (TODO)
**File:** `apps/web/app/providers.tsx`

```typescript
'use client';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { megaETH } from 'wagmi/chains'; // or custom chain config
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

export const config = createConfig({
  chains: [megaETH],
  transports: {
    [megaETH.id]: http(),
  },
});

export function Providers({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### 8. Web App - Connect Wallet UI (TODO)
**File:** `apps/web/app/components/ConnectButton.tsx`

```typescript
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div>
        {address && `${address.slice(0, 6)}...${address.slice(-4)}`}
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <button onClick={() => connect({ connector: connectors[0] })}>
      Connect Wallet
    </button>
  );
}
```

### 9. Web App - Client-Side Signing (TODO)
**File:** `apps/web/app/hooks/useClientSigning.ts`

```typescript
import { useSignMessage, useAccount } from 'wagmi';
import { keccak256, toBytes } from 'viem';

export function useClientSigning() {
  const { signMessageAsync } = useSignMessage();
  const { address } = useAccount();

  const signJob = async (prompt: string, amountEth: string) => {
    // Build attestation artifact (same as server)
    const attestationHash = keccak256(toBytes(JSON.stringify(artifact)));
    
    // Build signing payload
    const payload = {
      attestationHash,
      chainId: 6342,
      contractAddress: CONTRACT_ADDRESS,
      amountEth,
      timestampIso: new Date().toISOString(),
      nonce: generateNonce(),
    };

    // Sign message
    const message = buildSigningMessage(payload);
    const signature = await signMessageAsync({ message });

    // Return signed payload
    return {
      prompt,
      amountEth,
      attestationHash,
      signer: address,
      signature,
      artifactPreview: artifact,
      ...payload,
    };
  };

  return { signJob };
}
```

### 10. Web App - Mode Detection (TODO)
**File:** `apps/web/app/page.tsx`

```typescript
const signingMode = process.env.NEXT_PUBLIC_SIGNING_MODE || 'server';
const { address, isConnected } = useAccount();

// Show dev mode banner if server mode
{signingMode === 'server' && (
  <div className="bg-yellow-100 border-yellow-400 p-4">
    ⚠️ Dev mode: server is signing on your behalf. Not for production.
  </div>
)}

// In client mode, require wallet connection
const canSubmit = signingMode === 'server' || (signingMode === 'client' && isConnected);

// On submit:
if (signingMode === 'client') {
  const signedPayload = await signJob(prompt, amountEth);
  // POST to /jobs with signedPayload
} else {
  // POST to /jobs with just { prompt, amountEth }
}
```

### 11. Environment Files (TODO)

**`apps/server/.env.example`:**
```bash
# Signing mode: "server" (dev) or "client" (production)
SIGNING_MODE=server

# V2 contract address (optional, uses V1 if not set)
JOB_REGISTRY_V2_ADDRESS=

# Only required in server mode:
SERVER_WALLET_PRIVATE_KEY=
PROVIDER_ADDRESS=
```

**`apps/web/.env.local.example`:**
```bash
NEXT_PUBLIC_SIGNING_MODE=server
NEXT_PUBLIC_CHAIN_ID=6342
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_CONTRACT_V2_ADDRESS=
```

### 12. Tests (TODO)

**Signature Verification Tests:**
```typescript
// apps/server/src/__tests__/signature.test.ts
describe('Signature Verification', () => {
  it('should verify valid signature', async () => {
    const payload = { ... };
    const signature = await wallet.signMessage(message);
    const isValid = await verifyJobSignature(payload, signature, wallet.address);
    expect(isValid).toBe(true);
  });

  it('should reject tampered payload', async () => {
    // Sign original
    // Modify payload
    // Verify fails
  });
});
```

**Integration Tests:**
```typescript
// apps/server/src/__tests__/jobs-client-mode.test.ts
describe('POST /jobs in client mode', () => {
  it('should accept valid signed job', async () => {
    const response = await fetch('/jobs', {
      method: 'POST',
      body: JSON.stringify(signedPayload),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.signingMode).toBe('client');
    expect(data.signer).toBe(wallet.address);
  });

  it('should reject invalid signature', async () => {
    // Send with wrong signature
    expect(response.status).toBe(400);
  });
});
```

### 13. Documentation (TODO)

**README Updates:**

```markdown
## Signing Modes

PrivateGPT supports two signing modes:

### Server Mode (Development)
- Server signs transactions on behalf of users
- No wallet connection required
- Suitable for development/testing
- **Not for production use**

### Client Mode (Production)
- Users sign jobs with their own wallet (MetaMask, WalletConnect, etc.)
- Server acts as relayer (pays gas only)
- Full user control and privacy
- **Recommended for production**

### Configuration

Set in `apps/server/.env`:
```bash
SIGNING_MODE=client  # or "server"
```

Set in `apps/web/.env.local`:
```bash
NEXT_PUBLIC_SIGNING_MODE=client  # must match server
```

### Migration from Server to Client Mode

1. Deploy JobRegistryV2:
   ```bash
   pnpm hh:deploy:megaeth:v2
   ```

2. Update server env:
   ```bash
   SIGNING_MODE=client
   JOB_REGISTRY_V2_ADDRESS=0x...
   # Can remove SERVER_WALLET_PRIVATE_KEY if using paymaster
   ```

3. Update web env:
   ```bash
   NEXT_PUBLIC_SIGNING_MODE=client
   NEXT_PUBLIC_CONTRACT_V2_ADDRESS=0x...
   ```

4. Restart: `pnpm dev`

### Security Notes

- In client mode, users never share private keys
- Signing happens locally in the wallet
- Server only sees signed messages, not keys
- Jobs are cryptographically linked to user addresses
```

---

## 🎯 Acceptance Criteria

### Server Mode (Already Works) ✅
- [ ] Current workflow unchanged
- [ ] No wallet required
- [ ] Server signs with `SERVER_WALLET_PRIVATE_KEY`

### Client Mode (TODO)
- [ ] Web requires wallet connection
- [ ] Submit triggers wallet signature
- [ ] Server verifies signature
- [ ] Server rejects invalid signatures
- [ ] Response includes `{ signer, signingMode: "client" }`
- [ ] UI shows "Signed by 0x..."
- [ ] V2 event includes submitter on-chain

### Both Modes
- [ ] Mode switchable via env vars
- [ ] Dev banner shows in server mode
- [ ] Never log raw prompts
- [ ] Tests pass for both modes

---

## 📦 Files Created/Modified So Far

### Created
1. `packages/contracts/src/JobRegistryV2.sol`
2. `packages/contracts/test/JobRegistryV2.t.sol`
3. `packages/contracts/scripts/deploy-v2.ts`
4. `apps/server/src/signature.ts`
5. `WALLET_CONNECT_IMPLEMENTATION.md` (this file)

### Modified
1. `packages/contracts/package.json` - Added V2 deploy script
2. `apps/server/src/config/env.ts` - Added SIGNING_MODE and V2 address

### Still TODO
1. `apps/server/src/blockchain.ts` - V2 support
2. `apps/server/src/routes/jobs.ts` - Client mode support
3. `apps/web/package.json` - Add Wagmi deps
4. `apps/web/app/providers.tsx` - Wagmi setup
5. `apps/web/app/components/ConnectButton.tsx` - Connect UI
6. `apps/web/app/hooks/useClientSigning.ts` - Signing logic
7. `apps/web/app/page.tsx` - Mode detection & UI
8. `apps/server/.env.example` - Add SIGNING_MODE
9. `apps/web/.env.local.example` - Add mode vars
10. `apps/server/src/__tests__/signature.test.ts` - Tests
11. `README.md` - Documentation

---

## 🚀 Next Steps

1. **Complete server-side implementation:**
   - Update blockchain.ts for V2
   - Update routes/jobs.ts for client mode
   - Add validation for signed payloads

2. **Web app implementation:**
   - Install Wagmi dependencies
   - Set up providers and config
   - Add Connect Wallet button
   - Implement client-side signing
   - Update form UI for mode detection

3. **Testing:**
   - Write signature verification tests
   - Write integration tests for client mode
   - Test both modes end-to-end

4. **Documentation:**
   - Update README with mode explanation
   - Add migration guide
   - Document security model

---

**Current Task:** Completing server-side signature verification and client mode support in /jobs endpoint.

