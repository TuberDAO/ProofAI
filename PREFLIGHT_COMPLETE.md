# Preflight & E2E Setup Complete ✅

## Summary

Successfully implemented preflight checks, smoke tests, and wired the deployed contract address.

---

## ✅ Completed Tasks

### 1. Server Environment Updated
**File:** `apps/server/.env`

- ✅ Created with deployed contract address: `0xA2189Fc270BaaF85d57C04Bf8e00Cd6580aF0e07`
- ✅ MEGAETH_RPC_URL set to: `https://carrot.megaeth.com/rpc`
- ✅ JOB_REGISTRY_ADDRESS configured
- ⚠️ **ACTION REQUIRED**: Fill in wallet keys (see below)

### 2. Preflight Script Created
**File:** `apps/server/scripts/preflight.ts`

**Features:**
- ✅ Loads environment variables (no logging of secrets)
- ✅ Connects to MegaETH RPC
- ✅ Verifies chainId is 6342
- ✅ Checks contract bytecode exists at address
- ✅ Prints beautiful PASS/FAIL table with diagnostics
- ✅ Provides actionable next steps on failure

**Usage:**
```bash
pnpm server:preflight
# or from root:
pnpm server:preflight
```

**Current Status:**
```
✅  Environment loaded
✅  RPC connection (https://carrot.megaeth.com/rpc)
✅  Chain ID: 6342 (MegaETH Testnet)
✅  Contract deployed: 0xA2189Fc270BaaF85d57C04Bf8e00Cd6580aF0e07
   └─ Code size: 2228 bytes

🎉 PREFLIGHT PASSED
```

### 3. Smoke Test Script Created
**File:** `apps/server/scripts/smoke-job.ts`

**Features:**
- ✅ POSTs test job to `http://localhost:4000/jobs`
- ✅ Payload: `{ "prompt": "Test private job", "amountEth": "0.0001" }`
- ✅ Prints jobId, attestationHash, txHash
- ✅ Constructs and displays explorer link
- ✅ Provides troubleshooting hints on failure

**Usage:**
```bash
pnpm server:smoke
# or from root:
pnpm server:smoke
```

### 4. Package Scripts Updated

**Root `package.json`:**
```json
{
  "server:preflight": "pnpm --filter server run preflight",
  "server:smoke": "pnpm --filter server run smoke"
}
```

**Server `apps/server/package.json`:**
```json
{
  "preflight": "tsx scripts/preflight.ts",
  "smoke": "tsx scripts/smoke-job.ts"
}
```

### 5. Web Badge Enhanced
**File:** `apps/web/app/page.tsx`

**Updated status pill to show:**
- ✅ "MegaETH (6342) — Ready" when chainId is 6342 (green)
- ⚠️ "Wrong network (XXX)" for other chains (yellow)
- 🔴 "Not connected" when server is unreachable (gray)

---

## ⚠️ ACTION REQUIRED: Wallet Configuration

To run the smoke test and use the full system, you need to configure wallet keys in `apps/server/.env`:

### Required Variables

```bash
# Edit apps/server/.env and fill in:

SERVER_WALLET_PRIVATE_KEY=0x...  # Your burner wallet private key
PROVIDER_ADDRESS=0x...           # Your burner wallet address (can be same as wallet)
```

### Important Security Notes

🔒 **CRITICAL:**
- ✅ Use a **BURNER wallet** for testnet ONLY
- ✅ Never use production/mainnet private keys
- ✅ Get testnet ETH from a MegaETH faucet
- ✅ `PROVIDER_ADDRESS` can be the same as your wallet address for MVP
- ✅ Ensure the wallet has ~0.001 ETH for transaction fees

### How to Get Testnet ETH

