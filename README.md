# PrivateGPT on MegaETH – MVP

A proof-of-concept system that demonstrates private AI prompt submission with on-chain attestation on MegaETH testnet. Users submit prompts via a web interface, the backend simulates TEE attestation by hashing the prompt, and stores the attestation on-chain with a small payment.

## Architecture

This is a **pnpm monorepo** with three workspaces:

- **`packages/contracts`** – Solidity smart contracts (Foundry)
- **`apps/server`** – Node.js backend (Fastify + TypeScript + viem)
- **`apps/web`** – Next.js 14+ frontend (App Router + Tailwind CSS)

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8
- **Foundry** (for smart contracts) – [Install](https://book.getfoundry.sh/getting-started/installation)
- **MegaETH Testnet Wallet** with testnet ETH (see setup instructions below)

## MegaETH Testnet Setup

### Network Details

- **Chain ID:** 6342
- **Network Name:** MegaETH Testnet
- **RPC URL:** https://carrot.megaeth.com/rpc
- **Block Explorer:** https://www.oklink.com/megaeth-testnet

⚠️ **IMPORTANT:** MegaETH testnet endpoints are rate-limited and may change. Check [docs.megaeth.com](https://docs.megaeth.com) for the latest information.

### Adding MegaETH Testnet to MetaMask

1. Open MetaMask and click on the network dropdown
2. Click "Add Network" → "Add a network manually"
3. Enter the following details:
   - **Network Name:** MegaETH Testnet
   - **RPC URL:** https://carrot.megaeth.com/rpc
   - **Chain ID:** 6342
   - **Currency Symbol:** ETH
   - **Block Explorer:** https://www.oklink.com/megaeth-testnet

Alternatively, you can use:
- [ChainList](https://chainlist.org/?search=megaeth) or [ChainList.wtf](https://chainlist.wtf) to add the network automatically

### Getting Testnet ETH

**IMPORTANT:** Testnet ETH has no real-world value and is only for testing purposes.

You'll need testnet ETH in two wallets:
1. **Deployer Wallet** – for deploying the smart contract
2. **Server Wallet** – for submitting jobs (can be the same as deployer)

**Getting testnet ETH:**
- Check [docs.megaeth.com](https://docs.megaeth.com) for official faucet links
- Search for "MegaETH testnet faucet" in the community
- Request small amounts (you only need ~0.01 ETH total for testing)

### Security Notice

🔒 **CRITICAL SECURITY GUIDELINES:**

1. **NEVER use production/mainnet private keys for testnet**
2. **Create dedicated BURNER wallets for testnet ONLY**
3. **Never commit `.env` files to git** (they're in `.gitignore`)
4. **Never share or reuse testnet private keys**
5. **Private keys are NEVER logged or returned by the server**
6. **Prompts are NEVER logged in full** – only sanitized metadata is logged

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

This will install dependencies for all workspaces.

### 2. One-Step Deployment (Easiest)

The **smart-deploy** script automates everything:

```bash
# From root directory
pnpm smart-deploy
```

This will:
1. ✅ Compile contracts with Hardhat
2. ✅ Deploy `JobRegistry` to MegaETH testnet
3. ✅ Automatically update `apps/server/.env` with the deployed contract address
4. ✅ Print the explorer link and next steps

**Prerequisites:**
- You must create `packages/contracts/.env` first:
  ```bash
  cd packages/contracts
  cp env.example .env
  # Edit .env with MEGAETH_RPC_URL and DEPLOYER_PRIVATE_KEY
  ```

**After deployment:**
- Review `apps/server/.env` and fill in remaining variables (SERVER_WALLET_PRIVATE_KEY, PROVIDER_ADDRESS)
- Run `pnpm dev` to start the full stack
- Open http://localhost:3000

---

### 3. Set Up Smart Contracts (Manual Options)

#### Option A: Deploy with Hardhat (Recommended)

```bash
cd packages/contracts

# Copy and configure environment
cp env.example .env
```

Edit `packages/contracts/.env`:
```bash
MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x
```

**⚠️ Use a BURNER wallet! Never use production keys!**

```bash
# Compile contracts
pnpm hh:compile

# Deploy to MegaETH testnet
pnpm hh:deploy:megaeth
```

**Or from root directory:**
```bash
pnpm contracts:compile
pnpm contracts:deploy:megaeth
```

After deployment, you'll see:
```
JobRegistry deployed at: 0x1234567890abcdef...
```

**Copy this address** for the next step.

#### Option B: Deploy with Foundry

```bash
cd packages/contracts

# Install Foundry dependencies
forge install foundry-rs/forge-std

# Compile and test
pnpm compile
pnpm test

# Deploy to MegaETH testnet
pnpm deploy:testnet
```

After deployment, copy the `JOB_REGISTRY_ADDRESS` from the output.

### 4. Set Up Backend Server

```bash
cd apps/server

# Copy and configure environment
cp env.example .env
```

Edit `apps/server/.env`:
```bash
MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc
JOB_REGISTRY_ADDRESS=0x...  # from contract deployment
SERVER_WALLET_PRIVATE_KEY=0x...  # BURNER wallet with testnet ETH
PROVIDER_ADDRESS=0x...  # can be same as server wallet address
ALLOWED_ORIGIN=http://localhost:3000
MIN_JOB_ETH=0.00001
MAX_JOB_ETH=0.01
```

**⚠️ Important:**
- Use a **BURNER wallet** for `SERVER_WALLET_PRIVATE_KEY`
- This wallet needs testnet ETH for transaction fees (~0.001 ETH)
- **Private key format:** MetaMask exports 64-hex without `0x` - that's OK! The server auto-adds it.
- Remove any quotes or spaces around your private key
- `PROVIDER_ADDRESS` can be the same as your server wallet address for MVP

**💡 Verify your wallet configuration:**
```bash
# From root directory:
pnpm server:check:wallet

# This will:
# - Derive the address from your private key
# - Compare it to PROVIDER_ADDRESS
# - Tell you if they match or need updating
```

### 5. Set Up Web Frontend

```bash
cd apps/web

# Copy and configure environment
cp env.local.example .env.local
# Edit .env.local (optional - defaults work for local dev):
#   NEXT_PUBLIC_SERVER_BASE_URL=http://localhost:4000
#   NEXT_PUBLIC_EXPLORER_BASE_URL=https://www.oklink.com/megaeth-testnet
```

### 6. Run Development Servers

From the **root** directory:

```bash
pnpm dev
```

This will start both:
- Backend server on **http://localhost:4000**
- Web app on **http://localhost:3000**

## First Run Checklist

Follow these steps for your first end-to-end test:

### ✅ Pre-flight Checklist

- [ ] Node.js >= 18 and pnpm >= 8 installed
- [ ] Foundry installed (`forge --version` works)
- [ ] Created a BURNER wallet for testnet
- [ ] Added MegaETH Testnet (Chain ID 6342) to MetaMask
- [ ] Obtained testnet ETH for your burner wallet

### ✅ Setup Steps

1. **Install all dependencies**
   ```bash
   pnpm install
   cd packages/contracts && forge install foundry-rs/forge-std
   ```

2. **Configure contracts**
   ```bash
   cd packages/contracts
   cp env.example .env
   # Edit .env with your RPC URL and deployer private key
   ```

3. **Test and deploy contracts**
   ```bash
   pnpm contracts:test    # Should pass all tests
   pnpm contracts:deploy:testnet
   # Copy the JOB_REGISTRY_ADDRESS from output
   ```

4. **Configure server**
   ```bash
   cd apps/server
   cp env.example .env
   # Edit .env with all required values including JOB_REGISTRY_ADDRESS
   ```

5. **Configure web (optional)**
   ```bash
   cd apps/web
   cp env.local.example .env.local
   # Defaults work for local dev, no changes needed
   ```

6. **Start everything**
   ```bash
   cd ../..  # back to root
   pnpm dev
   ```

### ✅ Testing End-to-End

1. Open http://localhost:3000 in your browser
2. Enter a test prompt (e.g., "Explain quantum computing")
   - Min 1 character, max 8,000 characters
   - Special characters and Unicode are allowed
3. Keep the default amount (0.0001 ETH) or adjust it
   - Min: 0.00001 ETH, Max: 0.01 ETH (configurable in server .env)
4. Click "🚀 Run Private AI"
5. Wait for transaction confirmation (~2-5 seconds)
6. View the results:
   - **Job ID** – Auto-incremented counter from the contract
   - **Attestation Hash** – `keccak256(prompt)` computed by server
   - **Transaction Hash** – Clickable link to MegaETH testnet explorer
7. Click the transaction link to view on the block explorer
8. Confirm the transaction shows as "Success" on-chain

### ✅ What to Verify

- [ ] Server starts without errors and connects to chain (check `/health`)
- [ ] Web app loads and shows the form
- [ ] Prompt submission returns a valid response
- [ ] Transaction appears on block explorer as "Success"
- [ ] Job ID increments with each submission
- [ ] No prompts appear in server logs (only sanitized metadata)
- [ ] Rate limiting works (try 11 requests in 1 minute - should get rate limited)

## Project Structure

```
privategpt-megaeth/
├── packages/
│   └── contracts/          # Smart contracts (Foundry)
│       ├── src/
│       │   └── JobRegistry.sol
│       ├── test/
│       ├── script/
│       ├── foundry.toml
│       └── package.json
├── apps/
│   ├── server/            # Backend (Fastify + TypeScript)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config.ts
│   │   │   ├── blockchain.ts
│   │   │   └── routes/
│   │   ├── env.example
│   │   └── package.json
│   └── web/               # Frontend (Next.js 14+)
│       ├── app/
│       │   ├── page.tsx
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── env.local.example
│       └── package.json
├── pnpm-workspace.yaml
├── package.json           # Root scripts
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
└── README.md
```

## Available Scripts

### Root Level

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run server + web concurrently |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | Lint all TypeScript/JavaScript files |
| `pnpm lint:fix` | Lint and auto-fix issues |
| `pnpm format` | Format code with Prettier |
| `pnpm test` | Run all tests |
| `pnpm smart-deploy` | **🚀 One-step**: Compile, deploy, and configure automatically |

### Contracts

| Command | Description |
|---------|-------------|
| `pnpm contracts:compile` | Compile Solidity contracts with Hardhat |
| `pnpm contracts:deploy:megaeth` | Deploy to MegaETH testnet with Hardhat |
| `pnpm contracts:full-deploy` | Compile and deploy (manual, use `smart-deploy` instead) |
| `pnpm contracts:test` | Run contract tests |
| `pnpm contracts:deploy:testnet` | Deploy to MegaETH testnet |

### Server

| Command | Description |
|---------|-------------|
| `pnpm server:dev` | Run server in dev mode (port 4000) |

### Web

| Command | Description |
|---------|-------------|
| `pnpm web:dev` | Run Next.js in dev mode (port 3000) |

## Smart Contract: JobRegistry

### Key Functions

- **`submitJob(bytes32 attestationHash, address provider) payable returns (uint256 jobId)`**
  - Submit a new job with attestation hash
  - Requires `msg.value > 0` (payment)
  - Returns auto-incremented job ID
  - Emits `JobSubmitted` event

- **`getJob(uint256 jobId) view returns (...)`**
  - Retrieve job details by ID
  - Returns payer, provider, attestation hash, amount, timestamp

### Events

- **`JobSubmitted(uint256 indexed jobId, address indexed payer, address indexed provider, bytes32 attestationHash, uint256 amount, uint256 timestamp)`**

## API Endpoints

### GET /health

Health check that verifies blockchain connectivity.

**Response:**
```json
{
  "ok": true,
  "chainId": 6342,
  "network": "MegaETH Testnet"
}
```

### POST /jobs

Submit a job with a prompt.

**Request:**
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
  "txHash": "0x..."
}
```

## Development Notes

### TypeScript Configuration

All workspaces use **strict mode** (`"strict": true`).

### Code Quality

- **ESLint** with TypeScript plugin
- **Prettier** for formatting
- Consistent configuration across all packages

### Environment Variables

Each workspace has its own `.env.example` or `env.example` file. Copy these to `.env` (or `.env.local` for Next.js) and fill in your values before running.

**Quick copy commands:**
```bash
# Contracts
cp packages/contracts/env.example packages/contracts/.env

# Server
cp apps/server/env.example apps/server/.env

# Web
cp apps/web/env.local.example apps/web/.env.local
```

### Security Features

This MVP includes several security and privacy features:

1. **Rate Limiting** – IP-based, 10 requests per minute per IP
2. **CORS Protection** – Only allows requests from configured origin
3. **Input Validation**
   - Prompt: 1-8,000 characters, rejects binary/control characters
   - Amount: Bounded by MIN_JOB_ETH and MAX_JOB_ETH (default: 0.00001-0.01 ETH)
4. **Privacy Protection**
   - Prompts are NEVER logged in full (only sanitized metadata)
   - Private keys are NEVER exposed in responses or logs
   - Sensitive fields automatically redacted from logs
5. **Attestation** – Prompts are hashed (keccak256) before storage on-chain
6. **No Prompt Echo** – Server never returns the original prompt

## Troubleshooting

### Contract deployment fails

- **Ensure your deployer wallet has testnet ETH** – need ~0.001 ETH
- **Verify `MEGAETH_RPC_URL` is correct** – default is https://carrot.megaeth.com/rpc
- **Check `DEPLOYER_PRIVATE_KEY` format** – must be without `0x` prefix for Foundry
- **RPC rate limit exceeded** – wait a moment and try again
- **Invalid chain** – verify you're connected to MegaETH testnet (Chain ID 6342)

### Server can't connect to blockchain

- **Verify all environment variables** in `apps/server/.env`
- **Check `JOB_REGISTRY_ADDRESS`** – must match deployed contract address
- **Ensure `SERVER_WALLET_PRIVATE_KEY` format** – must include `0x` prefix
- **Confirm wallet has testnet ETH** – need ~0.001 ETH for gas fees
- **RPC issues** – check if https://carrot.megaeth.com/rpc is accessible
- **Rate limiting** – MegaETH testnet RPC is rate-limited, retry after a moment

### Web app shows CORS errors

- **Check backend is running** on port 4000 (`http://localhost:4000/health`)
- **Verify `ALLOWED_ORIGIN`** in `apps/server/.env` matches web app origin
- **Check `NEXT_PUBLIC_SERVER_BASE_URL`** in `apps/web/.env.local`
- **Try hard refresh** in browser (Ctrl+Shift+R or Cmd+Shift+R)

### Job submission fails

- **"Prompt too long"** – max 8,000 characters
- **"Amount too low/high"** – check MIN_JOB_ETH and MAX_JOB_ETH in server .env
- **"Insufficient funds"** – server wallet needs more testnet ETH
- **"Rate limit exceeded"** – wait 1 minute between request bursts
- **"RPC unavailable"** – MegaETH testnet RPC may be temporarily down

### Testing issues

- **Contracts tests fail** – ensure you ran `forge install foundry-rs/forge-std`
- **Can't find `forge` command** – install Foundry: https://book.getfoundry.sh/getting-started/installation
- **TypeScript errors** – run `pnpm install` from root to ensure all deps are installed

### General tips

- **Check server logs** – look for warnings about missing env vars or connection issues
- **Verify chain ID** – call `/health` endpoint to confirm server is connected to chain 6342
- **Clear browser cache** – especially if you updated env vars in the web app
- **Use burner wallets only** – never use mainnet/production keys for testnet

## Next Steps

- [ ] Integrate real TEE attestation (e.g., Intel SGX, AMD SEV)
- [ ] Add authentication and user accounts
- [ ] Store encrypted prompts on IPFS or similar
- [ ] Implement job result retrieval
- [ ] Add comprehensive test coverage
- [ ] Deploy to production

## License

MIT

## Contributing

This is an MVP. Contributions and feedback are welcome!

