# Wallet Environment Validation Complete ✅

## Summary

Successfully implemented robust environment validation and wallet address verification with support for MetaMask-style private keys and common formatting mistakes.

---

## ✅ Completed Features

### 1. Environment Normalization & Validation
**File:** `apps/server/src/config/env.ts`

**Features:**
- ✅ Loads and validates all environment variables on import
- ✅ Normalizes `SERVER_WALLET_PRIVATE_KEY`:
  - Trims whitespace
  - Removes surrounding quotes (`"` and `'`)
  - Auto-prepends `0x` if it's 64 hex characters without prefix
- ✅ Normalizes addresses (`PROVIDER_ADDRESS`, `JOB_REGISTRY_ADDRESS`):
  - Trims whitespace
  - Removes surrounding quotes
  - Auto-prepends `0x` if it's 40 hex characters without prefix
- ✅ Validates with regex:
  - `SERVER_WALLET_PRIVATE_KEY`: `^0x[0-9a-fA-F]{64}$`
  - `PROVIDER_ADDRESS`: `^0x[0-9a-fA-F]{40}$`
  - `JOB_REGISTRY_ADDRESS`: `^0x[0-9a-fA-F]{40}$`
  - `MEGAETH_RPC_URL`: non-empty HTTP(S) URL
- ✅ Throws clear, human-readable errors (no secret printing)
- ✅ Exports typed `env` object for server use
- ✅ Fails fast on startup if validation fails

**Example Error Message:**
```
❌ Environment validation failed:

   • SERVER_WALLET_PRIVATE_KEY must be a valid private key (0x + 64 hex characters)
   • PROVIDER_ADDRESS is required

📝 Please check apps/server/.env and ensure:
   • Private keys are 64 hex characters (with or without 0x prefix)
   • Addresses are 40 hex characters (with or without 0x prefix)
   • No quotes or extra whitespace around values
   • RPC URL starts with http:// or https://

💡 MetaMask exports private keys without 0x prefix - that's OK!
   The system will auto-add it.
```

### 2. Wallet Address Verification Script
**File:** `apps/server/scripts/check-wallet.ts`

**Features:**
- ✅ Imports normalized `env`
- ✅ Uses `viem/accounts` `privateKeyToAccount` to derive address from private key
- ✅ Compares derived address to `PROVIDER_ADDRESS` (case-insensitive)
- ✅ Prints clear MATCH/MISMATCH status
- ✅ Provides copy-paste line to update `.env` on mismatch
- ✅ Exits with code 0 on match, 1 on mismatch

**Example Output (Match):**
```
🔐 Wallet Address Verification

─────────────────────────────────────────────────────────────────

Derived address:  0x1234567890abcdef1234567890abcdef12345678
PROVIDER_ADDRESS: 0x1234567890abcdef1234567890abcdef12345678

✅ Status: MATCH

The addresses match! Your wallet is correctly configured.

─────────────────────────────────────────────────────────────────

👉 Next: Run `pnpm dev` to start the stack
```

**Example Output (Mismatch):**
```
🔐 Wallet Address Verification

─────────────────────────────────────────────────────────────────

Derived address:  0xabc1234567890def1234567890abcdef12345678
PROVIDER_ADDRESS: 0x1234567890abcdef1234567890abcdef12345678

❌ Status: MISMATCH

The PROVIDER_ADDRESS does not match the derived address.

⚠️  ACTION REQUIRED:

Update apps/server/.env with the correct address:

PROVIDER_ADDRESS=0xabc1234567890def1234567890abcdef12345678

─────────────────────────────────────────────────────────────────

💡 Tip: PROVIDER_ADDRESS should be the public address that
    corresponds to your SERVER_WALLET_PRIVATE_KEY.
```

### 3. Server Integration
**Files Updated:**
- `apps/server/src/index.ts` – Uses `env` instead of `config`
- `apps/server/src/blockchain.ts` – Uses `env` instead of `config`
- `apps/server/src/validation.ts` – Uses `env` instead of `config`

**Behavior:**
- ✅ Server fails fast on startup if environment is invalid
- ✅ Clear error messages guide user to fix issues
- ✅ No secrets printed to console or logs
- ✅ Environment loaded and validated before any server initialization

### 4. Scripts Added

**Server `package.json`:**
```json
{
  "check:wallet": "tsx scripts/check-wallet.ts"
}
```

**Root `package.json`:**
```json
{
  "server:check:wallet": "pnpm --filter server run check:wallet"
}
```

**Usage:**
```bash
# From root:
pnpm server:check:wallet

# From apps/server:
pnpm check:wallet
```

### 5. Documentation Updated

**File:** `README.md`

Added section explaining:
- ✅ MetaMask exports 64-hex private keys without `0x` prefix - system auto-adds it
- ✅ Remove quotes and spaces from environment variables
- ✅ How to use `pnpm server:check:wallet` to verify configuration
- ✅ What the script does and how to interpret results

---

## 📋 Acceptance Criteria Status

- ✅ If private key is raw 64-hex (no `0x`), startup works (auto-prefix added)
- ✅ If private key is invalid format, startup fails with clear, human-readable message (no secret printed)
- ✅ `pnpm server:check:wallet` prints addresses and MATCH/MISMATCH status
- ✅ Environment normalization handles quotes, spaces, missing `0x` prefix
- ✅ Regex validation ensures correct formats after normalization
- ✅ Server fails fast on invalid environment with actionable error messages
- ✅ Old `config.ts` module replaced with new `config/env.ts` module

---

## 🔧 How It Works

### Normalization Flow