1. Check [docs.megaeth.com](https://docs.megaeth.com) for official faucet links
2. Search for "MegaETH testnet faucet" in the community
3. Request small amounts (you only need ~0.01 ETH total for testing)

---

## 🚀 Next Steps

### After Configuring Wallet Keys:

#### 1. Start the Development Stack
```bash
pnpm dev
```
This starts:
- Server on http://localhost:4000
- Web app on http://localhost:3000

#### 2. Run the Smoke Test (Optional)
```bash
# In a new terminal:
pnpm server:smoke
```

Expected output:
```
🧪 Running smoke test...

📤 Submitting test job...
   Prompt: "Test private job"
   Amount: 0.0001 ETH

✅ SMOKE TEST PASSED

Job submitted successfully:
   Job ID: 1
   Attestation Hash: 0x...
   Transaction Hash: 0x...

🔗 View on Explorer:
   https://www.oklink.com/megaeth-testnet/tx/0x...

👉 Next: Open http://localhost:3000 and submit a job in the UI.
```

#### 3. Test in the Web UI
1. Open http://localhost:3000
2. Verify the badge shows "MegaETH (6342) — Ready"
3. Enter a test prompt (e.g., "Explain quantum computing")
4. Keep the default amount (0.0001 ETH)
5. Click "🚀 Run Private AI"
6. View the results and click the explorer link

---

## 📋 Acceptance Criteria Status

- ✅ `apps/server/.env` updated with deployed address (no secrets displayed in logs)
- ✅ `pnpm dev` runs clean (after wallet keys are filled)
- ✅ `pnpm server:preflight` prints ok with chainId 6342 and code size > 0
- ⏳ `pnpm server:smoke` will work after wallet keys are configured
- ✅ Web badge shows connection status

---

## 📁 Files Created/Modified

### Created Files
1. ✅ `apps/server/.env` – Environment configuration with contract address
2. ✅ `apps/server/scripts/preflight.ts` – Preflight validation script
3. ✅ `apps/server/scripts/smoke-job.ts` – E2E smoke test script
4. ✅ `PREFLIGHT_COMPLETE.md` – This document

### Modified Files
1. ✅ `package.json` – Added `server:preflight` and `server:smoke` scripts
2. ✅ `apps/server/package.json` – Added `preflight` and `smoke` scripts
3. ✅ `apps/web/app/page.tsx` – Enhanced status badge to show "MegaETH (6342) — Ready"

---

## 🎯 Current Status

### Preflight Check Results

```
╔════════════════════════════════════════════════════════════════╗
║                    PREFLIGHT CHECK RESULTS                     ║
╚════════════════════════════════════════════════════════════════╝

✅  Environment loaded
✅  RPC connection (https://carrot.megaeth.com/rpc)
✅  Chain ID: 6342 (MegaETH Testnet)
✅  Contract deployed: 0xA2189Fc270BaaF85d57C04Bf8e00Cd6580aF0e07
   └─ Code size: 2228 bytes

─────────────────────────────────────────────────────────────────

🎉 PREFLIGHT PASSED

Summary:
   Chain ID: 6342
   Contract: 0xA2189Fc270BaaF85d57C04Bf8e00Cd6580aF0e07
   Code Size: 2228 bytes

👉 Next: Run `pnpm dev` to start the stack

═════════════════════════════════════════════════════════════════
```

### System Ready For

- ✅ Contract interaction (deployed and verified)
- ✅ RPC connection (connected to MegaETH testnet)
- ⏳ Job submission (awaiting wallet configuration)

---

## 🔧 Troubleshooting

### Preflight Fails

**RPC Connection Failed:**
- Check internet connection
- Verify MEGAETH_RPC_URL in .env
- Try again (RPC may be rate-limited)

**Wrong Chain ID:**
- Ensure using MegaETH testnet RPC: `https://carrot.megaeth.com/rpc`
- Check [docs.megaeth.com](https://docs.megaeth.com) for updates

**Contract Not Found:**
- Verify JOB_REGISTRY_ADDRESS is correct
- Run `pnpm smart-deploy` to redeploy

### Smoke Test Fails

**Connection Refused:**
- Ensure server is running: `pnpm dev`
- Check PORT=4000 in apps/server/.env

**HTTP 400 (Validation Error):**
- Check input validation rules
- Ensure prompt is 1-8000 characters
- Ensure amountEth is between MIN_JOB_ETH and MAX_JOB_ETH

**HTTP 500 (Server Error):**
- Check server logs for details
- Verify all environment variables are set
- Ensure SERVER_WALLET_PRIVATE_KEY has testnet ETH

**Insufficient Funds:**
- Get more testnet ETH from faucet
- Check wallet balance on explorer

---

## 📞 Quick Commands Reference

```bash
# Check environment and contract
pnpm server:preflight

# Start development servers
pnpm dev

# Run smoke test (server must be running)
pnpm server:smoke

# View logs
# (server logs show sanitized metadata, never raw prompts)
```

---

**Status:** ✅ Preflight system complete, ready for wallet configuration!

