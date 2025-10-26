# 🚀 Quick Start - Attestation Upgrade

## What Changed

You now have a **privacy-hardened** system with:
- ✅ Attestation artifacts (prompt hashed, never stored)
- ✅ Input validation (Zod schemas)
- ✅ 40+ comprehensive tests (Vitest)
- ✅ Configurable rate limiting
- ✅ Enhanced web UI with security details

---

## Install & Run

### Step 1: Install New Dependencies
```bash
pnpm install
```

Installs: `zod`, `vitest`, `git-rev-sync`

### Step 2: Run Tests
```bash
cd apps/server
pnpm test
```

Expected: ✅ 40+ tests pass

### Step 3: Start Development
```bash
cd ../..  # back to root
pnpm dev
```

Expected:
- Server on port 4000
- Web on port 3000
- Badge shows "Connected: MegaETH Testnet (6342)"

---

## Test the New Flow

### Submit a Job:
```bash
curl -X POST http://localhost:4000/jobs \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is AI?", "amountEth": "0.0001"}'
```

### Expected Response:
```json
{
  "jobId": "1",
  "attestationHash": "0xabc123...",
  "txHash": "0xdef456...",
  "artifactPreview": {
    "model": "llama-3-8b-instruct",
    "modelVersion": "v0",
    "inputHash": "0x789...",
    "timestampIso": "2024-01-15T10:30:00.000Z",
    "codeVersion": "abc1234",
    "nonce": "0x1122334455667788"
  }
}
```

---

## New Environment Variables (Optional)

All have sensible defaults, add to `apps/server/.env` only if you want to customize:

```bash
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
RATE_LIMIT_MAX=60           # 60 requests per window
```

---

## What's New in the Web UI

1. **Network Badge** - Shows connection status to MegaETH
2. **Artifact Preview** - Click "🔒 Security Details" to expand
3. **Better Errors** - Clear validation messages
4. **Privacy Note** - Explains only hash goes on-chain

---

## Files Created

1. `apps/server/src/attestation.ts` - Artifact generation
2. `apps/server/src/validation.ts` - Input validation
3. `apps/server/vitest.config.ts` - Test config
4. `apps/server/src/__tests__/attestation.test.ts` - Tests
5. `apps/server/src/__tests__/validation.test.ts` - Tests

---

## Privacy Guarantees

✅ Prompts NEVER logged in full  
✅ Prompts NEVER returned in responses  
✅ Only attestation hash goes on-chain  
✅ Input validation prevents attacks  
✅ Rate limiting prevents abuse  

---

## Need Help?

- See `IMPLEMENTATION_COMPLETE.md` for full details
- See `ATTESTATION_UPGRADE_SUMMARY.md` for technical docs
- Run `pnpm test` to verify setup
- Check server logs for any errors

🎉 **Everything is ready to use!**

