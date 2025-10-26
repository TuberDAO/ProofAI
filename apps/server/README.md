# Server

Backend server for PrivateGPT on MegaETH. Built with Fastify and TypeScript.

## Prerequisites

- Node.js >= 18
- pnpm >= 8

## Setup

1. Copy `env.example` to `.env`:
```bash
cp env.example .env
```

2. Fill in your environment variables:
   - `MEGAETH_RPC_URL`: MegaETH testnet RPC endpoint (default: https://carrot.megaeth.com/rpc)
   - `JOB_REGISTRY_ADDRESS`: Deployed contract address (from contracts package)
   - `SERVER_WALLET_PRIVATE_KEY`: Private key for your BURNER testnet wallet (with `0x` prefix)
   - `PROVIDER_ADDRESS`: Provider address (can be same as wallet address)
   - `ALLOWED_ORIGIN`: CORS allowed origin (default: http://localhost:3000)
   - `MIN_JOB_ETH`: Minimum job amount (default: 0.00001)
   - `MAX_JOB_ETH`: Maximum job amount (default: 0.01)

**⚠️ SECURITY:** Use BURNER wallets ONLY for testnet. Never use production keys!

3. Install dependencies:
```bash
pnpm install
```

## Development

Run the development server with hot reload:
```bash
pnpm dev
```

Server will start on http://localhost:4000

## Build

Compile TypeScript to JavaScript:
```bash
pnpm build
```

Run the compiled server:
```bash
pnpm start
```

## API Endpoints

### GET /health

Health check endpoint that verifies blockchain connectivity.

**Response:**
```json
{
  "ok": true,
  "chainId": 6342,
  "network": "MegaETH Testnet"
}
```

### POST /jobs

Submit a new job with a prompt.

**Request Body:**
```json
{
  "prompt": "Your prompt here",
  "amountEth": "0.0001"  // optional, defaults to 0.0001
}
```

**Response:**
```json
{
  "jobId": "1",
  "attestationHash": "0x...",
  "txHash": "0x...",
  "artifactPreview": {
    "model": "llama-3-8b-instruct",
    "modelVersion": "v0",
    "inputHash": "0x...",
    "timestampIso": "2024-01-15T10:30:00.000Z",
    "codeVersion": "abc1234",
    "nonce": "0x1234567890abcdef"
  }
}
```

**Error Response:**
```json
{
  "error": "Validation failed",
  "details": "Prompt too long (maximum 8,000 characters)"
}
```

## Architecture

- `src/index.ts` - Main server entry point with rate limiting and CORS
- `src/config.ts` - Environment configuration and validation
- `src/blockchain.ts` - Blockchain interaction logic with error mapping
- `src/attestation.ts` - **NEW:** Attestation artifact generation
- `src/validation.ts` - **NEW:** Input validation with Zod
- `src/routes/` - API route handlers with input validation
- `src/__tests__/` - **NEW:** Test suite (Vitest)

## Attestation System

The server generates a **deterministic attestation artifact** for each job submission:

```json
{
  "model": "llama-3-8b-instruct",
  "modelVersion": "v0",
  "inputHash": "0x...",          // keccak256(prompt)
  "timestampIso": "2024-01-15...",
  "codeVersion": "abc1234",       // git short SHA
  "nonce": "0x..."                // random 8-byte hex
}
```

**Key Points:**
- ✅ Raw prompt is NEVER stored or logged
- ✅ Only the attestation hash goes on-chain
- ✅ Input hash is stable for same prompt
- ✅ Attestation hash changes each time (nonce + timestamp)
- ✅ Deterministic serialization (sorted keys)

**Why Attestation?**
- **Privacy:** Prompt stays off-chain and local
- **Verifiability:** Hash proves the submission occurred
- **Auditability:** Artifact includes model, version, timestamp

## Security Features

This server includes several security and privacy protections:

1. **Rate Limiting** – IP-based, configurable (default: 60 req/min)
2. **CORS Protection** – Restricted to configured origin only
3. **Input Validation** (Zod schemas)
   - Prompt: 1-8,000 characters, rejects binary/control characters
   - Amount: Bounded between MIN_JOB_ETH and MAX_JOB_ETH
4. **Privacy Protection**
   - Prompts are NEVER logged in full (only sanitized metadata)
   - Private keys are automatically redacted from all logs
   - No prompt data returned in responses
   - Only attestation hash stored on-chain
5. **Error Mapping** – User-friendly messages for common RPC/blockchain errors

## Testing

Run tests using Vitest:

```bash
# Run all tests once
pnpm test

# Watch mode (re-runs on file changes)
pnpm test:watch

# Visual UI
pnpm test:ui
```

**Test Coverage:**
- ✅ Attestation artifact generation and hashing
- ✅ Input validation (prompts and amounts)
- ✅ Deterministic serialization
- ✅ UTF-8 and special character handling
- ✅ Boundary conditions

## Testing

The server can be tested using curl:

```bash
# Health check
curl http://localhost:4000/health

# Submit a job
curl -X POST http://localhost:4000/jobs \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test prompt", "amountEth": "0.0001"}'
```