1. **Load `.env` file** via `dotenv.config()`
2. **Normalize private key:**
   ```typescript
   // Input examples:
   "abc123..." // 64 hex without 0x
   '"abc123..."' // with quotes
   ' abc123... ' // with spaces
   
   // All become:
   "0xabc123..." // normalized
   ```
3. **Normalize addresses:**
   ```typescript
   // Input examples:
   "1234567890abcdef..." // 40 hex without 0x
   '"1234567890abcdef..."' // with quotes
   
   // All become:
   "0x1234567890abcdef..." // normalized
   ```
4. **Validate with regex** - throw if invalid after normalization
5. **Update `process.env`** with normalized values for consistency
6. **Export typed `env` object**

### Validation Patterns

```typescript
const PATTERNS = {
  PRIVATE_KEY: /^0x[0-9a-fA-F]{64}$/,  // 0x + 64 hex
  ADDRESS: /^0x[0-9a-fA-F]{40}$/,      // 0x + 40 hex
  RPC_URL: /^https?:\/\/.+/,            // http(s)://...
};
```

### Wallet Verification Flow

1. **Import normalized `env`** (validation happens automatically)
2. **Derive address** from `SERVER_WALLET_PRIVATE_KEY` using `privateKeyToAccount`
3. **Compare** to `PROVIDER_ADDRESS` (case-insensitive)
4. **Print status** with actionable next steps
5. **Exit** with appropriate code (0 = match, 1 = mismatch)

---

## 🎯 Usage Examples

### Valid Private Key Formats (All Work)

```bash
# MetaMask export (no 0x prefix)
SERVER_WALLET_PRIVATE_KEY=abc1234567890def1234567890abcdef1234567890abcdef1234567890abcdef

# With 0x prefix
SERVER_WALLET_PRIVATE_KEY=0xabc1234567890def1234567890abcdef1234567890abcdef1234567890abcdef

# With quotes (auto-removed)
SERVER_WALLET_PRIVATE_KEY="abc1234567890def1234567890abcdef1234567890abcdef1234567890abcdef"

# With spaces (auto-trimmed)
SERVER_WALLET_PRIVATE_KEY= abc1234567890def1234567890abcdef1234567890abcdef1234567890abcdef 
```

### Invalid Formats (Clear Errors)

```bash
# Too short
SERVER_WALLET_PRIVATE_KEY=abc123
# Error: must be a valid private key (0x + 64 hex characters)

# Invalid characters
SERVER_WALLET_PRIVATE_KEY=xyz123... (not hex)
# Error: must be a valid private key (0x + 64 hex characters)

# Missing entirely
# Error: SERVER_WALLET_PRIVATE_KEY is required
```

### Checking Wallet Configuration

```bash
# Run check script
pnpm server:check:wallet

# If mismatch, copy the suggested line:
PROVIDER_ADDRESS=0xabc123...

# Update apps/server/.env
# Run check again to confirm
```

---

## 📁 Files Created/Modified

### Created
1. `apps/server/src/config/env.ts` – New validation & normalization module
2. `apps/server/scripts/check-wallet.ts` – Wallet verification script
3. `WALLET_ENV_COMPLETE.md` – This documentation

### Modified
1. `apps/server/src/index.ts` – Use `env` instead of `config`
2. `apps/server/src/blockchain.ts` – Use `env` instead of `config`
3. `apps/server/src/validation.ts` – Use `env` instead of `config`
4. `apps/server/package.json` – Added `check:wallet` script
5. `package.json` – Added `server:check:wallet` script
6. `README.md` – Added private key format documentation

### Deprecated
- `apps/server/src/config.ts` – Replaced by `config/env.ts` (can be deleted)

---

## 🚀 Quick Start

### 1. Configure Environment

```bash
cd apps/server
cp .env.example .env
```

Edit `.env`:
```bash
# No quotes, no worries about 0x prefix
SERVER_WALLET_PRIVATE_KEY=abc123...  # Your 64-hex private key
PROVIDER_ADDRESS=0x...               # Your wallet address
JOB_REGISTRY_ADDRESS=0xA2189Fc270BaaF85d57C04Bf8e00Cd6580aF0e07
MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc
```

### 2. Verify Configuration

```bash
cd ../..
pnpm server:check:wallet
```

Expected output:
```
✅ Status: MATCH
👉 Next: Run `pnpm dev` to start the stack
```

### 3. Start Server

```bash
pnpm dev
```

Expected output:
```
✅ Environment validated successfully
   RPC: https://carrot.megaeth.com/rpc
   Contract: 0xA2189Fc270BaaF85d57C04Bf8e00Cd6580aF0e07
   Provider: 0x...

🚀 Server running on http://localhost:4000
```

---

## 🔍 Troubleshooting

### Server won't start - environment validation failed

**Solution:** Check the error message, it will tell you exactly what's wrong:
- Missing variable? Add it to `.env`
- Invalid format? Ensure 64 hex for keys, 40 hex for addresses
- Remove quotes and spaces

### Wallet check shows MISMATCH

**Solution:** Copy the suggested `PROVIDER_ADDRESS=...` line and update `.env`

### MetaMask key doesn't work

**Solution:** Make sure you're using the **private key**, not:
- Public address (40 hex, not 64)
- Mnemonic phrase (12/24 words)
- Keystore JSON

To export from MetaMask:
1. Account Details → Export Private Key
2. Enter password
3. Copy the 64-character hex string
4. Paste into `.env` (with or without `0x` prefix - both work!)

---

**Status:** ✅ All features implemented and tested! Environment validation is production-ready.

